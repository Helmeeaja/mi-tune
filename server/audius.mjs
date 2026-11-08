import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const trackId = /^audius:([A-Za-z0-9]{1,64})$/
const userId = /^audius:user:([A-Za-z0-9]{1,64})$/
const albumId = /^audius:album:([A-Za-z0-9]{1,64})$/

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

function image(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : ''
  } catch { return '' }
}

function artwork(value) {
  return image(value?.['480x480'] || value?.['1000x1000'] || value?.['150x150'])
}

function artistSummary(value) {
  if (!value || !/^[A-Za-z0-9]{1,64}$/.test(value.id || '') || typeof value.name !== 'string' || !value.name.trim() || value.is_deactivated || value.is_available === false) return null
  const id = `audius:user:${value.id}`
  return { id, name: value.name.trim(), thumbnail: artwork(value.profile_picture), coverUrl: `/api/artists/${encodeURIComponent(id)}/cover`, source: 'audius' }
}

function albumSummary(value) {
  if (!value?.is_album || value.is_private || value.is_delete || value.is_stream_gated || !/^[A-Za-z0-9]{1,64}$/.test(value.id || '') || typeof value.playlist_name !== 'string') return null
  const id = `audius:album:${value.id}`
  const artist = artistSummary(value.user)
  return { id, title: value.playlist_name, type: 'Album', year: value.release_date ? new Date(value.release_date).getUTCFullYear() : null, thumbnail: artwork(value.artwork), coverUrl: `/api/albums/${encodeURIComponent(id)}/cover`, artists: artist ? [{ id: artist.id, name: artist.name }] : [], source: 'audius' }
}

export function normalizeAudiusTrack(value) {
  if (!value || !/^[A-Za-z0-9]{1,64}$/.test(value.id || '') || typeof value.title !== 'string' || !value.title.trim() || !Number.isFinite(value.duration) || value.duration <= 0 || value.is_streamable !== true || value.is_stream_gated || value.is_available === false || value.is_delete || value.is_unlisted || value.is_scheduled_release) return null
  const artist = artistSummary(value.user)
  if (!artist) return null
  const id = `audius:${value.id}`
  const album = albumSummary(value.album_backlink)
  return {
    id,
    source: 'audius',
    type: 'song',
    musicType: 'FULL_TRACK',
    catalogueType: album ? 'album-track' : 'song',
    title: value.title.trim(),
    artist: artist.name,
    artists: [artist.name],
    artistRefs: [{ id: artist.id, name: artist.name }],
    album: album?.title || value.album_backlink?.playlist_name || '',
    albumId: album?.id || null,
    duration: value.duration,
    thumbnail: artwork(value.artwork),
    coverUrl: `/api/tracks/${encodeURIComponent(id)}/cover`,
    sourceUrl: typeof value.permalink === 'string' && value.permalink.startsWith('/') ? `https://audius.co${value.permalink}` : 'https://audius.co',
    downloadAllowed: value.is_downloadable === true && !value.is_download_gated,
    genre: typeof value.genre === 'string' ? value.genre : '',
    publishedAt: value.release_date || value.created_at || null,
  }
}

export function createAudiusService({ fetcher = fetch, timeoutMs = 12000 } = {}) {
  const songs = new Map()
  const cache = new Map()
  const pending = new Map()
  const streams = new Set()

  function register(values) {
    for (const value of values || []) if (value?.id && value.type === 'song') songs.set(value.id, value)
    while (songs.size > 600) songs.delete(songs.keys().next().value)
  }

  async function request(path, params = {}) {
    const url = new URL(`https://api.audius.co/v1/${path}`)
    url.searchParams.set('app_name', 'MiTune')
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
    const key = url.href
    const old = cache.get(key)
    if (old && Date.now() - old.at < 120000) return old.data
    if (pending.has(key)) return pending.get(key)
    const task = (async () => {
      let response
      try { response = await fetcher(url, { headers: { 'User-Agent': 'MiTune/1.0' }, signal: AbortSignal.timeout(timeoutMs) }) }
      catch { throw fail(503, 'AUDIUS_UNAVAILABLE', 'Audius belum dapat dihubungi. Coba lagi sebentar.') }
      if (!response.ok) throw fail(response.status === 404 ? 404 : 503, 'AUDIUS_UNAVAILABLE', response.status === 404 ? 'Musik atau profil ini tidak tersedia di Audius.' : 'Audius sedang tidak tersedia. Coba lagi sebentar.')
      let result
      try { result = await response.json() } catch { throw fail(502, 'INVALID_AUDIUS_RESPONSE', 'Respons Audius belum dapat dibaca.') }
      if (!result || !Object.hasOwn(result, 'data')) throw fail(502, 'INVALID_AUDIUS_RESPONSE', 'Respons Audius belum dapat divalidasi.')
      cache.set(key, { at: Date.now(), data: result.data })
      if (cache.size > 120) cache.delete(cache.keys().next().value)
      return result.data
    })().finally(() => pending.delete(key))
    pending.set(key, task)
    return task
  }

  function tracks(values) {
    const result = [...new Map((Array.isArray(values) ? values : []).map(normalizeAudiusTrack).filter(Boolean).map(value => [value.id, value])).values()]
    register(result)
    return result
  }

  async function metadata(id) {
    const match = trackId.exec(id || '')
    if (!match) throw fail(409, 'LEGACY_MUSIC_SOURCE', 'Lagu ini berasal dari sumber musik lama. Cari ulang di Audius; koleksi lama tidak diubah.')
    const values = await request(`tracks/${match[1]}`)
    const song = normalizeAudiusTrack(Array.isArray(values) ? values[0] : values)
    if (!song || song.id !== id) throw fail(404, 'AUDIUS_TRACK_UNAVAILABLE', 'Lagu ini tidak tersedia sebagai audio lengkap yang bebas diputar di Audius.')
    register([song])
    return song
  }

  async function search(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 160 || /https?:\/\/|www\./i.test(query)) throw fail(400, 'INVALID_SEARCH', 'Cari judul lagu atau artis sepanjang 2–160 karakter, bukan URL.')
    return tracks(await request('tracks/search', { query: query.trim(), limit: 40 }))
  }

  async function searchArtists(query) {
    const values = await request('users/search', { query, limit: 12 })
    return { artists: (Array.isArray(values) ? values : []).map(artistSummary).filter(Boolean), warnings: [], stale: false }
  }

  async function searchCatalogue(query) {
    const results = await Promise.allSettled([searchArtists(query), request('playlists/search', { query, limit: 20 })])
    return { artists: results[0].status === 'fulfilled' ? results[0].value.artists : [], albums: results[1].status === 'fulfilled' ? results[1].value.map(albumSummary).filter(Boolean) : [], warnings: results.some(value => value.status === 'rejected') ? ['Sebagian katalog Audius belum tersedia.'] : [], stale: false }
  }

  async function summary(id) {
    const match = userId.exec(id || '')
    if (!match) throw fail(409, 'LEGACY_ARTIST_SOURCE', 'Profil ini berasal dari katalog lama. Cari artis di Audius.')
    const values = await request(`users/${match[1]}`)
    const artist = artistSummary(Array.isArray(values) ? values[0] : values)
    if (!artist || artist.id !== id) throw fail(404, 'ARTIST_NOT_FOUND', 'Artis tidak ditemukan di Audius.')
    return artist
  }

  async function artist(id) {
    const match = userId.exec(id || '')
    if (!match) return summary(id)
    const values = await request(`users/${match[1]}`)
    const user = Array.isArray(values) ? values[0] : values
    const profile = artistSummary(user)
    if (!profile || profile.id !== id) throw fail(404, 'ARTIST_NOT_FOUND', 'Artis tidak ditemukan di Audius.')
    const results = await Promise.allSettled([request(`users/${match[1]}/tracks`, { limit: 50 }), request(`users/${match[1]}/albums`, { limit: 50 })])
    if (results[0].status === 'rejected') throw results[0].reason
    return { ...profile, description: typeof user.bio === 'string' ? user.bio : '', tracks: tracks(results[0].value), albums: results[1].status === 'fulfilled' ? results[1].value.map(albumSummary).filter(Boolean) : [], singles: [], related: [], warnings: results[1].status === 'rejected' ? ['Daftar album Audius belum tersedia.'] : [], albumsComplete: results[1].status === 'fulfilled' && results[1].value.length >= (Number(user.album_count) || 0), updatedAt: Date.now(), stale: false }
  }

  async function album(id) {
    const match = albumId.exec(id || '')
    if (!match) throw fail(409, 'LEGACY_ALBUM_SOURCE', 'Album ini berasal dari katalog lama. Cari album di Audius.')
    const values = await request(`playlists/${match[1]}`)
    const raw = Array.isArray(values) ? values[0] : values
    const summary = albumSummary(raw)
    if (!summary || summary.id !== id) throw fail(404, 'ALBUM_NOT_FOUND', 'Album tidak ditemukan di Audius.')
    const valuesTracks = await request(`playlists/${match[1]}/tracks`, { limit: 100 })
    const tracklist = valuesTracks.map((value, index) => {
      const song = normalizeAudiusTrack(value)
      return song ? { ...song, album: summary.title, albumId: id, position: index + 1, playable: true } : { title: value.title || '', artist: value.user?.name || '', duration: value.duration || null, position: index + 1, playable: false }
    })
    const songs = tracklist.filter(value => value.playable)
    register(songs)
    return { ...summary, description: raw.description || '', tracks: songs, tracklist, sourceTotal: tracklist.length, updatedAt: Date.now(), stale: false }
  }

  async function trending() {
    const values = await request('tracks/trending', { time: 'week', limit: 50 })
    const songs = values.map((value, index) => {
      const song = normalizeAudiusTrack(value)
      return song ? { ...song, rank: index + 1, chartRank: index + 1, rankingSource: 'audius' } : null
    }).filter(Boolean)
    register(songs)
    if (!songs.length) throw fail(503, 'AUDIUS_TRENDING_UNAVAILABLE', 'Daftar trending Audius belum tersedia.')
    return { tracks: songs, region: 'ZZ', chartVersion: 4, chartOrigin: 'audius', chartProvider: 'audius', chartId: 'audius:trending:week', chartCountry: 'ZZ', source: 'Audius Weekly Trending', sourceUrl: 'https://audius.co/explore', sourceTotal: values.length, updatedAt: Date.now(), stale: false }
  }

  async function stream(id, req, res, { download = false } = {}) {
    const song = await metadata(id)
    if (download && !song.downloadAllowed) throw fail(403, 'AUDIUS_DOWNLOAD_NOT_ALLOWED', 'Artis tidak mengizinkan unduhan bebas untuk lagu ini. Lagu tetap dapat diputar online.')
    const range = req.headers.range
    if (range && (range.length > 100 || !/^bytes=\d*-\d*$/.test(range) || range === 'bytes=-')) throw fail(416, 'INVALID_RANGE', 'Rentang audio tidak valid.')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    streams.add(controller)
    const close = () => controller.abort()
    res.once('close', close)
    try {
      const response = await fetcher(`https://api.audius.co/v1/tracks/${trackId.exec(id)[1]}/stream?app_name=MiTune`, { headers: { 'User-Agent': 'MiTune/1.0', ...(range ? { Range: range } : {}) }, signal: controller.signal })
      clearTimeout(timer)
      if (response.status === 416) {
        res.statusCode = 416
        if (response.headers.get('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'))
        await response.body?.cancel()
        return res.end()
      }
      if (![200, 206].includes(response.status) || !/^audio\//i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel()
        throw fail(502, 'AUDIUS_STREAM_UNAVAILABLE', 'Audio Audius belum dapat dimuat. Coba lagu lain atau coba lagi sebentar.')
      }
      res.statusCode = response.status
      for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) if (response.headers.get(name)) res.setHeader(name, response.headers.get(name))
      res.setHeader('Cache-Control', 'private, no-store')
      if (req.method === 'HEAD') { await response.body?.cancel(); return res.end() }
      await pipeline(Readable.fromWeb(response.body), res)
    } catch (error) {
      if (res.destroyed) return
      if (res.headersSent) return res.destroy(error)
      throw error.status ? error : fail(502, 'AUDIUS_STREAM_UNAVAILABLE', 'Audio Audius belum dapat dimuat. Coba lagi sebentar.')
    } finally {
      clearTimeout(timer)
      res.removeListener('close', close)
      streams.delete(controller)
    }
  }

  function close() {
    for (const controller of streams) controller.abort()
    cache.clear()
    songs.clear()
  }

  return { provider: 'audius', register, lookup: id => songs.get(id) || null, metadata, search, trending, stream, preload: async id => ({ ready: true, trackId: (await metadata(id)).id }), audio: () => null, job: () => null, jobs: () => [], close, catalogue: { search: searchCatalogue, searchArtists, summary, artist, album, close } }
}

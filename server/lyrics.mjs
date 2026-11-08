import { setTimeout as delay } from 'node:timers/promises'

function error(message) {
  const result = new Error(message)
  result.status = 502
  result.code = 'LYRICS_UNAVAILABLE'
  return result
}

function title(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s*[[(](?:official\s+)?(?:music\s+video|lyric(?:s|\s+video)?|video|audio|hd|4k)[\])]\s*$/i, '').trim()
}

function identity(value) {
  return typeof value === 'string' ? value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : ''
}

function matches(record, track) {
  if (!record || typeof record !== 'object' || typeof record.duration !== 'number' || !Number.isFinite(record.duration)) return false
  const primary = identity(track.artists?.[0] || track.artist)
  const artists = typeof record.artistName === 'string' ? record.artistName.split(/\s+(?:feat\.?|ft\.?|featuring|x)\s+|\s*[&,]\s*/i) : []
  const sameArtist = identity(record.artistName) === primary || artists.some(artist => identity(artist) === primary)
  return Boolean(primary && identity(title(record.trackName)) === identity(title(track.title)) && sameArtist && Math.abs(record.duration - track.duration) <= Math.max(5, track.duration * 0.025))
}

function synced(record) {
  return typeof record?.syncedLyrics === 'string' && record.syncedLyrics.length <= 100000 && /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(record.syncedLyrics) ? record.syncedLyrics : null
}

function plain(record) {
  return typeof record?.plainLyrics === 'string' && record.plainLyrics.trim() && record.plainLyrics.length <= 100000 ? record.plainLyrics : null
}

async function query(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'MiTune/0.1 (personal music app)', Accept: 'application/json' } })
    } catch {
      if (attempt === 0) { await delay(500); continue }
      throw error('Sumber lirik belum bisa dihubungi. Coba lagi sebentar.')
    }
    if (response.status === 404) { await response.body?.cancel().catch(() => {}); return null }
    if (response.status >= 500 && attempt === 0) {
      await response.body?.cancel().catch(() => {})
      await delay(500)
      continue
    }
    if (!response.ok) { await response.body?.cancel().catch(() => {}); throw error('Sumber lirik sedang tidak tersedia. Coba lagi sebentar.') }
    try {
      const length = Number(response.headers.get('content-length'))
      if (length > 2097152) { await response.body?.cancel(); throw new Error('Response too large') }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Empty response')
      const chunks = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 2097152) { await reader.cancel(); throw new Error('Response too large') }
        chunks.push(Buffer.from(value))
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch { throw error('Sumber lirik belum memberikan respons yang bisa dibaca.') }
  }
}

export async function fetchTrackLyrics(track) {
  const songTitle = title(track.title)
  const artist = track.artists?.[0] || track.artist
  const parameters = new URLSearchParams({ track_name: songTitle, artist_name: artist, duration: String(Math.round(track.duration)) })
  if (track.album) parameters.set('album_name', track.album)
  let record = await query(`https://lrclib.net/api/get?${parameters}`)
  if (!record || !matches(record, track) || (!synced(record) && record.instrumental !== true)) {
    const search = new URLSearchParams({ track_name: songTitle, artist_name: artist })
    let results
    try { results = await query(`https://lrclib.net/api/search?${search}`) }
    catch (failure) { if (!record || !matches(record, track) || !plain(record)) throw failure; results = [] }
    const candidates = Array.isArray(results) ? results.filter(item => matches(item, track)) : []
    if (record && matches(record, track) && !candidates.some(item => item.id === record.id)) candidates.push(record)
    candidates.sort((a, b) => Number(Boolean(synced(b))) - Number(Boolean(synced(a))) || Number(identity(b.albumName) === identity(track.album)) - Number(identity(a.albumName) === identity(track.album)) || Math.abs(a.duration - track.duration) - Math.abs(b.duration - track.duration))
    record = candidates[0] || null
  }
  if (!record || !matches(record, track) || (!plain(record) && !synced(record) && record.instrumental !== true)) return { plainLyrics: null, syncedLyrics: null, instrumental: false, source: 'LRCLIB', matched: false }
  return {
    plainLyrics: plain(record),
    syncedLyrics: synced(record),
    instrumental: record.instrumental === true,
    source: 'LRCLIB',
    matched: true,
    sourceId: record.id
  }
}

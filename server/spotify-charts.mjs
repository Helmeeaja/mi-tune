import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceUrl = 'https://kworb.net/spotify/country/global_daily.html'
const dayMs = 86400000

function fail(code, message) { return Object.assign(new Error(message), { status: 503, code }) }
function normalize(value) { return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\$/g, 's').replace(/[^\p{L}\p{N}]/gu, '') }
function title(value) { return normalize(String(value || '').replace(/\s*[([]\s*(?:feat\.?|ft\.?|featuring|with|w\/)\s+[^\])]+[\])]/gi, '').replace(/\s+-\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, '')) }
function versions(value) { return ['live', 'remix', 'remaster', 'acoustic', 'instrumental', 'karaoke', 'cover', 'spedup', 'slowed', 'nightcore'].filter(word => normalize(value).includes(word)) }
function validSong(song) { return song && /^yt:[A-Za-z0-9_-]{11}$/.test(song.id || '') && song.source === 'youtube-music' && song.type === 'song' && song.musicType === 'MUSIC_VIDEO_TYPE_ATV' && typeof song.title === 'string' && Array.isArray(song.artists) && song.artists.length > 0 && Number.isFinite(song.duration) && song.duration > 0 }

export function matchSpotifyTrack(entry, candidates) {
  if (!entry || !/^[A-Za-z0-9]{22}$/.test(entry.spotifyTrackId || '') || !Array.isArray(entry.artists) || !entry.artists.length) return null
  const wantedTitle = title(entry.title)
  const wantedVersions = versions(entry.title)
  return candidates.filter(validSong).find(song => {
    if (title(song.title) !== wantedTitle || versions(song.title).join(',') !== wantedVersions.join(',')) return false
    const names = song.artists.map(artist => normalize(typeof artist === 'string' ? artist.replace(/\s*-\s*Topic$/i, '') : artist?.name))
    const credits = normalize(song.title)
    return entry.artists.every((artist, index) => names.includes(normalize(artist)) || (index > 0 && credits.includes(normalize(artist))))
  }) || null
}

export function parseSpotifyChart(html, { pythonBinary = process.env.MUSIC_PYTHON || join(project, '.venv/bin/python'), now = Date.now() } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(pythonBinary, [join(project, 'server/spotify_charts.py')], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let ended = false
    const finish = (error, value) => { if (ended) return; ended = true; clearTimeout(timer); error ? reject(error) : resolveResult(value) }
    const timer = setTimeout(() => { child.kill('SIGTERM'); finish(fail('CHART_PARSE_TIMEOUT', 'Chart Spotify belum bisa dibaca. Coba lagi nanti.')) }, 15000)
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 300000) { child.kill('SIGTERM'); finish(fail('INVALID_SPOTIFY_CHART', 'Data chart Spotify tidak lengkap.')) } })
    child.stderr.on('data', () => {})
    child.on('error', () => finish(fail('CHART_PARSER_UNAVAILABLE', 'Pembaca chart Spotify belum tersedia.')))
    child.on('close', code => {
      if (ended) return
      let data
      try { data = JSON.parse(output) } catch { return finish(fail('INVALID_SPOTIFY_CHART', 'Data chart Spotify belum bisa dibaca.')) }
      if (code || data.error || data.sourceTotal !== 200 || data.entries?.length !== 200) return finish(fail('INVALID_SPOTIFY_CHART', 'Data chart Spotify tidak lengkap. Coba lagi nanti.'))
      const date = Date.parse(`${data.chartDate}T00:00:00Z`)
      if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== data.chartDate || date > now || now - date > 5 * dayMs) return finish(fail('OUTDATED_SPOTIFY_CHART', 'Chart Spotify terbaru belum tersedia. Menunggu pembaruan sumber.'))
      finish(null, data)
    })
    child.stdin.on('error', () => {})
    child.stdin.end(html)
  })
}

export function createSpotifyCharts({ dataDir, search, isRegistered, fetchImpl = fetch, now = Date.now, parse = parseSpotifyChart, sourceTtlMs = 900000, matchTtlMs = 7 * dayMs, initialLimit = 30, concurrency = 2, onUpdate } = {}) {
  if (!dataDir || typeof search !== 'function') throw new Error('Direktori chart dan pencarian musik diperlukan.')
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const matchesFile = join(dataDir, 'spotify-matches.json')
  const chartFile = join(dataDir, 'spotify-chart.json')
  const snapshotFile = join(dataDir, 'spotify-feed.json')
  const matches = new Map()
  let chart = null
  let lastFeed = null
  let sourceFetchedAt = 0
  let pending = null
  let mapping = null
  let closed = false
  let fetchAbort = null

  function stored(path) { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }
  function persist(path, value) { const temp = `${path}.tmp`; writeFileSync(temp, JSON.stringify(value), { mode: 0o600 }); renameSync(temp, path) }
  const savedMatches = stored(matchesFile)
  if (savedMatches?.version === 1 && Array.isArray(savedMatches.entries)) for (const [id, value] of savedMatches.entries) if (/^[A-Za-z0-9]{22}$/.test(id) && value && Number.isFinite(value.at) && (!value.track || validSong(value.track))) matches.set(id, value)
  const savedChart = stored(chartFile)
  if (savedChart?.version === 1 && savedChart.value?.sourceTotal === 200 && savedChart.value.entries?.length === 200 && /^\d{4}-\d{2}-\d{2}$/.test(savedChart.value.chartDate || '')) { chart = savedChart.value; sourceFetchedAt = savedChart.at || 0 }
  const savedFeed = stored(snapshotFile)
  if (savedFeed?.chartOrigin === 'spotify' && savedFeed.region === 'ZZ' && savedFeed.chartVersion === 2 && savedFeed.sourceUrl === sourceUrl && Array.isArray(savedFeed.tracks) && savedFeed.tracks.every(validSong)) lastFeed = savedFeed

  function reusable(entry) {
    const value = matches.get(entry.spotifyTrackId)
    if (!value || now() - value.at >= (value.track ? matchTtlMs : 300000)) return false
    return value.track ? (!isRegistered || isRegistered(value.track.id)) && Boolean(matchSpotifyTrack(entry, [value.track])) : value.title === entry.title && JSON.stringify(value.artists) === JSON.stringify(entry.artists)
  }

  function snapshot(value, stale = false, error = '') {
    const tracks = []
    const unavailable = []
    const ids = new Set()
    const entries = value.entries.map(entry => {
      const match = matches.get(entry.spotifyTrackId)
      if (!match || !reusable(entry)) return { ...entry, status: 'pending' }
      if (!match.track) { unavailable.push({ ...entry, reason: match.reason }); return { ...entry, status: 'unavailable', reason: match.reason } }
      if (ids.has(match.track.id)) { unavailable.push({ ...entry, reason: 'duplicate-release' }); return { ...entry, status: 'unavailable', reason: 'duplicate-release' } }
      ids.add(match.track.id)
      tracks.push({ ...match.track, chartRank: entry.chartRank, chartChange: entry.chartChange, spotifyId: entry.spotifyTrackId, chartTitle: entry.title, chartArtists: entry.artists, spotifyStreams: entry.streams, rankingSource: 'Spotify Global Top 200', popularitySource: 'spotify' })
      return { ...entry, status: 'matched', trackId: match.track.id }
    })
    const pendingCount = entries.filter(entry => entry.status === 'pending').length
    if (tracks.length + unavailable.length + pendingCount !== value.sourceTotal) throw fail('INVALID_CHART_COUNTS', 'Jumlah lagu di chart belum cocok. Coba lagi.')
    return { tracks, chartEntries: entries, sourceTotal: value.sourceTotal, matchedCount: tracks.length, unavailable, unavailableCount: unavailable.length, pendingCount, mappingComplete: pendingCount === 0, chartOrigin: 'spotify', chartVersion: 2, feedVersion: 2, chartId: `spotify_global_${value.chartDate}`, chartDate: value.chartDate, chartCountry: 'ZZ', region: 'ZZ', source: 'Spotify Global Top 200 · Kworb', sourceUrl, metadataSource: 'youtube-music', playbackSource: 'youtube-music', updatedAt: sourceFetchedAt, matchedAt: now(), stale, ...(error ? { sourceError: error } : {}) }
  }

  async function mapEntries(entries) {
    let cursor = 0
    async function worker() {
      while (!closed && cursor < entries.length) {
        const entry = entries[cursor++]
        if (reusable(entry)) continue
        try {
          const result = await search(`${entry.title} ${entry.artists[0]}`)
          const track = matchSpotifyTrack(entry, Array.isArray(result) ? result : result?.tracks || [])
          matches.set(entry.spotifyTrackId, { at: now(), title: entry.title, artists: entry.artists, ...(track ? { track } : { reason: 'no-matching-recording' }) })
        } catch {
          matches.set(entry.spotifyTrackId, { at: now(), title: entry.title, artists: entry.artists, reason: 'catalogue-unavailable' })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(2, concurrency)) }, worker))
    if (!closed) persist(matchesFile, { version: 1, entries: [...matches.entries()] })
  }

  function finishMapping(value) {
    if (mapping || closed) return
    const rest = value.entries.filter(entry => !reusable(entry))
    if (!rest.length) return
    mapping = mapEntries(rest).then(() => {
      if (closed || chart !== value) return
      lastFeed = snapshot(value)
      persist(snapshotFile, lastFeed)
      onUpdate?.(lastFeed)
    }).catch(() => {}).finally(() => { mapping = null })
  }

  async function getSource() {
    fetchAbort = new AbortController()
    const timer = setTimeout(() => fetchAbort?.abort(), 20000)
    try {
      const response = await fetchImpl(sourceUrl, { redirect: 'error', credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'MiTune chart reference/0.2' }, signal: fetchAbort.signal })
      if (!response.ok) throw fail('SPOTIFY_CHART_UNAVAILABLE', 'Chart Spotify belum bisa dimuat. Coba lagi nanti.')
      let html = ''
      if (response.body?.getReader) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          html += decoder.decode(value, { stream: true })
          if (html.length > 524288) { await reader.cancel(); throw fail('INVALID_SPOTIFY_CHART', 'Data chart Spotify terlalu besar.') }
        }
        html += decoder.decode()
      } else html = await response.text()
      if (html.length > 524288) throw fail('INVALID_SPOTIFY_CHART', 'Data chart Spotify terlalu besar.')
      return await parse(html, { now: now() })
    } finally { clearTimeout(timer); fetchAbort = null }
  }

  async function trending({ refresh = false } = {}) {
    if (closed) throw fail('CHART_CLOSED', 'Chart sedang ditutup.')
    const date = chart ? Date.parse(`${chart.chartDate}T00:00:00Z`) : 0
    if (chart && !refresh && now() - sourceFetchedAt < sourceTtlMs && now() - date <= 5 * dayMs && date <= now()) {
      finishMapping(chart)
      return snapshot(chart)
    }
    if (pending) return pending
    pending = (async () => {
      try {
        const value = await getSource()
        chart = value
        sourceFetchedAt = now()
        if (!closed) persist(chartFile, { version: 1, at: sourceFetchedAt, value })
        await mapEntries(value.entries.slice(0, Math.max(1, Math.min(200, initialLimit))))
        lastFeed = snapshot(value)
        if (!closed) persist(snapshotFile, lastFeed)
        finishMapping(value)
        return lastFeed
      } catch (error) {
        if (lastFeed?.tracks.length) return { ...lastFeed, stale: true, sourceError: 'Chart Spotify belum bisa diperbarui. Menampilkan chart terakhir yang berhasil dimuat.' }
        throw error.status ? error : fail('SPOTIFY_CHART_UNAVAILABLE', 'Chart Spotify belum bisa dimuat. Coba lagi nanti.')
      }
    })().finally(() => { pending = null })
    return pending
  }

  function close() { closed = true; fetchAbort?.abort() }
  return { trending, close }
}

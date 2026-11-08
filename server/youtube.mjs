import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { proxyPlayback, validatePlaybackUrl } from './playback.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

export function validateTrackId(trackId) {
  if (typeof trackId !== 'string' || !/^yt:[A-Za-z0-9_-]{11}$/.test(trackId)) throw fail(400, 'INVALID_TRACK', 'Identitas lagu tidak valid.')
  return trackId.slice(3)
}

export function normalizeSong(row, { catalogueType } = {}) {
  const release = catalogueType === 'album-track' && /^MPRE[A-Za-z0-9_-]{4,124}$/.test(row?.albumId || '')
  if (row?.resultType !== 'song' || (row.videoType !== 'MUSIC_VIDEO_TYPE_ATV' && !(release && row.videoType === 'MUSIC_VIDEO_TYPE_OMV'))) return null
  if (!/^[A-Za-z0-9_-]{11}$/.test(row.videoId || '') || !Array.isArray(row.artists) || !row.artists.length) return null
  if (!row.artists.every(name => typeof name === 'string' && name.length > 0 && name.length < 200)) return null
  if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 300) return null
  if (!Number.isFinite(row.duration) || row.duration < 15 || row.duration > 1800) return null
  let thumbnail = ''
  try {
    const url = new URL(row.thumbnail)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && ['i.ytimg.com', 'lh3.googleusercontent.com', 'yt3.googleusercontent.com'].includes(url.hostname)) thumbnail = url.href
  } catch {}
  const id = `yt:${row.videoId}`
  const artistRefs = Array.isArray(row.artistRefs) ? [...new Map(row.artistRefs.filter(artist => artist && /^UC[A-Za-z0-9_-]{22}$/.test(artist.id) && typeof artist.name === 'string' && row.artists.includes(artist.name)).map(artist => [artist.id, { id: artist.id, name: artist.name }])).values()] : []
  const albumId = typeof row.albumId === 'string' && /^MPRE[A-Za-z0-9_-]{4,124}$/.test(row.albumId) ? row.albumId : null
  return { id, source: 'youtube-music', type: 'song', musicType: row.videoType, ...(release ? { catalogueType: 'album-track' } : {}), title: row.title, artist: row.artists.join(', '), artists: row.artists, artistRefs, album: typeof row.album === 'string' ? row.album : '', albumId, duration: row.duration, thumbnail, coverUrl: `/api/tracks/${encodeURIComponent(id)}/cover`, sourceUrl: `https://music.youtube.com/watch?v=${row.videoId}` }
}

function validChart(value) {
  if (!value || value.region !== 'ZZ' || value.chartVersion !== 3 || value.chartOrigin !== 'spotify' || value.chartProvider !== 'spotify' || value.chartId !== '37i9dQZEVXbMDoHDwVN2tF' || value.sourceUrl !== 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF' || typeof value.source !== 'string' || !value.source || !Number.isFinite(value.updatedAt) || !Number.isInteger(value.sourceTotal) || value.sourceTotal < 1 || !Array.isArray(value.tracks) || !value.tracks.length || value.tracks.length > value.sourceTotal) return false
  if (new Set(value.tracks.map(track => track.id)).size !== value.tracks.length) return false
  return value.tracks.every(track => {
    const song = normalizeSong({ resultType: track.type, videoType: track.musicType, videoId: typeof track.id === 'string' ? track.id.slice(3) : '', title: track.title, artists: track.artists, artistRefs: track.artistRefs, album: track.album, albumId: track.albumId, duration: track.duration, thumbnail: track.thumbnail })
    return song && song.id === track.id && track.source === 'youtube-music' && Number.isInteger(track.chartRank) && track.chartRank > 0 && track.chartRank <= value.sourceTotal && /^spotify:track:[A-Za-z0-9]{22}$/.test(track.spotifyUri || '') && track.rankingSource === 'spotify'
  })
}

export function createYoutubeService(options = {}) {
  const dataDir = options.dataDir || join(project, 'data')
  const mediaDir = join(dataDir, 'media')
  const catalogPath = join(dataDir, 'catalog.json')
  const chartPath = join(dataDir, 'trending.json')
  const chartTtl = 15 * 60 * 1000
  let chart
  let chartRequest
  const executable = options.executable || process.env.YT_DLP_BINARY || 'yt-dlp'
  const python = options.pythonBinary || process.env.MUSIC_PYTHON || join(project, '.venv/bin/python')
  const maxPending = options.maxPending || 5
  const maxCacheBytes = options.maxCacheBytes || Number(process.env.MI_TUNE_MAX_CACHE_BYTES) || 1073741824
  const tracks = new Map()
  const searches = new Map()
  const inFlight = new Map()
  const playbackSources = new Map()
  const playbackRequests = new Map()
  const jobs = new Map()
  const queued = []
  const running = new Set()
  let active = false
  let closed = false
  mkdirSync(mediaDir, { recursive: true, mode: 0o700 })
  if (existsSync(catalogPath)) {
    const saved = JSON.parse(readFileSync(catalogPath, 'utf8'))
    if (!Array.isArray(saved)) throw new Error('Cache katalog tidak valid.')
    for (const track of saved) {
      const valid = normalizeSong({ resultType: track.type, videoType: track.musicType, videoId: typeof track.id === 'string' ? track.id.slice(3) : '', title: track.title, artists: track.artists, artistRefs: track.artistRefs, album: track.album, albumId: track.albumId, duration: track.duration, thumbnail: track.thumbnail }, { catalogueType: track.catalogueType })
      if (valid && valid.id === track.id) tracks.set(valid.id, { ...valid, fileSize: track.fileSize, audioDuration: track.audioDuration, license: track.license })
    }
  }

  function save() {
    const temporary = `${catalogPath}.tmp`
    writeFileSync(temporary, JSON.stringify([...tracks.values()]), { mode: 0o600 })
    renameSync(temporary, catalogPath)
  }

  function registered(trackId) {
    validateTrackId(trackId)
    const track = tracks.get(trackId)
    if (!track || track.type !== 'song' || (track.musicType !== 'MUSIC_VIDEO_TYPE_ATV' && !(track.musicType === 'MUSIC_VIDEO_TYPE_OMV' && track.catalogueType === 'album-track'))) throw fail(404, 'SONG_NOT_REGISTERED', 'Lagu belum ditemukan di katalog YouTube Music. Cari judul atau artis terlebih dahulu.')
    return track
  }

  function register(values) {
    const result = []
    for (const track of values) {
      if (track?.source !== 'youtube-music') continue
      const song = normalizeSong({ resultType: track.type, videoType: track.musicType, videoId: typeof track.id === 'string' ? track.id.slice(3) : '', title: track.title, artists: track.artists, artistRefs: track.artistRefs, album: track.album, albumId: track.albumId, duration: track.duration, thumbnail: track.thumbnail }, { catalogueType: track.catalogueType })
      if (!song || song.id !== track.id) continue
      tracks.set(song.id, { ...tracks.get(song.id), ...song })
      result.push(tracks.get(song.id))
    }
    if (result.length) save()
    return result
  }

  function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) return
    try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
      }
    }, 1500)
    timer.unref()
  }

  function run(program, args, { timeout = 45000, onLine } = {}) {
    if (closed) return Promise.reject(fail(503, 'SHUTTING_DOWN', 'Server sedang berhenti.'))
    return new Promise((resolve, reject) => {
      const child = spawn(program, args, { cwd: project, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
      const started = performance.now()
      const phase = args.includes('--dump-single-json') ? 'metadata' : program === python ? 'search' : program === 'ffprobe' ? 'probe' : 'audio'
      const trace = value => { if (process.env.SOURCE_DEBUG === '1') console.log(JSON.stringify({ phase, pid: child.pid, elapsedMs: Math.round(performance.now() - started), ...value })) }
      trace({ event: 'spawn' })
      running.add(child)
      let stdout = ''
      let stderr = ''
      let lineBuffer = ''
      let expired = false
      const timer = setTimeout(() => { trace({ event: 'timeout', exitCode: child.exitCode, stdoutBytes: stdout.length, stderrBytes: stderr.length }); expired = true; stop(child) }, timeout)
      function receive(chunk, errorStream = false) {
        const value = chunk.toString()
        if (errorStream) stderr = (stderr + value).slice(-6000)
        else {
          stdout += value
          if (stdout.length > 6291456) { expired = true; stop(child) }
        }
        if (onLine) {
          lineBuffer += value
          const lines = lineBuffer.split(/\r?\n/)
          lineBuffer = lines.pop()
          for (const line of lines) onLine(line)
        }
      }
      child.stdout.on('data', chunk => receive(chunk))
      child.stderr.on('data', chunk => receive(chunk, true))
      child.once('error', error => {
        clearTimeout(timer)
        running.delete(child)
        reject(fail(503, 'SOURCE_TOOL_MISSING', error.code === 'ENOENT' ? 'Komponen sumber musik belum terpasang. Periksa Python, yt-dlp, dan FFmpeg.' : 'Komponen sumber musik tidak dapat dijalankan.'))
      })
      child.once('exit', (code, signal) => trace({ event: 'exit', code, signal, stdoutBytes: stdout.length, stderrBytes: stderr.length }))
      child.once('close', code => {
        trace({ event: 'close', code, stdoutBytes: stdout.length, stderrBytes: stderr.length })
        clearTimeout(timer)
        running.delete(child)
        if (expired) return reject(fail(504, 'SOURCE_TIMEOUT', 'Sumber musik terlalu lama merespons. Coba lagi.'))
        if (code !== 0) {
          const detail = stderr.replace(/https?:\/\/\S+/g, '[tautan sumber]').trim().slice(-450)
          if (process.env.SOURCE_DEBUG === '1') console.error('Mi Tune source stderr:', stderr.replace(/https?:\/\/\S+/g, '[tautan sumber]').trim().slice(-3000))
          if (/sign in to confirm|not a bot|HTTP Error (403|429)|too many requests|request blocked/i.test(stderr)) return reject(fail(503, 'SOURCE_RESTRICTED', 'Sumber audio membatasi koneksi server. Lagu tidak dapat diputar dari host ini saat ini.'))
          if (/requested format is not available|only images are available|no video formats found/i.test(stderr)) return reject(fail(503, 'AUDIO_FORMAT_UNAVAILABLE', 'Sumber belum menyediakan format audio yang bisa diakses server ini.'))
          return reject(fail(502, 'SOURCE_UNAVAILABLE', process.env.NODE_ENV === 'production' ? 'Sumber musik tidak dapat diakses saat ini. Coba lagi nanti.' : detail || 'Sumber musik tidak dapat diakses saat ini.'))
        }
        resolve(stdout)
      })
    })
  }

  const playerClient = process.env.YT_DLP_PLAYER_CLIENT || ''
  const common = ['--ignore-config', '--no-plugin-dirs', '--no-cache-dir', '--no-playlist', '--force-ipv4', '--socket-timeout', '15', '--retries', '1', '--extractor-retries', '1', '--no-js-runtimes', '--js-runtimes', 'node', '--no-remote-components', ...(playerClient ? ['--extractor-args', `youtube:player_client=${playerClient}`] : [])]
  const invidiousInstances = (options.invidiousInstances || process.env.INVIDIOUS_INSTANCES || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(value => /^https:\/\/[^\s]+$/.test(value))

  async function invidiousSource(trackId, song) {
    const id = validateTrackId(trackId)
    for (const base of invidiousInstances) {
      try {
        const probe = `${base}/latest_version?id=${encodeURIComponent(id)}&itag=140&local=true`
        const response = await (options.fetcher || fetch)(probe, {
          method: 'GET',
          headers: { Range: 'bytes=0-1', 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.youtube.com/' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        })
        const type = (response.headers.get('content-type') || '').toLowerCase()
        if ([200, 206].includes(response.status) && type.startsWith('audio/')) {
          const url = response.url || probe
          await response.body?.cancel()
          let expiresAt = Date.now() + 600000
          try {
            const expiry = Number(new URL(url).searchParams.get('expire')) * 1000
            if (expiry > 0) expiresAt = Math.min(expiresAt, expiry - 30000)
          } catch {}
          return { url, contentType: type.startsWith('audio/webm') ? 'audio/webm' : 'audio/mp4', expiresAt, track: { ...song } }
        }
        await response.body?.cancel()
        if (process.env.SOURCE_DEBUG === '1') console.error('Mi Tune Invidious probe:', base, response.status, type)
      } catch (error) {
        if (process.env.SOURCE_DEBUG === '1') console.error('Mi Tune Invidious probe failed:', base, error.code || error.message, error.cause?.code || error.cause?.message || '')
      }
    }
    return null
  }

  async function search(query, { refresh = false } = {}) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 160 || /https?:\/\/|www\./i.test(query)) throw fail(400, 'INVALID_SEARCH', 'Cari judul lagu atau artis, bukan URL video. Gunakan 2–160 karakter.')
    const key = query.trim()
    const cached = searches.get(key)
    if (!refresh && cached && Date.now() - cached.at < 300000) return cached.tracks
    if (inFlight.has(key)) return inFlight.get(key)
    if (inFlight.size >= 3) throw fail(429, 'SEARCH_BUSY', 'Pencarian sedang sibuk. Coba lagi sebentar.')
    const promise = (async () => {
      const raw = JSON.parse(await run(python, [join(project, 'server/music_search.py'), key], { timeout: 75000 }))
      if (!Array.isArray(raw)) throw fail(502, 'INVALID_SOURCE_RESPONSE', 'Respons sumber musik tidak valid.')
      const result = []
      const seen = new Set()
      for (const row of raw) {
        const song = normalizeSong(row)
        if (song && !seen.has(song.id)) {
          tracks.set(song.id, { ...tracks.get(song.id), ...song })
          result.push(tracks.get(song.id))
          seen.add(song.id)
        }
        if (result.length >= 20) break
      }
      save()
      searches.set(key, { at: Date.now(), tracks: result })
      return result
    })().finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }

  async function playbackSource(trackId, refresh = false) {
    const song = registered(trackId)
    const cached = playbackSources.get(trackId)
    if (!refresh && cached && cached.expiresAt > Date.now()) return { ...cached, track: song }
    if (playbackRequests.has(trackId)) return playbackRequests.get(trackId)
    if (playbackRequests.size >= 2) throw fail(429, 'SOURCE_BUSY', 'Sumber musik sedang menyiapkan lagu lain. Coba lagi sebentar.')
    const pending = (async () => {
      const id = validateTrackId(trackId)
      let info
      try {
        info = JSON.parse(await run(executable, [...common, '--skip-download', '--dump-single-json', '-f', '140/bestaudio[ext=m4a][protocol=https]/bestaudio[protocol=https]/bestaudio', '--', `https://www.youtube.com/watch?v=${id}`], { timeout: 60000 }))
      } catch (error) {
        const fallback = await invidiousSource(trackId, song)
        if (!fallback) throw error
        console.error('Mi Tune: yt-dlp diblokir, memakai sumber Invidious.')
        playbackSources.set(trackId, fallback)
        while (playbackSources.size > 64) playbackSources.delete(playbackSources.keys().next().value)
        return fallback
      }
      if (info.id !== id || info.is_live || info.has_drm || !Number.isFinite(info.duration) || info.duration < 15 || info.duration > 1800) throw fail(422, 'UNSUPPORTED_SONG', 'Lagu ini tidak dapat disiapkan: live, durasi di luar batas, atau format terlindungi.')
      if (Array.isArray(info.categories) && info.categories.length && !info.categories.includes('Music')) throw fail(422, 'NOT_MUSIC', 'Konten ini bukan kategori musik dan tidak dimasukkan ke Mi Tune.')
      if (Math.abs(info.duration - song.duration) > Math.max(10, song.duration * 0.1)) throw fail(422, 'DURATION_MISMATCH', 'Versi audio tidak cocok dengan lagu di katalog.')
      const updated = { ...registered(trackId), duration: info.duration, license: info.license || null }
      let url = null
      let contentType = null
      let expiresAt = Date.now() + 600000
      if (info.protocol === 'https' && info.vcodec === 'none' && info.acodec && info.acodec !== 'none' && ['m4a', 'webm'].includes(info.ext)) {
        const source = validatePlaybackUrl(info.url)
        const expiry = Number(source.searchParams.get('expire')) * 1000
        if (expiry > 0) expiresAt = Math.min(expiresAt, expiry - 30000)
        if (expiresAt <= Date.now()) throw fail(502, 'SOURCE_EXPIRED', 'Tautan audio sudah kedaluwarsa. Coba lagi sebentar.')
        if (info.filesize && info.filesize > 67108864) throw fail(422, 'AUDIO_TOO_LARGE', 'Ukuran audio melewati batas Mi Tune.')
        url = source.href
        contentType = info.ext === 'm4a' ? 'audio/mp4' : 'audio/webm'
      }
      if (!url) {
        const fallback = await invidiousSource(trackId, song)
        if (fallback) {
          url = fallback.url
          contentType = fallback.contentType
          expiresAt = fallback.expiresAt
        }
      }
      tracks.set(trackId, updated)
      save()
      const source = { track: updated, url, contentType, expiresAt }
      playbackSources.set(trackId, source)
      while (playbackSources.size > 64) playbackSources.delete(playbackSources.keys().next().value)
      return source
    })().finally(() => playbackRequests.delete(trackId))
    playbackRequests.set(trackId, pending)
    return pending
  }

  async function metadata(trackId) {
    return registered(trackId)
  }

  async function preload(trackId) {
    if (audio(trackId)) return { ready: true, cached: true }
    const source = await playbackSource(trackId)
    return { ready: Boolean(source.url), cached: false }
  }

  async function stream(trackId, req, res) {
    registered(trackId)
    return proxyPlayback(req, res, refresh => playbackSource(trackId, refresh), options.fetcher || fetch)
  }

  function audio(trackId) {
    const song = registered(trackId)
    const path = join(mediaDir, `${validateTrackId(trackId)}.mp3`)
    if (!song.fileSize || !existsSync(path)) return undefined
    const size = statSync(path).size
    return size === song.fileSize ? { path, size, mime: 'audio/mpeg', track: song } : undefined
  }

  function emit(job) { options.onEvent?.({ ...job }) }

  async function pump() {
    if (active || closed || !queued.length) return
    active = true
    const job = queued.shift()
    const id = validateTrackId(job.trackId)
    const target = join(mediaDir, `${id}.mp3`)
    try {
      job.status = 'downloading'
      job.stage = 'Memeriksa sumber lagu'
      emit(job)
      job.track = await metadata(job.trackId)
      const used = readdirSync(mediaDir).filter(name => /^[A-Za-z0-9_-]{11}\.mp3$/.test(name)).reduce((total, name) => total + statSync(join(mediaDir, name)).size, 0)
      if (used + job.track.duration * 16000 > maxCacheBytes) throw fail(507, 'CACHE_FULL', 'Cache audio server penuh. Atur kapasitas cache sebelum menambah lagu.')
      job.stage = 'Mengambil audio'
      emit(job)
      await run(executable, [...common, '--fragment-retries', '1', '--max-filesize', '64M', '-f', '140/bestaudio[ext=m4a]/bestaudio[protocol=m3u8_native]/bestaudio', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '128K', '--newline', '--no-colors', '--no-quiet', '--progress', '--progress-template', 'download:MT_PROGRESS:%(progress._percent_str)s', '--no-mtime', '--paths', mediaDir, '--output', `${id}.%(ext)s`, '--', `https://www.youtube.com/watch?v=${id}`], {
        timeout: 240000,
        onLine: line => {
          const percent = /MT_PROGRESS:\s*([\d.]+)%/.exec(line)
          if (percent && job.status === 'downloading') { job.progress = Math.min(100, Number(percent[1])); emit(job) }
          if (line.includes('[ExtractAudio]')) { job.status = 'converting'; job.stage = 'Mengonversi ke MP3'; emit(job) }
        },
      })
      const probe = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,format_name', '-of', 'json', target], { timeout: 15000 }))
      const duration = Number(probe.format?.duration)
      const size = statSync(target).size
      if (!Number.isFinite(duration) || Math.abs(duration - job.track.duration) > 3 || size <= 0 || size > 67108864 || probe.format?.format_name !== 'mp3') throw fail(502, 'INCOMPLETE_AUDIO', 'Audio yang diterima tidak lengkap. Coba siapkan ulang.')
      const completed = { ...job.track, fileSize: size, audioDuration: duration }
      tracks.set(job.trackId, completed)
      save()
      job.track = completed
      job.status = 'ready'
      job.progress = 100
      job.stage = 'Audio siap diputar'
      emit(job)
    } catch (error) {
      job.status = 'failed'
      job.error = `${job.stage}: ${error.message}`
      job.stage = 'Audio tidak dapat disiapkan'
      for (const name of readdirSync(mediaDir)) if (name.startsWith(`${id}.`)) rmSync(join(mediaDir, name), { force: true })
      emit(job)
    } finally {
      active = false
      if (!closed) queueMicrotask(pump)
    }
  }

  async function trending() {
    if (chart && Date.now() - chart.updatedAt < chartTtl) return { ...chart, stale: false }
    if (!chart && existsSync(chartPath)) {
      try {
        const stored = JSON.parse(readFileSync(chartPath, 'utf8'))
        if (validChart(stored)) {
          chart = stored
          for (const track of chart.tracks) tracks.set(track.id, { ...tracks.get(track.id), ...track })
          if (Date.now() - chart.updatedAt < chartTtl) return { ...chart, stale: false }
        }
      } catch { }
    }
    if (chartRequest) return chartRequest
    chartRequest = (async () => {
      try {
        const raw = JSON.parse(await run(python, [join(project, 'server/music_charts.py')], { timeout: 95000 }))
        const songs = raw.tracks.map(item => {
          const track = normalizeSong(item)
          return track && { ...track, chartRank: item.chartRank, spotifyId: item.spotifyId, spotifyUri: item.spotifyUri, spotifyDuration: item.spotifyDuration, chartTitle: item.chartTitle, chartArtists: item.chartArtists, rankingSource: item.rankingSource }
        }).filter(Boolean)
        const snapshot = { ...raw, tracks: songs, stale: false }
        if (songs.length !== raw.tracks.length || !validChart(snapshot)) throw fail(502, 'INVALID_CHART', 'Data chart musik belum dapat divalidasi.')
        for (const track of songs) tracks.set(track.id, { ...tracks.get(track.id), ...track })
        chart = snapshot
        save()
        writeFileSync(chartPath, JSON.stringify(chart), { mode: 0o600 })
        return chart
      } catch (error) {
        if (chart) return { ...chart, stale: true }
        throw fail(503, 'CHART_UNAVAILABLE', 'Daftar Spotify belum bisa dimuat. Coba lagi nanti.')
      } finally { chartRequest = undefined }
    })()
    return chartRequest
  }

  async function prepare(trackId) {
    const track = registered(trackId)
    const existing = [...jobs.values()].find(job => job.trackId === trackId && ['queued', 'downloading', 'converting'].includes(job.status))
    if (existing) return { ...existing }
    const cached = audio(trackId)
    if (!cached && queued.length >= maxPending) throw fail(429, 'QUEUE_FULL', 'Antrean audio penuh. Tunggu satu lagu selesai.')
    const job = { id: randomUUID(), trackId, status: cached ? 'ready' : 'queued', progress: cached ? 100 : 0, stage: cached ? 'Audio siap diputar' : 'Menunggu antrean', error: null, track }
    jobs.set(job.id, job)
    if (jobs.size > 300) for (const [key, previous] of jobs) { if (['ready', 'failed'].includes(previous.status) && key !== job.id) jobs.delete(key); if (jobs.size <= 200) break }
    if (!cached) { queued.push(job); queueMicrotask(pump) }
    return { ...job }
  }

  function close() {
    closed = true
    playbackSources.clear()
    for (const child of running) stop(child)
    for (const job of queued.splice(0)) { job.status = 'failed'; job.error = 'Server dihentikan.'; emit(job) }
  }

  return { search, trending, register, lookup: trackId => tracks.get(`yt:${validateTrackId(trackId)}`), metadata, preload, stream, prepare, job: jobId => jobs.has(jobId) ? { ...jobs.get(jobId) } : undefined, audio, close }
}

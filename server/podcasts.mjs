import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync, readdirSync, createReadStream, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { proxyPlayback } from './playback.mjs'
import { resolveRange } from './range.mjs'
import { encodePodcastAudio } from './podcast-audio.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const episodePattern = /^podcast:yt:([A-Za-z0-9_-]{11})$/
const creatorPattern = /^UC[A-Za-z0-9_-]{22}$/
const essayCreator = 'UCd3PgaVcVCgfT_W_i78n0zg'
const images = new Set(['i.ytimg.com', 'lh3.googleusercontent.com', 'yt3.googleusercontent.com', 'yt3.ggpht.com'])

function fail(status, code, message) { return Object.assign(new Error(message), { status, code }) }
function image(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && images.has(url.hostname) ? url.href : '' } catch { return '' } }
function unique(values) { return [...new Map(values.filter(Boolean).map(value => [value.id, value])).values()] }

export function normalizePodcastEpisode(value) {
  if (!value || !episodePattern.test(value.id || '') || value.type !== 'episode' || !creatorPattern.test(value.creatorId || '') || typeof value.title !== 'string' || !value.title.trim() || !Number.isFinite(value.duration) || value.duration <= 0 || value.duration > 28800 || typeof value.artist !== 'string' || !value.artist.trim()) return null
  if (value.source === 'youtube-creator-audio') {
    if (value.creatorId !== essayCreator || value.contentKind !== 'audio-essay') return null
  } else if (value.source !== 'youtube-music-podcast' || value.musicType !== 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE') return null
  const thumbnail = image(value.thumbnail)
  const publishedAt = typeof value.publishedAt === 'string' && Number.isFinite(Date.parse(value.publishedAt)) && Date.parse(value.publishedAt) <= Date.now() ? value.publishedAt : undefined
  return { ...value, thumbnail, coverUrl: `/api/podcasts/episodes/${encodeURIComponent(value.id)}/cover`, artists: [value.artist], ...(publishedAt ? { publishedAt } : { publishedAt: undefined }) }
}

export function normalizePodcastCreator(value) {
  if (!value || !creatorPattern.test(value.id || '') || typeof value.name !== 'string' || !value.name.trim()) return null
  const episodes = unique((value.episodes || []).map(normalizePodcastEpisode)).filter(episode => episode.creatorId === value.id)
  const shows = unique((value.shows || []).filter(show => show?.creatorId === value.id && typeof show.id === 'string' && /^(?:MPSP[A-Za-z0-9_-]{10,124}|channel:UC[A-Za-z0-9_-]{22})$/.test(show.id)).map(show => ({ ...show, thumbnail: image(show.thumbnail), episodes: unique((show.episodes || []).map(normalizePodcastEpisode)).filter(episode => episode.creatorId === value.id) })))
  return { ...value, name: value.name.trim(), thumbnail: image(value.thumbnail), coverUrl: `/api/podcasts/creators/${encodeURIComponent(value.id)}/cover`, episodes, shows }
}

export function normalizePodcastFeed(value) {
  if (!value || !Array.isArray(value.creators) || !Array.isArray(value.episodes) || !Array.isArray(value.shows)) throw fail(502, 'INVALID_PODCAST_FEED', 'Podcast belum bisa dimuat. Coba lagi nanti.')
  const creators = unique(value.creators.map(normalizePodcastCreator))
  const episodes = unique(value.episodes.map(normalizePodcastEpisode))
  const shows = unique(creators.flatMap(creator => creator.shows))
  return { ...value, creators, episodes, shows, creatorCount: creators.length, episodeCount: episodes.length, showCount: shows.length }
}

export function createPodcastService({ dataDir, pythonBinary = process.env.MUSIC_PYTHON || join(project, '.venv/bin/python'), executable = 'yt-dlp', runCommand, fetcher = fetch, now = Date.now, timeoutMs = 180000, cacheTtlMs = 14400000 } = {}) {
  if (!dataDir) throw new Error('Direktori podcast diperlukan.')
  const root = join(dataDir, 'podcasts')
  const media = join(root, 'media')
  mkdirSync(media, { recursive: true, mode: 0o700 })
  const episodes = new Map()
  const creators = new Map()
  const cache = new Map()
  const pending = new Map()
  const sources = new Map()
  const preparing = new Map()
  const children = new Set()
  const deliveries = new Set()
  const waiting = []
  let active = 0
  let closed = false

  function stored(path) { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }
  function persist(path, value) { const temp = `${path}.tmp`; writeFileSync(temp, JSON.stringify(value), { mode: 0o600 }); renameSync(temp, path) }
  const registry = stored(join(root, 'catalogue.json'))
  if (registry?.version === 1) {
    for (const value of registry.episodes || []) { const item = normalizePodcastEpisode(value); if (item) episodes.set(item.id, item) }
    for (const value of registry.creators || []) { const item = normalizePodcastCreator(value); if (item) creators.set(item.id, item) }
  }
  function saveRegistry() { if (!closed) persist(join(root, 'catalogue.json'), { version: 1, episodes: [...episodes.values()].slice(-3000), creators: [...creators.values()].slice(-200) }) }
  function record(value) {
    for (const episode of value.episodes || []) episodes.set(episode.id, episode)
    for (const creator of value.creators || []) { creators.set(creator.id, creator); for (const episode of creator.episodes) episodes.set(episode.id, episode) }
    saveRegistry()
  }

  function execute(binary, args, { input = '', timeout = timeoutMs, limit = 8388608, signal } = {}) {
    if (runCommand) return runCommand(binary, args, { input, timeout, limit })
    return new Promise((resolveOutput, reject) => {
      if (closed || signal?.aborted) return reject(fail(503, 'PODCAST_CLOSED', 'Podcast sedang ditutup atau dibatalkan.'))
      const start = () => {
        if (closed || signal?.aborted) { reject(fail(503, 'PODCAST_CLOSED', 'Podcast sedang ditutup atau dibatalkan.')); waiting.shift()?.(); return }
        active += 1
        const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] })
        children.add(child)
        let output = ''
        let outputBytes = 0
        let settled = false
        const finish = (error, value) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener('abort', cancel)
          children.delete(child)
          active -= 1
          error ? reject(error) : resolveOutput(value)
          waiting.shift()?.()
        }
        const timer = setTimeout(() => { child.kill('SIGTERM'); finish(fail(503, 'PODCAST_TIMEOUT', 'Podcast belum merespons. Coba lagi sebentar.')) }, timeout)
        const cancel = () => {
          child.kill('SIGTERM')
          const force = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }, 1000)
          force.unref()
          child.once('close', () => clearTimeout(force))
          finish(fail(503, 'PODCAST_CANCELED', 'Pemuatan podcast dibatalkan.'))
        }
        signal?.addEventListener('abort', cancel, { once: true })
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', chunk => { outputBytes += Buffer.byteLength(chunk); output += chunk; if (outputBytes > limit) { child.kill('SIGTERM'); finish(fail(502, 'PODCAST_TOO_LARGE', 'Daftar podcast terlalu besar untuk dimuat.')) } })
        child.stderr.on('data', () => {})
        child.on('error', () => finish(fail(503, 'PODCAST_TOOLS_UNAVAILABLE', 'Sumber podcast belum tersedia.')))
        child.on('close', code => code ? finish(fail(503, 'PODCAST_SOURCE_UNAVAILABLE', 'Podcast belum bisa dimuat dari sumbernya. Coba lagi nanti.')) : finish(null, output))
        child.stdin.on('error', () => {})
        child.stdin.end(input)
      }
      if (active < 2) start()
      else if (waiting.length < 20) waiting.push(start)
      else reject(fail(429, 'PODCAST_BUSY', 'Podcast sedang ramai. Coba lagi sebentar.'))
    })
  }

  async function catalogue(mode, value = '', known = null) {
    const raw = await execute(pythonBinary, [join(project, 'server/podcast_catalog.py'), mode, ...(value ? [value] : [])], { input: known ? JSON.stringify(known) : '' })
    let result
    try { result = JSON.parse(raw) } catch { throw fail(502, 'INVALID_PODCAST_RESPONSE', 'Data podcast belum bisa dibaca. Coba lagi nanti.') }
    if (result.error) throw fail(503, 'PODCAST_SOURCE_UNAVAILABLE', 'Podcast belum bisa dimuat dari sumbernya. Coba lagi nanti.')
    return result
  }

  async function cached(key, loader, normalize, refresh = false) {
    if (closed) throw fail(503, 'PODCAST_CLOSED', 'Podcast sedang ditutup.')
    const path = join(root, createHash('sha256').update(key).digest('hex') + '.json')
    if (!cache.has(key)) { const data = stored(path); if (data?.version === 2 && Number.isFinite(data.at)) try { cache.set(key, { at: data.at, value: normalize(data.value) }) } catch { } }
    const previous = cache.get(key)
    if (previous && !refresh && now() - previous.at < cacheTtlMs) { record(previous.value.creators ? previous.value : { creators: previous.value.type === 'episode' ? [] : [previous.value], episodes: previous.value.type === 'episode' ? [previous.value] : previous.value.episodes }); return { ...previous.value, updatedAt: previous.at, stale: false } }
    if (pending.has(key)) return pending.get(key)
    const promise = loader().then(raw => {
      const value = normalize(raw)
      if (!value) throw fail(502, 'INVALID_PODCAST_RESPONSE', 'Identitas podcast belum cocok dengan sumbernya.')
      const at = now()
      cache.set(key, { at, value })
      if (!closed) persist(path, { version: 2, at, value })
      record(value.creators ? value : { creators: value.type === 'episode' ? [] : [value], episodes: value.type === 'episode' ? [value] : value.episodes })
      return { ...value, updatedAt: at, stale: false }
    }).catch(error => {
      if (previous) return { ...previous.value, updatedAt: previous.at, stale: true, sourceError: 'Podcast belum bisa diperbarui. Menampilkan data terakhir yang dimuat.' }
      throw error
    }).finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
  }

  function discover({ refresh = false } = {}) { return cached('discover', () => catalogue('discover'), normalizePodcastFeed, refresh) }
  function search(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 120 || /https?:\/\/|www\./i.test(query)) throw fail(400, 'INVALID_PODCAST_SEARCH', 'Cari judul, kreator, atau topik podcast sepanjang 2–120 karakter, bukan URL.')
    return cached(`search:${query.trim()}`, () => catalogue('search', query.trim()), normalizePodcastFeed)
  }
  function creator(id, { refresh = false } = {}) {
    if (!creatorPattern.test(id || '')) throw fail(400, 'INVALID_PODCAST_CREATOR', 'Alamat kreator podcast ini tidak valid.')
    const known=creators.get(id)
    if(!refresh&&known?.thumbnail&&known.description&&known.episodes?.length)return Promise.resolve({...known,stale:true})
    return cached(`creator:${id}`, () => catalogue('creator', id), value => { const item = normalizePodcastCreator(value); if (item?.id !== id) throw fail(502, 'INVALID_PODCAST_CREATOR_RESPONSE', 'Identitas kreator belum cocok dengan sumbernya.'); return item }, refresh)
  }
  function episode(id, { refresh = false } = {}) {
    const match = episodePattern.exec(id || '')
    if (!match) throw fail(400, 'INVALID_PODCAST_EPISODE', 'Alamat episode podcast ini tidak valid.')
    return cached(`episode:${id}`, () => catalogue('episode', match[1], episodes.get(id)), value => { const item = normalizePodcastEpisode(value); if (item?.id !== id) throw fail(502, 'INVALID_PODCAST_EPISODE_RESPONSE', 'Identitas episode belum cocok dengan sumbernya.'); return item }, refresh)
  }
  function lookupEpisode(id) { return episodes.get(id) }
  function lookupCreator(id) { return creators.get(id) }

  function playbackEpisode(id) {
    if (!episodePattern.test(id || '')) throw fail(400, 'INVALID_PODCAST_EPISODE', 'Alamat episode podcast ini tidak valid.')
    return episodes.get(id) || episode(id)
  }

  async function source(id, refresh = false) {
    const cached = sources.get(id)
    if (!refresh && cached && now() - cached.at < 120000) return cached.value
    const key = `source:${id}`
    if (pending.has(key)) return pending.get(key)
    const task = (async () => {
      const item = await playbackEpisode(id)
      const value = await catalogue('source', episodePattern.exec(id)[1], item)
      if (!value.url || !['audio/mp4', 'audio/webm'].includes(value.contentType) || normalizePodcastEpisode(value.episode)?.id !== id) throw fail(502, 'PODCAST_AUDIO_UNAVAILABLE', 'Audio podcast belum bisa diputar. Coba lagi nanti.')
      sources.set(id, { at: now(), value })
      while (sources.size > 32) sources.delete(sources.keys().next().value)
      return value
    })().finally(() => pending.delete(key))
    pending.set(key, task)
    return task
  }

  function audioFile(id) {
    const match = episodePattern.exec(id || '')
    if (!match) return null
    const path = join(media, `${match[1]}.mp3`)
    const stamp = stored(join(media, `${match[1]}.json`))
    return stamp?.verified && existsSync(path) && statSync(path).size === stamp.size ? { path, size: stamp.size } : null
  }

  function prepare(id, req, res) {
    let job = preparing.get(id)
    if (!job) {
      if (closed) throw fail(503, 'PODCAST_CLOSED', 'Podcast sedang ditutup.')
      if (preparing.size >= 2) throw fail(429, 'PODCAST_BUSY', 'Podcast sedang ramai. Coba lagi sebentar.')
      job = { users: 0, finished: false, cancelTimer: null, controller: new AbortController() }
      preparing.set(id, job)
      job.promise = (async () => {
        const item = await playbackEpisode(id)
        const videoId = episodePattern.exec(id)[1]
        const path = join(media, `${videoId}.mp3`)
        const used = readdirSync(media).filter(name => name.endsWith('.mp3')).reduce((sum, name) => sum + statSync(join(media, name)).size, 0)
        if (used > 1073741824) throw fail(507, 'PODCAST_CACHE_FULL', 'Cache podcast server penuh. Coba episode lain.')
        let playback
        try {
          const raw = JSON.parse(await execute(executable, ['--ignore-config', '--no-playlist', '--skip-download', '--dump-single-json', '--socket-timeout', '18', '--retries', '1', '--remote-components', 'ejs:github', '--', `https://www.youtube.com/watch?v=${videoId}`], { timeout: 90000, signal: job.controller.signal }))
          if (raw.id !== videoId || raw.channel_id !== item.creatorId || raw.is_live || !Number.isFinite(raw.duration) || raw.duration <= 0 || raw.duration > 28800) throw fail(502, 'INVALID_PODCAST_AUDIO', 'Audio podcast tidak cocok dengan episode ini.')
          if (job.controller.signal.aborted) throw fail(503, 'PODCAST_CANCELED', 'Pemuatan podcast dibatalkan.')
          if (runCommand) await execute(executable, ['--ignore-config', '--no-playlist', '--no-warnings', '--socket-timeout', '18', '--retries', '1', '--fragment-retries', '1', '--remote-components', 'ejs:github', '--max-filesize', '128M', '-f', '140/bestaudio[ext=m4a]/bestaudio', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '64K', '--no-mtime', '--paths', media, '--output', `${videoId}.%(ext)s`, '--', `https://www.youtube.com/watch?v=${videoId}`], { timeout: 300000 })
          else playback = await encodePodcastAudio({ executable, videoId, path, children, consumers: deliveries, signal: job.controller.signal, req, res: req?.method === 'GET' && (!req.headers.range || /^bytes=0-\d*$/.test(req.headers.range)) ? res : null })
          const probe = JSON.parse(await execute('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,format_name', '-of', 'json', path], { timeout: 15000, signal: job.controller.signal }))
          const duration = Number(probe.format?.duration)
          const size = statSync(path).size
          if (!Number.isFinite(duration) || Math.abs(duration - raw.duration) > 3 || probe.format?.format_name !== 'mp3' || size <= 0 || size > 134217728) throw fail(502, 'INCOMPLETE_PODCAST_AUDIO', 'Audio podcast belum lengkap. Coba lagi nanti.')
          persist(join(media, `${videoId}.json`), { verified: true, size, duration })
          playback?.finish()
          return { path, size, response: playback?.response, delivery: playback?.delivery }
        } catch (error) { playback?.abort(); for (const name of readdirSync(media)) if (name.startsWith(`${videoId}.`)) rmSync(join(media, name), { force: true }); throw error }
      })().finally(() => { job.finished = true; clearTimeout(job.cancelTimer); preparing.delete(id) })
    }
    job.users += 1
    clearTimeout(job.cancelTimer)
    let released = false
    const release = () => {
      if (released) return
      released = true
      job.users -= 1
      if (!job.finished && !job.users) { job.cancelTimer = setTimeout(() => job.controller.abort(), 1000); job.cancelTimer.unref() }
    }
    res?.once('close', release)
    return job.promise.finally(() => { res?.off('close', release); release() })
  }

  function serve(file, req, res) {
    let range
    try { range = resolveRange(req.headers.range, file.size) }
    catch { res.setHeader('Content-Range', `bytes */${file.size}`); throw fail(416, 'INVALID_RANGE', 'Bagian audio yang diminta tidak valid.') }
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (range) { res.statusCode = 206; res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`); res.setHeader('Content-Length', range.end - range.start + 1) }
    else res.setHeader('Content-Length', file.size)
    if (req.method === 'HEAD') { res.end(); return true }
    const output = createReadStream(file.path, range || {})
    output.on('error', () => res.destroy())
    res.on('close', () => output.destroy())
    output.pipe(res)
    return true
  }

  async function stream(req, res, id) {
    if (!episodePattern.test(id || '')) throw fail(400, 'INVALID_PODCAST_EPISODE', 'Alamat episode podcast ini tidak valid.')
    const saved = audioFile(id)
    if (saved) return serve(saved, req, res)
    await playbackEpisode(id)
    try { if (await proxyPlayback(req, res, refresh => source(id, refresh), fetcher)) return true }
    catch (error) { if (res.headersSent || res.destroyed || req.aborted || error.status === 416 || error.code === 'UNSAFE_AUDIO_SOURCE' || error.code === 'INVALID_AUDIO_REDIRECT') throw error }
    if (res.destroyed || req.aborted) return true
    const file = await prepare(id, req, res)
    if (res.destroyed || req.aborted) return true
    if (file.response === res) { await file.delivery; if (!res.destroyed && !res.writableEnded) res.end(); return true }
    return serve(file, req, res)
  }

  const transcripts = new Map()
  async function transcript(id, { language = 'id', refresh = false } = {}) {
    if (!episodePattern.test(id || '') || !['id','en'].includes(language)) throw fail(400, 'INVALID_TRANSCRIPT', 'Alamat transkrip tidak valid.')
    const key = `${id}:${language}`
    const file = join(root, `transcript-${episodePattern.exec(id)[1]}-${language}.json`)
    const saved = stored(file)
    const previous = transcripts.get(key) || (saved?.version === 2 ? saved.value : saved?.available ? saved : null)
    if (!refresh && previous?.episodeId === id && now() - previous.updatedAt < (previous.available ? 86400000 : 300000)) return previous
    const pendingKey = `transcript:${key}`
    if (pending.has(pendingKey)) return pending.get(pendingKey)
    const task = (async () => {
      const item = await playbackEpisode(id)
      const raw = await execute(pythonBinary, [join(project, 'server/podcast_transcript.py')], { input: JSON.stringify({ videoId: episodePattern.exec(id)[1], creatorId: item.creatorId, language }), timeout: 90000, limit: 2097152 })
      const value = JSON.parse(raw)
      if (value.error || value.episodeId !== id || !Array.isArray(value.cues)) throw fail(503, 'TRANSCRIPT_UNAVAILABLE', 'Transkrip dari sumbernya belum bisa dimuat. Kamu bisa impor teks sendiri.')
      const cues = value.cues.filter(cue => Number.isFinite(cue.time) && cue.time >= 0 && cue.time <= item.duration + 60 && typeof cue.text === 'string' && cue.text.length <= 4000).slice(0, 10000).sort((a,b)=>a.time-b.time)
      const result = { episodeId:id, available:cues.length>0, cues, text:cues.map(cue=>cue.text).join('\n'), language:String(value.language || language).slice(0,30), automatic:Boolean(value.automatic), updatedAt:now() }
      transcripts.set(key,result)
      while (transcripts.size > 20) transcripts.delete(transcripts.keys().next().value)
      if (!closed) persist(file,{ version:2, value:result })
      return result
    })().finally(()=>pending.delete(pendingKey))
    pending.set(pendingKey,task)
    return task
  }

  function close() { closed = true; for (const controller of deliveries) controller.abort(); for (const job of preparing.values()) { clearTimeout(job.cancelTimer); job.controller.abort() } for (const child of children) child.kill('SIGTERM'); while (waiting.length) waiting.shift()?.() }
  return { discover, search, creator, episode, lookupEpisode, lookupCreator, stream, transcript, close }
}

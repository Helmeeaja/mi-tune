import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
function fail(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

const audioHosts = (process.env.MI_TUNE_AUDIO_HOSTS || '')
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean)

function allowedAudioHost(hostname) {
  const host = hostname.toLowerCase()
  if (host.endsWith('.googlevideo.com')) return true
  return audioHosts.some(suffix => host === suffix || host.endsWith(`.${suffix}`))
}

export function validatePlaybackUrl(value) {
  let url
  try { url = new URL(value) }
  catch { throw fail(502, 'UNSAFE_AUDIO_SOURCE', 'Sumber audio ini belum bisa dihubungkan.') }
  const allowedPath = url.pathname === '/videoplayback' || url.pathname === '/latest_version'
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedAudioHost(url.hostname) || !allowedPath) throw fail(502, 'UNSAFE_AUDIO_SOURCE', 'Sumber audio ini belum bisa dihubungkan.')
  return url
}

export async function proxyPlayback(req, res, resolveSource, fetcher = fetch) {
  const range = req.headers.range
  if (range && (typeof range !== 'string' || range.length > 100 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) throw fail(416, 'INVALID_RANGE', 'Bagian audio yang diminta tidak valid.')
  const controller = new AbortController()
  const cancel = () => { if (!res.writableFinished) controller.abort() }
  res.once('close', cancel)
  let headerTimer
  let idleTimer
  try {
    let source
    let upstream
    for (let attempt = 0; attempt < 2; attempt += 1) {
      source = await resolveSource(attempt > 0)
      if (!source?.url) return false
      if (!['audio/mp4', 'audio/webm'].includes(source.contentType)) throw fail(502, 'INVALID_AUDIO_FORMAT', 'Format audio ini belum bisa diputar langsung.')
      if (res.destroyed || req.aborted) return true
      let url = validatePlaybackUrl(source.url)
      const headers = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.youtube.com/' }
      if (range) headers.Range = range
      headerTimer = setTimeout(() => controller.abort(), 20000)
      for (let redirects = 0; redirects <= 3; redirects += 1) {
        upstream = await fetcher(url.href, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers, redirect: 'manual', signal: controller.signal })
        if (![301, 302, 303, 307, 308].includes(upstream.status)) break
        const location = upstream.headers.get('location')
        await upstream.body?.cancel()
        if (!location || redirects === 3) throw fail(502, 'INVALID_AUDIO_REDIRECT', 'Sumber audio belum bisa dihubungkan. Coba lagi sebentar.')
        url = validatePlaybackUrl(new URL(location, url).href)
      }
      clearTimeout(headerTimer)
      if (![403, 410].includes(upstream.status) || attempt > 0) break
      await upstream.body?.cancel()
    }
    if (upstream.status === 416) {
      const contentRange = upstream.headers.get('content-range')
      const headers = { 'Cache-Control': 'no-store' }
      if (/^bytes \*\/\d+$/.test(contentRange || '')) headers['Content-Range'] = contentRange
      await upstream.body?.cancel()
      res.writeHead(416, headers)
      res.end()
      return true
    }
    if (![200, 206].includes(upstream.status)) {
      await upstream.body?.cancel()
      throw fail(502, 'AUDIO_SOURCE_UNAVAILABLE', 'Sumber audio sedang sulit dihubungkan. Coba putar lagi sebentar.')
    }
    const receivedType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!['audio/mp4', 'audio/x-m4a', 'audio/webm', 'video/mp4', 'application/octet-stream'].includes(receivedType)) { await upstream.body?.cancel(); throw fail(502, 'INVALID_AUDIO_RESPONSE', 'Sumber mengirim respons bukan audio. Coba lagi nanti.') }
    const headers = { 'Content-Type': source.contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-MiTune-Playback': 'direct' }
    const length = upstream.headers.get('content-length')
    if (/^\d+$/.test(length || '') && Number(length) > 67108864) { await upstream.body?.cancel(); throw fail(422, 'AUDIO_TOO_LARGE', 'Ukuran audio melewati batas Mi Tune.') }
    const contentRange = upstream.headers.get('content-range')
    if (/^\d+$/.test(length || '')) headers['Content-Length'] = length
    if (upstream.status === 206) {
      if (!/^bytes \d+-\d+\/\d+$/.test(contentRange || '')) { await upstream.body?.cancel(); throw fail(502, 'INVALID_AUDIO_RANGE', 'Sumber audio belum bisa memuat bagian lagu ini.') }
      headers['Content-Range'] = contentRange
    }
    res.writeHead(upstream.status, headers)
    if (req.method === 'HEAD') { await upstream.body?.cancel(); res.end(); return true }
    if (!upstream.body) throw fail(502, 'EMPTY_AUDIO_SOURCE', 'Audio belum tersedia dari sumbernya. Coba lagi sebentar.')
    const stream = Readable.fromWeb(upstream.body)
    const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => controller.abort(), 30000) }
    stream.on('data', resetIdle)
    resetIdle()
    await pipeline(stream, res, { signal: controller.signal })
    return true
  } catch (error) {
    if (res.destroyed || req.aborted) return true
    if (controller.signal.aborted) throw fail(504, 'AUDIO_CONNECTION_TIMEOUT', 'Koneksi audio terputus terlalu lama. Coba putar lagi.')
    throw error
  } finally {
    clearTimeout(headerTimer)
    clearTimeout(idleTimer)
    res.off('close', cancel)
    controller.abort()
  }
}

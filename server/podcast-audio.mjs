import { spawn } from 'node:child_process'
import { open } from 'node:fs/promises'
import { renameSync, rmSync } from 'node:fs'
import { once } from 'node:events'
import { Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

function fail(code, message) { return Object.assign(new Error(message), { status: 503, code }) }

export async function encodePodcastAudio({ executable, videoId, path, children, consumers, signal, req, res }) {
  const temporary = `${path}.part`
  const producer = new AbortController()
  const consumer = new AbortController()
  const processes = []
  const listeners = new Set()
  const wake = () => { for (const listener of listeners) listener() }
  const cancel = () => { producer.abort(); consumer.abort(); wake() }
  const disconnected = () => { consumer.abort(); wake() }
  signal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, 300000)
  let handle
  let written = 0
  let produced = false
  let verified = false
  let deliveryFinished = !res
  let handleClosing = false
  let committed = false
  let tasks = []
  let delivery = Promise.resolve()

  function closeHandle() {
    if (!handle || !produced || !deliveryFinished || handleClosing) return
    handleClosing = true
    handle.close().catch(() => {})
  }

  function watch(child) {
    processes.push(child)
    children.add(child)
    child.stderr.on('data', () => {})
    return new Promise((resolve, reject) => {
      child.once('error', () => reject(fail('PODCAST_TOOLS_UNAVAILABLE', 'Sumber podcast belum tersedia.')))
      child.once('close', code => {
        children.delete(child)
        code === 0 ? resolve() : reject(fail('PODCAST_SOURCE_UNAVAILABLE', 'Audio podcast belum bisa dimuat dari sumbernya.'))
      })
    })
  }

  async function writeChunk(chunk) {
    if (written + chunk.length > 134217728) throw fail('PODCAST_TOO_LARGE', 'Audio podcast terlalu besar untuk disiapkan.')
    let offset = 0
    while (offset < chunk.length) {
      const result = await handle.write(chunk, offset, chunk.length - offset, written)
      if (!result.bytesWritten) throw fail('PODCAST_CACHE_UNAVAILABLE', 'Cache audio belum bisa ditulis.')
      offset += result.bytesWritten
      written += result.bytesWritten
      wake()
    }
  }

  async function deliver() {
    let offset = 0
    while (true) {
      if (consumer.signal.aborted || res.destroyed || req.aborted) throw fail('PODCAST_CANCELED', 'Pemuatan podcast dibatalkan.')
      let changed
      const wait = new Promise(resolve => { changed = resolve; listeners.add(changed); consumer.signal.addEventListener('abort', changed, { once: true }) })
      try {
        const buffer = Buffer.allocUnsafe(65536)
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset)
        if (consumer.signal.aborted || res.destroyed || req.aborted) throw fail('PODCAST_CANCELED', 'Pemuatan podcast dibatalkan.')
        if (bytesRead) {
          if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'none', 'Cache-Control': 'no-store', 'X-MiTune-Playback': 'progressive' })
          offset += bytesRead
          if (!res.write(buffer.subarray(0, bytesRead))) await once(res, 'drain', { signal: consumer.signal })
        } else if (produced && verified) return
        else await wait
      } finally {
        listeners.delete(changed)
        consumer.signal.removeEventListener('abort', changed)
      }
    }
  }

  try {
    if (signal?.aborted) throw fail('PODCAST_CANCELED', 'Pemuatan podcast dibatalkan.')
    handle = await open(temporary, 'w+', 0o600)
    if (res) {
      consumers.add(consumer)
      res.once('close', disconnected)
      res.once('error', disconnected)
      delivery = deliver().catch(error => { if (!res.destroyed) res.destroy(); throw error }).finally(() => {
        deliveryFinished = true
        consumers.delete(consumer)
        res.off('close', disconnected)
        res.off('error', disconnected)
        closeHandle()
      })
      delivery.catch(() => {})
    }
    const downloader = spawn(executable, ['--ignore-config', '--no-playlist', '--no-warnings', '--socket-timeout', '18', '--retries', '1', '--fragment-retries', '1', '--remote-components', 'ejs:github', '--max-filesize', '128M', '-f', 'bestaudio[ext=webm]/140/bestaudio[ext=m4a]/bestaudio', '-o', '-', '--', `https://www.youtube.com/watch?v=${videoId}`], { stdio: ['ignore', 'pipe', 'pipe'] })
    const downloaded = watch(downloader)
    const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', '-write_xing', '0', '-id3v2_version', '0', '-flush_packets', '1', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const encoded = watch(encoder)
    let inputBytes = 0
    const input = new Transform({ transform(chunk, encoding, next) {
      inputBytes += chunk.length
      if (inputBytes > 134217728) return next(fail('PODCAST_TOO_LARGE', 'Audio podcast terlalu besar untuk disiapkan.'))
      next(null, chunk)
    } })
    const output = new Writable({ highWaterMark: 65536, write(chunk, encoding, next) { writeChunk(chunk).then(() => next(), next) } })
    tasks = [downloaded, encoded, pipeline(downloader.stdout, input, encoder.stdin, { signal: producer.signal }), pipeline(encoder.stdout, output, { signal: producer.signal })]
    await Promise.all(tasks)
    if (!written) throw fail('PODCAST_EMPTY_AUDIO', 'Audio podcast belum tersedia dari sumbernya.')
    renameSync(temporary, path)
    committed = true
    return { response: res, delivery, finish: () => { verified = true; wake() }, abort: disconnected }
  } catch (error) {
    consumer.abort()
    wake()
    if (res?.headersSent && !res.destroyed) res.destroy()
    if (producer.signal.aborted || signal?.aborted) throw fail('PODCAST_CANCELED', 'Pemuatan podcast terputus atau dibatalkan.')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
    producer.abort()
    for (const child of processes) {
      if (child.exitCode !== null || child.signalCode !== null) continue
      child.kill('SIGTERM')
      const force = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }, 1000)
      force.unref()
      child.once('close', () => clearTimeout(force))
    }
    await Promise.allSettled(tasks)
    produced = true
    wake()
    closeHandle()
    if (!committed) rmSync(temporary, { force: true })
  }
}

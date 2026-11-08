const actions = new Set(['play', 'pause', 'resume', 'next', 'previous', 'seek', 'preferences', 'queue', 'state', 'stop', 'cache-start', 'cache-chunk', 'cache-finish', 'cache-delete', 'configure'])
const listeners = new Set()
const pending = new Map()
let attached = null
let counter = 0

export function hasNativePlayer() {
  return typeof window !== 'undefined' && typeof window.MiTuneNative?.postMessage === 'function'
}

function attach() {
  if (!hasNativePlayer()) return false
  const bridge = window.MiTuneNative
  if (attached === bridge) return true
  attached = bridge
  bridge.onmessage = event => {
    let message
    try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
    if (!message || typeof message !== 'object') return
    const request = typeof message.id === 'string' ? pending.get(message.id) : null
    if (request) {
      pending.delete(message.id)
      clearTimeout(request.timer)
      if (message.ok === false) request.reject(Object.assign(new Error(message.error || 'Player Android belum bisa menjalankan perintah ini.'), { code: message.code || 'NATIVE_PLAYBACK_ERROR' }))
      else request.resolve(message.state ?? message.result ?? null)
    }
    if (message.state && typeof message.state === 'object') for (const listener of listeners) listener(message.state)
  }
  return true
}

export function nativeCommand(action, payload = {}) {
  if (!actions.has(action)) return Promise.reject(new Error('Perintah player Android tidak valid.'))
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return Promise.reject(new Error('Data player Android tidak valid.'))
  if (!attach()) return Promise.reject(Object.assign(new Error('Player native hanya tersedia di aplikasi Android Mi Tune.'), { code: 'NATIVE_UNAVAILABLE' }))
  const id = `mi-tune-${++counter}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Object.assign(new Error('Player Android belum merespons. Coba lagi.'), { code: 'NATIVE_TIMEOUT' })) }, 15000)
    pending.set(id, { resolve, reject, timer })
    try { window.MiTuneNative.postMessage(JSON.stringify({ version: 1, id, action, payload })) }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error) }
  })
}

export function subscribeNativePlayer(listener) {
  if (typeof listener !== 'function') throw new TypeError('Listener player harus berupa fungsi.')
  listeners.add(listener)
  attach()
  return () => listeners.delete(listener)
}

export async function cacheNativeDownload(entry, owner) {
  const blob = entry?.audio
  if (!hasNativePlayer() || !blob || typeof blob.arrayBuffer !== 'function') return false
  const started = await nativeCommand('cache-start', { track: entry.track, owner, size: blob.size, mime: blob.type || 'audio/mpeg' })
  if (started?.alreadyCached && started.bytes === blob.size) return true
  try {
    for (let offset = 0; offset < blob.size; offset += 98304) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + 98304).arrayBuffer())
      let binary = ''
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
      await nativeCommand('cache-chunk', { trackId: entry.track.id, owner, offset, data: btoa(binary) })
    }
    const saved = await nativeCommand('cache-finish', { trackId: entry.track.id, owner })
    if (!saved?.cached || saved.bytes !== blob.size) throw new Error('Audio unduhan belum tersimpan lengkap di player Android.')
    return true
  } catch (error) {
    await nativeCommand('cache-delete', { trackId: entry.track.id, owner }).catch(() => {})
    throw error
  }
}

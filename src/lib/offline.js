const AUDIO_CACHE = 'mi-tune-audio-v1'
const COVER_CACHE = 'mi-tune-covers-v1'
let databasePromise

function openDatabase() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Browser ini belum mendukung penyimpanan offline.'))
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('mi-tune-device', 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('downloads')) database.createObjectStore('downloads', { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Penyimpanan lokal tidak dapat dibuka.'))
      request.onblocked = () => reject(new Error('Tutup Mi Tune yang masih terbuka di tempat lain agar penyimpanan dapat diperbarui.'))
    }).catch(error => { databasePromise = null; throw error })
  }
  return databasePromise
}

async function operate(mode, action) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('downloads', mode)
    const operation = action(transaction.objectStore('downloads'))
    let value
    operation.onsuccess = () => { value = operation.result }
    transaction.oncomplete = () => resolve(value)
    transaction.onerror = () => reject(transaction.error || operation.error || new Error('Penyimpanan lokal gagal.'))
    transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan dibatalkan.'))
  })
}

function storageError(error) {
  if (error?.name === 'QuotaExceededError') return new Error('Penyimpanan perangkat penuh. Hapus beberapa unduhan lalu coba lagi.')
  return error
}

function announce() {
  window.dispatchEvent(new CustomEvent('mi-tune:downloads-changed'))
}

export async function getDownloads(owner = 'guest') {
  const entries = await operate('readonly', store => store.getAll())
  const owned = entries.filter(entry => entry.owner === owner).sort((a, b) => b.downloadedAt - a.downloadedAt)
  if (!('caches' in globalThis)) return owned.map(entry => ({ ...entry, available: false }))
  const cache = await caches.open(AUDIO_CACHE)
  return Promise.all(owned.map(async entry => ({ ...entry, available: Boolean(await cache.match(`/api/tracks/${encodeURIComponent(entry.id)}/audio`)) })))
}

export async function getDownload(trackId, owner = 'guest') {
  const entry = await operate('readonly', store => store.get(`${owner}:${trackId}`))
  if (!entry) return null
  if (!('caches' in globalThis)) return null
  const cache = await caches.open(AUDIO_CACHE)
  return await cache.match(`/api/tracks/${encodeURIComponent(trackId)}/audio`) ? entry : null
}

export async function getDownloadedAudio(trackId, owner = 'guest') {
  const entry = await getDownload(trackId, owner)
  if (!entry) return null
  const response = await (await caches.open(AUDIO_CACHE)).match(`/api/tracks/${encodeURIComponent(trackId)}/audio`)
  return response ? response.blob() : null
}

export async function markNativeDownload(trackId, owner = 'guest') {
  const entry = await getDownload(trackId, owner)
  if (!entry) throw new Error('Audio unduhan belum tersedia di perangkat ini.')
  await operate('readwrite', store => store.put({ ...entry, nativeReady: true }))
  announce()
}

export async function getStorageEstimate() {
  const estimate = await navigator.storage?.estimate?.() || {}
  const persisted = await navigator.storage?.persisted?.() || false
  return { usage: estimate.usage ?? null, quota: estimate.quota ?? null, persisted }
}

export async function downloadTrack(track, lyrics = null, options = {}) {
  const { owner = 'guest', onProgress, signal } = options
  if (owner === 'guest') throw new Error('Masuk dulu untuk menyimpan lagu offline.')
  if (!('caches' in globalThis) || !('serviceWorker' in navigator)) throw new Error('Offline membutuhkan browser yang mendukung PWA dan origin HTTPS atau localhost.')
  if (!/^yt:[A-Za-z0-9_-]{11}$/.test(track?.id || '') || track.type !== 'song') throw new Error('Hanya lagu terverifikasi yang dapat diunduh.')
  const url = `/api/tracks/${encodeURIComponent(track.id)}/audio`
  const query = new URLSearchParams({ rightsConfirmed: '1' })
  if (typeof track.playbackToken === 'string') query.set('proof', track.playbackToken)
  const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/download?${query}`, { credentials: 'same-origin', signal })
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('mi-tune:auth-required'))
    const result = await response.json().catch(() => null)
    throw new Error(result?.error?.message || 'Audio belum siap diunduh. Siapkan lagu terlebih dahulu.')
  }
  if (!response.headers.get('content-type')?.includes('audio/')) throw new Error('Sumber tidak mengembalikan file audio.')
  const total = Number(response.headers.get('content-length')) || null
  const estimate = await getStorageEstimate()
  if (total && estimate.quota && estimate.usage + total > estimate.quota * 0.9) throw new Error('Ruang penyimpanan tidak cukup untuk lagu ini.')
  const reader = response.body.getReader()
  const chunks = []
  let loaded = 0
  const cache = await caches.open(AUDIO_CACHE)
  const hadAudio = Boolean(await cache.match(url))
  let cachedAudio = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      if (loaded > 67108864) { await reader.cancel(); throw new Error('Audio terlalu besar untuk unduhan perangkat.') }
      onProgress?.({ loaded, total, percent: total ? Math.min(99, loaded / total * 100) : null })
    }
    signal?.throwIfAborted()
    if (total && loaded !== total) throw new Error('Unduhan terputus sebelum file audio lengkap. Coba lagi.')
    if (!loaded) throw new Error('File audio kosong.')
    const headers = new Headers(response.headers)
    headers.set('Content-Length', String(loaded))
    headers.set('Accept-Ranges', 'bytes')
    await cache.put(url, new Response(new Blob(chunks, { type: 'audio/mpeg' }), { status: 200, headers }))
    cachedAudio = true
    if (track.coverUrl) {
      try {
        const cover = await fetch(track.coverUrl, { credentials: 'same-origin', signal })
        if (cover.ok && cover.headers.get('content-type')?.startsWith('image/')) await (await caches.open(COVER_CACHE)).put(track.coverUrl, cover)
      } catch (error) {
        if (error?.name === 'AbortError') throw error
      }
    }
    const record = { ...track, key: `${owner}:${track.id}`, owner, track, size: loaded, downloadedAt: Date.now(), lyrics }
    await operate('readwrite', store => store.put(record))
    navigator.storage?.persist?.().catch(() => false)
    onProgress?.({ loaded, total: loaded, percent: 100 })
    announce()
    return await getDownload(track.id, owner)
  } catch (error) {
    if (cachedAudio && !hadAudio) await cache.delete(url).catch(() => false)
    throw storageError(error)
  } finally {
    reader.releaseLock()
  }
}

export async function removeDownload(trackId, owner = 'guest') {
  await operate('readwrite', store => store.delete(`${owner}:${trackId}`))
  const all = await operate('readonly', store => store.getAll())
  if (!all.some(entry => entry.id === trackId)) {
    if ('caches' in globalThis) {
      await (await caches.open(AUDIO_CACHE)).delete(`/api/tracks/${encodeURIComponent(trackId)}/audio`)
      const coverCache = await caches.open(COVER_CACHE)
      const coverPath = `/api/tracks/${encodeURIComponent(trackId)}/cover`
      for (const request of await coverCache.keys()) if (new URL(request.url).pathname === coverPath) await coverCache.delete(request)
    }
  }
  announce()
}

export async function updateDownloadedLyrics(trackId, lyrics, owner = 'guest') {
  const record = await operate('readonly', store => store.get(`${owner}:${trackId}`))
  if (!record) return null
  record.lyrics = typeof lyrics === 'string' ? { syncedLyrics: lyrics, plainLyrics: null, source: 'local', matched: true } : lyrics
  await operate('readwrite', store => store.put(record))
  announce()
  return getDownload(trackId, owner)
}

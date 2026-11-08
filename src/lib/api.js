export async function request(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Alamat API tidak valid.')
  }
  const headers = new Headers(options.headers)
  let body = options.body
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }
  let response
  try {
    response = await fetch(`/api${path}`, { ...options, headers, body, credentials: 'same-origin' })
  } catch (failure) {
    if (options.signal?.aborted || failure?.name === 'AbortError') throw failure
    const error = new Error(navigator.onLine ? 'Koneksi ke Mi Tune terputus. Coba lagi.' : 'Kamu sedang offline. Buka koleksi unduhan.')
    error.code = 'NETWORK_ERROR'
    throw error
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Permintaan gagal (${response.status}).`)
    error.status = response.status
    error.code = payload?.error?.code || 'REQUEST_FAILED'
    if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') window.dispatchEvent(new Event('mi-tune:auth-required'))
    throw error
  }
  if (!payload || !Object.hasOwn(payload, 'data')) throw new Error('Respons server tidak valid.')
  return payload.data
}

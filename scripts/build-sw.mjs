import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { resolveRange } from '../server/range.mjs'

const root = resolve('dist')
async function collect(directory, prefix = '') {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`
    if (entry.isDirectory()) result.push(...await collect(join(directory, entry.name), `${relative}/`))
    else if (entry.name !== 'sw.js' && !entry.name.endsWith('.map')) result.push(`/${relative}`)
  }
  return result
}
const assets = ['/', ...await collect(root)].sort()
const shellAssets = assets.filter(asset => asset === '/' || asset === '/index.html' || asset === '/register-sw.js' || asset === '/manifest.webmanifest' || asset === '/icon.svg' || asset === '/auth-google-complete.js' || asset.startsWith('/icons/') || asset.startsWith('/artwork/') || /^\/assets\/.+\.(?:js|css|woff2?)$/.test(asset))
const hash = createHash('sha256')
for (const asset of shellAssets) {
  hash.update(asset)
  hash.update(await readFile(join(root, asset === '/' ? 'index.html' : asset.slice(1))))
}
const name = `mi-tune-shell-${hash.digest('hex').slice(0, 12)}`
const source = `const SHELL = ${JSON.stringify(name)}
const ASSETS = ${JSON.stringify(shellAssets)}
const STATIC = new Set(ASSETS)
const AUDIO = 'mi-tune-audio-v1'
const COVERS = 'mi-tune-covers-v1'
${resolveRange.toString()}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(async names => {
    const previous = names.filter(name => name.startsWith('mi-tune-shell-') && name !== SHELL)
    await Promise.all(previous.slice(0, -1).map(name => caches.delete(name)))
    await self.clients.claim()
  }))
})
async function downloadedAudio(request) {
  const cached = await (await caches.open(AUDIO)).match(request.url)
  if (!cached) return fetch(request)
  if (!request.headers.get('range')) return cached
  const bytes = await cached.arrayBuffer()
  try {
    const range = resolveRange(request.headers.get('range'), bytes.byteLength)
    if (!range) return cached
    const headers = new Headers(cached.headers)
    headers.set('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + bytes.byteLength)
    headers.set('Content-Length', String(range.end - range.start + 1))
    headers.set('Accept-Ranges', 'bytes')
    return new Response(bytes.slice(range.start, range.end + 1), { status: 206, headers })
  } catch {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + bytes.byteLength } })
  }
}
async function navigation(request) {
  const cache = await caches.open(SHELL)
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) })
    if (response.ok) return response
    if (response.status >= 500) return await cache.match('/index.html') || response
    return response
  } catch {
    return await cache.match('/index.html') || await cache.match('/') || new Response('Mi Tune — offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
async function staticResource(request, pathname) {
  const current = await caches.open(SHELL)
  const cached = await current.match(request)
  if (cached) return cached
  if (pathname.startsWith('/assets/')) {
    const names = (await caches.keys()).filter(name => name.startsWith('mi-tune-shell-') && name !== SHELL).reverse()
    for (const name of names) {
      const previous = await (await caches.open(name)).match(request)
      if (previous) return previous
    }
  }
  const response = await fetch(request)
  if (STATIC.has(pathname) && response.ok && response.type === 'basic' && !response.redirected) await current.put(request, response.clone())
  return response
}
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/^\\/api\\/tracks\\/[^/]+\\/audio$/.test(url.pathname)) {
    event.respondWith(downloadedAudio(request))
    return
  }
  if (/^\\/api\\/tracks\\/[^/]+\\/cover$/.test(url.pathname)) {
    event.respondWith(caches.open(COVERS).then(cache => cache.match(request)).then(cached => cached || fetch(request)))
    return
  }
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request))
    return
  }
  if (request.headers.has('range') || /\\.(?:mp3|m4a|aac|ogg|opus|wav|flac|mp4|webm)$/i.test(url.pathname)) return
  if (STATIC.has(url.pathname) || /^\\/assets\\/.+\\.(?:js|css|woff2?)$/.test(url.pathname)) event.respondWith(staticResource(request, url.pathname))
})
`
await writeFile(join(root, 'sw.js'), source)
console.log(`PWA shell: ${shellAssets.length} resources, ${name}; API and stream responses are not written to cache`)

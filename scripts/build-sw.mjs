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
const shellAssets = assets.filter(asset => asset === '/' || /\.(?:html|js|css|webmanifest)$/.test(asset) || asset.startsWith('/icons/'))
const hash = createHash('sha256')
for (const asset of assets) {
  hash.update(asset)
  hash.update(await readFile(join(root, asset === '/' ? 'index.html' : asset.slice(1))))
}
const name = `mi-tune-shell-${hash.digest('hex').slice(0, 12)}`
const source = `const SHELL = ${JSON.stringify(name)}
const ASSETS = ${JSON.stringify(shellAssets)}
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
async function audioResponse(request) {
  const cached = await (await caches.open(AUDIO)).match(request.url)
  if (!cached) return fetch(request)
  if (!request.headers.get('range')) return cached
  const bytes = await cached.arrayBuffer()
  try {
    const range = resolveRange(request.headers.get('range'), bytes.byteLength)
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
    if (response.ok) await cache.put('/index.html', response.clone())
    return response
  } catch {
    return await cache.match('/index.html') || await cache.match('/') || new Response('Mi Tune — offline', { status: 503 })
  }
}
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/^\\/api\\/tracks\\/[^/]+\\/audio$/.test(url.pathname)) {
    event.respondWith(audioResponse(request))
    return
  }
  if (/^\\/api\\/tracks\\/[^/]+\\/cover$/.test(url.pathname)) {
    event.respondWith(caches.open(COVERS).then(cache => cache.match(request)).then(cached => cached || fetch(request)))
    return
  }
  if (url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request))
    return
  }
  event.respondWith(caches.open(SHELL).then(async cache => {
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && !response.redirected && /\\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)) await cache.put(request, response.clone())
    return response
  }))
})
`
await writeFile(join(root, 'sw.js'), source)
console.log(`PWA shell: ${shellAssets.length} assets, ${name}`)

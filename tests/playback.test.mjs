import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { proxyPlayback, validatePlaybackUrl } from '../server/playback.mjs'

const source = { url: 'https://rr1---sn-example.googlevideo.com/videoplayback?expire=9999999999', contentType: 'audio/mp4' }

async function server(t, resolver, fetcher) {
  const instance = createServer(async (req, res) => {
    try { if (!await proxyPlayback(req, res, resolver, fetcher)) { res.writeHead(409); res.end('Explicit unavailable fixture') } }
    catch (error) { if (res.headersSent) res.destroy(); else { res.writeHead(error.status || 500); res.end(error.code || error.message) } }
  })
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve))
  t.after(async () => { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)) })
  return `http://127.0.0.1:${instance.address().port}`
}

function audio(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'Content-Type': 'audio/mp4', ...headers } })
}

test('playback URLs reject private hosts, credentials, insecure protocols and deceptive domains', () => {
  assert.equal(validatePlaybackUrl(source.url).hostname, 'rr1---sn-example.googlevideo.com')
  for (const value of ['http://rr1.googlevideo.com/videoplayback', 'https://localhost/videoplayback', 'https://127.0.0.1/videoplayback', 'https://rr1.googlevideo.com.evil.test/videoplayback', 'https://evilgooglevideo.com/videoplayback', 'https://name:secret@rr1.googlevideo.com/videoplayback', 'https://rr1.googlevideo.com:9443/videoplayback', 'file:///private', 'https://rr1.googlevideo.com/not-audio']) assert.throws(() => validatePlaybackUrl(value), error => error.code === 'UNSAFE_AUDIO_SOURCE')
})

test('direct playback forwards only validated byte ranges, not cookies or authorization', async t => {
  let calls = 0
  const url = await server(t, async () => source, async (target, options) => {
    calls += 1
    assert.equal(target, source.url)
    assert.equal(options.headers.Range, 'bytes=2-5')
    assert.equal(options.headers.Cookie, undefined)
    assert.equal(options.headers.Authorization, undefined)
    assert.equal(options.redirect, 'manual')
    return audio('cdef', 206, { 'Content-Range': 'bytes 2-5/10', 'Content-Length': '4' })
  })
  const result = await fetch(url, { headers: { Range: 'bytes=2-5', Cookie: 'explicit-fixture=not-a-login', Authorization: 'Explicit test fixture' } })
  assert.equal(result.status, 206)
  assert.equal(result.headers.get('content-type'), 'audio/mp4')
  assert.equal(result.headers.get('content-range'), 'bytes 2-5/10')
  assert.equal(result.headers.get('x-mitune-playback'), 'direct')
  assert.equal(await result.text(), 'cdef')
  assert.equal(calls, 1)
})

test('progressive playback delivers the first bytes before the source finishes', async t => {
  let release
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('first'))
    release = () => { controller.enqueue(new TextEncoder().encode('last')); controller.close() }
  } })
  const url = await server(t, async () => source, async () => audio(body))
  const result = await fetch(url)
  const reader = result.body.getReader()
  try {
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'first')
    release()
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'last')
    assert.equal((await reader.read()).done, true)
  } finally { await reader.cancel().catch(() => {}) }
})

test('an expired source is resolved once more and a second refusal stays an error', async t => {
  const refresh = []
  let requests = 0
  const url = await server(t, async force => { refresh.push(force); return source }, async () => {
    requests += 1
    return requests === 1 ? new Response(null, { status: 403 }) : audio('fresh')
  })
  const result = await fetch(url)
  assert.equal(await result.text(), 'fresh')
  assert.deepEqual(refresh, [false, true])
  assert.equal(requests, 2)
  let refused = 0
  const unavailable = await server(t, async () => source, async () => { refused += 1; return new Response(null, { status: 403 }) })
  const failed = await fetch(unavailable)
  assert.equal(failed.status, 502)
  assert.equal(await failed.text(), 'AUDIO_SOURCE_UNAVAILABLE')
  assert.equal(refused, 2)
})

test('a source redirect cannot reach a private service and malformed ranges never resolve sources', async t => {
  let requests = 0
  const url = await server(t, async () => source, async () => { requests += 1; return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1:5432/private' } }) })
  const result = await fetch(url)
  assert.equal(result.status, 502)
  assert.equal(await result.text(), 'UNSAFE_AUDIO_SOURCE')
  assert.equal(requests, 1)
  let resolutions = 0
  const invalid = await server(t, async () => { resolutions += 1; return source }, async () => audio('unused'))
  const range = await fetch(invalid, { headers: { Range: 'bytes=0-2,4-5' } })
  assert.equal(range.status, 416)
  assert.equal(resolutions, 0)
})

test('HEAD and unsatisfied ranges retain upstream transport semantics', async t => {
  const url = await server(t, async () => source, async (target, options) => {
    if (options.headers.Range) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */10' } })
    assert.equal(options.method, 'HEAD')
    return audio(null, 200, { 'Content-Length': '10' })
  })
  const head = await fetch(url, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), '10')
  assert.equal(await head.text(), '')
  const range = await fetch(url, { headers: { Range: 'bytes=99-' } })
  assert.equal(range.status, 416)
  assert.equal(range.headers.get('content-range'), 'bytes */10')
})

test('unsupported direct formats return to the existing MP3 path', async t => {
  const url = await server(t, async () => ({ ...source, url: null }), async () => { throw new Error('Must not fetch') })
  assert.equal((await fetch(url)).status, 409)
})

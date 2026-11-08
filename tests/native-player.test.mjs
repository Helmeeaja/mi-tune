import test from 'node:test'
import assert from 'node:assert/strict'
import { hasNativePlayer, nativeCommand, subscribeNativePlayer, cacheNativeDownload } from '../src/lib/native-player.mjs'

function explicitNativeFixture() {
  const commands = []
  const parts = []
  const bridge = { postMessage(raw) {
    const request = JSON.parse(raw)
    commands.push(request)
    if (request.action === 'cache-chunk') parts.push(Buffer.from(request.payload.data, 'base64'))
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: request.id, ok: true, ...(request.action.startsWith('cache-') ? { result: { cached: true, bytes: parts.reduce((sum, part) => sum + part.length, 0) } } : { state: { track: request.payload.track || null, playing: request.action === 'play', position: 12, duration: 180 } }) }) }))
  } }
  return { bridge, commands, parts }
}

const song = { id: 'yt:abcdefghijk', type: 'song', source: 'youtube-music', title: 'Explicit fixture song', artist: 'Explicit fixture artist', duration: 180 }

test('browser playback cannot claim a native bridge exists', async () => {
  assert.equal(hasNativePlayer(), false)
  await assert.rejects(nativeCommand('play', {}), error => error.code === 'NATIVE_UNAVAILABLE')
  await assert.rejects(nativeCommand('fake-notification', {}), /tidak valid/)
})

test('real bridge protocol sends playback controls and receives state, not decorative notifications', async () => {
  const { bridge, commands } = explicitNativeFixture()
  const old = globalThis.window
  globalThis.window = { MiTuneNative: bridge }
  const states = []
  const unsubscribe = subscribeNativePlayer(state => states.push(state))
  try {
    assert.equal(hasNativePlayer(), true)
    const result = await nativeCommand('play', { track: song, queue: [song], volume: 0.5 })
    assert.equal(result.playing, true)
    assert.equal(commands[0].action, 'play')
    assert.deepEqual(commands[0].payload.queue, [song])
    for (const action of ['pause', 'resume', 'next', 'previous', 'seek']) await nativeCommand(action, action === 'seek' ? { position: 30 } : {})
    assert.deepEqual(commands.map(command => command.action), ['play', 'pause', 'resume', 'next', 'previous', 'seek'])
    assert.equal(states.length, 6)
    bridge.onmessage({ data: JSON.stringify({ type: 'state', state: { position: 20, playing: true } }) })
    assert.equal(states.at(-1).position, 20)
  } finally { unsubscribe(); if (old === undefined) delete globalThis.window; else globalThis.window = old }
})

test('explicit offline fixture reaches native storage in exact ordered chunks', async () => {
  const fixture = explicitNativeFixture()
  const old = globalThis.window
  globalThis.window = { MiTuneNative: fixture.bridge }
  try {
    const bytes = Buffer.alloc(220000, 37)
    assert.equal(await cacheNativeDownload({ track: song, audio: new Blob([bytes], { type: 'audio/mpeg' }) }, 'fixture-owner'), true)
    assert.deepEqual(Buffer.concat(fixture.parts), bytes)
    assert.equal(fixture.commands[0].action, 'cache-start')
    assert.equal(fixture.commands.at(-1).action, 'cache-finish')
    assert.equal(fixture.commands.filter(command => command.action === 'cache-chunk').length, 3)
  } finally { if (old === undefined) delete globalThis.window; else globalThis.window = old }
})

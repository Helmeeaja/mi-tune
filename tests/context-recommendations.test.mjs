import test from 'node:test'
import assert from 'node:assert/strict'
import { selectContextTracks, readContextCache, saveContextCache } from '../src/lib/context-recommendations.mjs'

const first = { id: 'yt:aaaaaaaaaaa', title: 'Explicit isolated mood fixture A', artist: 'Fixture A' }
const second = { ...first, id: 'yt:bbbbbbbbbbb', title: 'Explicit isolated mood fixture B' }
const third = { ...first, id: 'yt:ccccccccccc', artist: 'Fixture B' }

test('context picks retain authentic metadata, diversify and never duplicate identities', () => {
  assert.deepEqual(selectContextTracks([first, second, first, third, { ...first, id: 'bad' }]).map(track => track.id), [first.id, third.id, second.id])
  assert.equal(selectContextTracks({ tracks: [first] })[0], first)
  assert.deepEqual(selectContextTracks(null), [])
  assert.deepEqual(selectContextTracks([first, third], 1), [third, first])
})

test('context caches never borrow a different day/time mood and tolerate device storage failures', () => {
  const store = new Map()
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }
  const value = { key: '1-morning', mixes: [{ query: 'upbeat acoustic music', tracks: [first, first] }], updatedAt: 42 }
  assert.equal(saveContextCache(value, storage), true)
  const saved = readContextCache('1-morning', storage)
  assert.equal(saved.stale, true)
  assert.deepEqual(saved.mixes[0].tracks, [first])
  assert.equal(readContextCache('5-night', storage), null)
  assert.equal(readContextCache('1-morning', { getItem() { throw new Error('Explicit fixture denied storage') } }), null)
  assert.equal(saveContextCache(value, { setItem() { throw new Error('Explicit fixture denied storage') } }), false)
  store.set('mi-tune-atmosphere-tracks:1-morning', '{broken')
  assert.equal(readContextCache('1-morning', storage), null)
})

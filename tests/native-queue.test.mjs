import test from 'node:test'
import assert from 'node:assert/strict'
import { nativeTrack, nativeQueue } from '../src/lib/native-queue.mjs'

function episode(index) { return { id: `podcast:yt:${String(index).padStart(11,'0')}`, type: 'episode', source: 'youtube-music-podcast', musicType: 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE', title: `Explicit episode fixture ${index}`, artist: 'Explicit fixture creator', duration: 3600, description: 'Explicit large description fixture. '.repeat(1000), thumbnail: '', coverUrl: '/api/podcasts/episodes/fixture/cover' } }

test('native notification metadata stays compact and never changes title or identifier', () => {
  const original = episode(1)
  const result = nativeTrack(original)
  assert.equal(result.title, original.title)
  assert.equal(result.id, original.id)
  assert.equal(result.type, 'episode')
  assert.equal(result.description, undefined)
  assert.ok(JSON.stringify(result).length < 1000)
  assert.throws(() => nativeTrack({ id: 'PODCAST:yt:abcdefghijk' }), /tidak valid/)
})

test('large podcast catalogs become bounded native-owned queues containing the selected episode', () => {
  const all = Array.from({length:263},(_,index)=>episode(index))
  const result = nativeQueue(all, all[250])
  assert.equal(result.length, 200)
  assert.equal(result[0].id, all[250].id)
  assert.equal(new Set(result.map(item=>item.id)).size, 200)
  assert.equal(result[13].id, all[0].id)
  assert.deepEqual(nativeQueue([],all[1]),[nativeTrack(all[1])])
})

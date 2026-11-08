import test from 'node:test'
import assert from 'node:assert/strict'
import { isPodcastEpisode, mediaPath, mediaDetailPath, podcastPathId, readPodcastProgress, savePodcastProgress, creatorEpisodes, episodeDate } from '../src/lib/podcasts.mjs'

const first = { id: 'podcast:yt:abcdefghijk', type: 'episode', duration: 3600, title: 'Fixture podcast episode' }
const second = { ...first, id: 'podcast:yt:ABCDEFGHIJK' }
const store = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) } }

test('podcast identity and routing remain separate from music', () => {
  assert.equal(isPodcastEpisode(first), true)
  assert.equal(isPodcastEpisode({ ...first, type: 'song' }), false)
  assert.equal(isPodcastEpisode({ ...first, id: 'yt:abcdefghijk' }), false)
  assert.equal(mediaPath(first), '/api/podcasts/episodes/podcast%3Ayt%3Aabcdefghijk/stream')
  assert.equal(mediaPath(first, true), '/api/podcasts/episodes/podcast%3Ayt%3Aabcdefghijk/stream')
  assert.equal(mediaPath({ id: 'yt:abcdefghijk' }), '/api/tracks/yt%3Aabcdefghijk/stream')
  assert.equal(mediaPath({ id: 'yt:abcdefghijk' }, true), '/api/tracks/yt%3Aabcdefghijk/audio')
  assert.equal(mediaDetailPath(first), '/podcasts/episode/podcast%3Ayt%3Aabcdefghijk')
  assert.equal(podcastPathId(mediaDetailPath(first), 'episode'), first.id)
  assert.equal(podcastPathId('/podcasts/episode/podcast%3Ayt%3Ashort', 'episode'), null)
  assert.equal(podcastPathId('/podcasts/episode/%zz', 'episode'), null)
  assert.throws(() => mediaPath({ id: 'https://evil.example/audio' }))
})

test('episode resume is bounded, durable and cleared at the end', () => {
  const storage = store()
  assert.equal(savePodcastProgress(first, 120, 3600, storage), true)
  assert.equal(readPodcastProgress(storage)[first.id].position, 120)
  assert.equal(savePodcastProgress(first, NaN, 3600, storage), false)
  assert.equal(savePodcastProgress(first, 3595, 3600, storage), true)
  assert.equal(readPodcastProgress(storage)[first.id], undefined)
  storage.setItem('mi-tune-podcast-progress', '{broken')
  assert.deepEqual(readPodcastProgress(storage), {})
  for (let index = 0; index < 110; index += 1) savePodcastProgress({ ...first, id: `podcast:yt:${String(index).padStart(11, '0')}` }, 300, 3600, storage)
  assert.equal(Object.keys(readPodcastProgress(storage)).length, 100)
})

test('creator episodes are deduplicated and never fabricate publication dates', () => {
  assert.deepEqual(creatorEpisodes({ episodes: [first], shows: [{ episodes: [first, second, { id: 'yt:abcdefghijk', type: 'song' }] }] }), [first, second])
  assert.equal(episodeDate(first, 'en-US'), '')
  assert.equal(episodeDate({ publishedAt: 'invalid' }, 'en-US'), '')
  assert.match(episodeDate({ publishedAt: '2026-11-06T00:00:00Z' }, 'en-US'), /2026/)
})

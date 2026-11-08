import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createPodcastService, normalizePodcastEpisode, normalizePodcastCreator, normalizePodcastFeed } from '../server/podcasts.mjs'
import { createApplication } from '../server/app.mjs'

const creatorId = 'UCaaaaaaaaaaaaaaaaaaaaaa'
const showId = 'MPSPPLaaaaaaaaaaaaaaaaaaaaaa'
const episode = { id: 'podcast:yt:abcdefghijk', videoId: 'abcdefghijk', type: 'episode', contentKind: 'podcast', source: 'youtube-music-podcast', musicType: 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE', title: 'Explicit podcast test fixture', artist: 'Explicit creator fixture', artists: ['Explicit creator fixture'], creatorId, showId, duration: 3600, thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' }
const show = { id: showId, title: 'Explicit show fixture', creatorId, episodes: [episode] }
const creator = { id: creatorId, name: episode.artist, source: 'youtube-music-podcast', episodes: [episode], shows: [show], thumbnail: '' }
const feed = { creators: [creator], episodes: [episode], shows: [show], source: 'Explicit synthetic podcast fixture, not a live source' }

function fixtureRunner(calls) {
  return async (binary, args) => {
    const mode = args[1]
    calls.push(mode)
    return JSON.stringify(mode === 'creator' ? creator : mode === 'episode' ? episode : feed)
  }
}

test('podcasts reject music, malformed ids and arbitrary creator audio', () => {
  assert.equal(normalizePodcastEpisode(episode).id, episode.id)
  assert.equal(normalizePodcastEpisode({ ...episode, type: 'song' }), null)
  assert.equal(normalizePodcastEpisode({ ...episode, source: 'youtube-music', musicType: 'MUSIC_VIDEO_TYPE_ATV' }), null)
  assert.equal(normalizePodcastEpisode({ ...episode, source: 'youtube-creator-audio', contentKind: 'audio-essay' }), null)
  assert.equal(normalizePodcastEpisode({ ...episode, id: 'PODCAST:yt:abcdefghijk' }), null)
  assert.equal(normalizePodcastEpisode({ ...episode, duration: NaN }), null)
  assert.equal(normalizePodcastEpisode({ ...episode, thumbnail: 'http://127.0.0.1/secret' }).thumbnail, '')
  assert.equal(normalizePodcastCreator({ ...creator, id: 'invalid' }), null)
})

test('normalized podcast feeds declare only actual deduplicated items', () => {
  const result = normalizePodcastFeed({ ...feed, episodes: [episode, episode] })
  assert.equal(result.creatorCount, result.creators.length)
  assert.equal(result.episodeCount, result.episodes.length)
  assert.equal(result.showCount, result.shows.length)
  assert.equal(result.episodeCount, 1)
  assert.equal(result.episodes[0].coverUrl, '/api/podcasts/episodes/podcast%3Ayt%3Aabcdefghijk/cover')
})

test('source requests coalesce and validated cache survives reopening without pretending to refresh', async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR, 'podcast-cache-test-'))
  const calls = []
  let first
  let second
  try {
    first = createPodcastService({ dataDir: directory, runCommand: fixtureRunner(calls) })
    const results = await Promise.all([first.discover(), first.discover()])
    assert.equal(calls.filter(mode => mode === 'discover').length, 1)
    assert.equal(results[0].episodeCount, 1)
    first.close()
    second = createPodcastService({ dataDir: directory, runCommand: async () => { throw new Error('Explicit isolated unavailable fixture') } })
    const cached = await second.discover()
    assert.equal(cached.episodes[0].id, episode.id)
    const stale = await second.discover({ refresh: true })
    assert.equal(stale.stale, true)
    assert.equal(stale.updatedAt, cached.updatedAt)
    assert.throws(() => second.search('https://evil.example'), error => error.code === 'INVALID_PODCAST_SEARCH')
    assert.throws(() => second.episode('yt:abcdefghijk'), error => error.code === 'INVALID_PODCAST_EPISODE')
  } finally { first?.close(); second?.close(); await rm(directory, { recursive: true, force: true }) }
})

test('creator and episode routes keep music endpoints separate and work for guests', async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR, 'podcast-http-test-'))
  const service = createPodcastService({ dataDir: directory, runCommand: fixtureRunner([]) })
  const music = { lookup: () => null, close() {} }
  const app = await createApplication({ dataDir: directory, musicService: music, podcastService: service })
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${app.server.address().port}`
    const discovery = await (await fetch(base + '/api/podcasts/discover')).json()
    assert.equal(discovery.data.episodeCount, 1)
    const profile = await (await fetch(base + `/api/podcasts/creators/${creatorId}`)).json()
    assert.equal(profile.data.creator.id, creatorId)
    const detail = await (await fetch(base + '/api/podcasts/episodes/podcast%3Ayt%3Aabcdefghijk')).json()
    assert.equal(detail.data.episode.id, episode.id)
    assert.equal((await fetch(base + '/api/tracks/podcast%3Ayt%3Aabcdefghijk')).status, 404)
    assert.equal((await fetch(base + '/api/podcasts/episodes/yt%3Aabcdefghijk')).status, 404)
    const health = await (await fetch(base + '/api/health')).json()
    assert.equal(health.data.source, 'youtube-music')
    assert.equal(health.data.podcastsAvailable, true)
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }) }
})

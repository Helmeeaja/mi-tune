import test from 'node:test'
import assert from 'node:assert/strict'
import { isTrendingFeed, readTrendingFeed, isSpotifyFeed, readSpotifyFeed, chooseTrendingRecommendations } from '../src/lib/trending-recommendations.mjs'

const tracks = Array.from({ length: 30 }, (_, index) => ({ id: `audius:fixture${index}`, source: 'audius', type: 'song', musicType: 'FULL_TRACK', title: `Explicit fixture song ${index}`, artist: `Artist ${Math.floor(index / 4)}`, artists: [`Artist ${Math.floor(index / 4)}`], chartRank: index + 1, rankingSource: 'audius' }))
const feed = { chartOrigin: 'audius', chartProvider: 'audius', chartVersion: 4, chartId: 'audius:trending:week', source: 'Explicit Audius reference fixture, not a live chart', sourceUrl: 'https://audius.co/explore', updatedAt: 1794111292217, region: 'ZZ', tracks }

const legacyTracks = Array.from({ length: 30 }, (_, index) => ({ id: `yt:${String(index).padStart(11, '0')}`, source: 'youtube-music', type: 'song', musicType: 'MUSIC_VIDEO_TYPE_ATV', artists: ['Explicit legacy fixture artist'], spotifyUri: `spotify:track:${String(index).padStart(22, '0')}`, rankingSource: 'spotify' }))
const legacy = { chartOrigin: 'spotify', chartProvider: 'spotify', chartVersion: 3, chartId: '37i9dQZEVXbMDoHDwVN2tF', sourceUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF', updatedAt: 1794111292217, region: 'ZZ', tracks: legacyTracks }

test('homepage recommendations rotate only tracks from the same verified Audius feed', () => {
  assert.equal(isTrendingFeed(feed), true)
  assert.equal(isSpotifyFeed(feed), false)
  const result = chooseTrendingRecommendations(feed)
  assert.deepEqual(result, chooseTrendingRecommendations(feed))
  assert.equal(result.mixes.length, 2)
  const originalIds = new Set(tracks.map(track => track.id))
  assert.ok([...result.tracks, ...result.mixes.flatMap(mix => mix.tracks)].every(track => originalIds.has(track.id) && track.source === 'audius'))
  for (const artist of new Set(result.tracks.map(track => track.artist))) assert.ok(result.tracks.filter(track => track.artist === artist).length <= 2)
  assert.ok(result.mixes[1].tracks.every(track => !result.mixes[0].tracks.some(item => item.id === track.id)))
})

test('foreign, regional or mixed-source tracks cannot be relabeled as Audius trending', () => {
  assert.equal(isTrendingFeed({ ...feed, chartOrigin: undefined }), false)
  assert.equal(isTrendingFeed({ ...feed, region: 'ID' }), false)
  assert.equal(isTrendingFeed({ ...feed, sourceUrl: 'https://evil.example/chart' }), false)
  assert.equal(isTrendingFeed({ ...feed, chartProvider: 'spotify' }), false)
  assert.equal(isTrendingFeed({ ...feed, tracks: [legacyTracks[0], ...tracks] }), false)
  assert.deepEqual(chooseTrendingRecommendations({ ...feed, chartOrigin: 'youtube' }), { tracks: [], mixes: [] })
  const fallback = { tracks: [] }
  assert.equal(readTrendingFeed('test', fallback, { getItem: () => JSON.stringify({ ...feed, chartOrigin: 'youtube' }) }), fallback)
  assert.equal(readTrendingFeed('test', fallback, { getItem: () => JSON.stringify(feed) }).stale, true)
})

test('legacy Spotify records preserve their original source without becoming Audius tracks', () => {
  assert.equal(isSpotifyFeed(legacy), true)
  assert.equal(isTrendingFeed({ ...legacy, chartOrigin: 'audius' }), false)
  assert.equal(isSpotifyFeed({ ...legacy, region: 'ID' }), false)
  const fallback = { tracks: [] }
  assert.equal(readSpotifyFeed('test', fallback, { getItem: () => JSON.stringify(feed) }), fallback)
  assert.equal(readSpotifyFeed('test', fallback, { getItem: () => JSON.stringify(legacy) }).stale, true)
})

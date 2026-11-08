import test from 'node:test'
import assert from 'node:assert/strict'
import { isSpotifyFeed, readSpotifyFeed, chooseTrendingRecommendations } from '../src/lib/trending-recommendations.mjs'

const tracks = Array.from({ length: 30 }, (_, index) => ({ id: `yt:${String(index).padStart(11, '0')}`, source: 'youtube-music', type: 'song', musicType: 'MUSIC_VIDEO_TYPE_ATV', title: `Fixture song ${index}`, artist: `Artist ${Math.floor(index / 4)}`, artists: [`Artist ${Math.floor(index / 4)}`], chartRank: index + 1, spotifyUri: `spotify:track:${String(index).padStart(22, '0')}`, rankingSource: 'spotify' }))
const feed = { chartOrigin: 'spotify', chartProvider: 'spotify', chartVersion: 3, chartId: '37i9dQZEVXbMDoHDwVN2tF', source: 'Explicit Spotify reference fixture, not a live chart', sourceUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF', dateKind: 'retrieved', updatedAt: 1794111292217, region: 'ZZ', tracks }

test('homepage recommendations use Spotify-chart matched music, not a second music API', () => {
  assert.equal(isSpotifyFeed(feed), true)
  const result = chooseTrendingRecommendations(feed)
  assert.equal(result.tracks[0].id, tracks[0].id)
  assert.equal(result.mixes.length, 2)
  const originalIds = new Set(tracks.map(track => track.id))
  assert.ok([...result.tracks, ...result.mixes.flatMap(mix => mix.tracks)].every(track => originalIds.has(track.id)))
  for (const artist of new Set(result.tracks.map(track => track.artist))) assert.ok(result.tracks.filter(track => track.artist === artist).length <= 2)
  assert.ok(result.mixes[1].tracks.every(track => !result.mixes[0].tracks.some(item => item.id === track.id)))
})

test('local or legacy charts cannot be mislabeled as current Spotify recommendations', () => {
  assert.equal(isSpotifyFeed({ ...feed, chartOrigin: undefined }), false)
  assert.equal(isSpotifyFeed({ ...feed, region: 'ID' }), false)
  assert.equal(isSpotifyFeed({ ...feed, sourceUrl: 'https://evil.example/chart' }), false)
  assert.deepEqual(chooseTrendingRecommendations({ ...feed, chartOrigin: 'youtube' }), { tracks: [], mixes: [] })
  const fallback = { tracks: [] }
  assert.equal(readSpotifyFeed('test', fallback, { getItem: () => JSON.stringify({ ...feed, chartOrigin: 'youtube' }) }), fallback)
  assert.equal(readSpotifyFeed('test', fallback, { getItem: () => JSON.stringify(feed) }).stale, true)
})

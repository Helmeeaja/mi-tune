import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudiusService, normalizeAudiusTrack } from '../server/audius.mjs'
import { mediaPath, mediaDetailPath } from '../src/lib/podcasts.mjs'
import { nativeTrack } from '../src/lib/native-queue.mjs'

function explicitTrackFixture() {
  return { id: 'fixture123', title: 'Explicit full-track fixture', duration: 210, is_streamable: true, is_stream_gated: false, is_downloadable: false, user: { id: 'fixtureUser', name: 'Explicit artist fixture' }, artwork: { '480x480': 'https://example.com/fixture.jpg' } }
}

test('Audius identities stay distinct across web, artist links and native queues', () => {
  const song = normalizeAudiusTrack(explicitTrackFixture())
  assert.equal(song.id, 'audius:fixture123')
  assert.equal(song.source, 'audius')
  assert.equal(song.musicType, 'FULL_TRACK')
  assert.equal(song.artistRefs[0].id, 'audius:user:fixtureUser')
  assert.equal(mediaPath(song), '/api/tracks/audius%3Afixture123/stream')
  assert.equal(mediaDetailPath(song), '/track/audius%3Afixture123')
  assert.equal(nativeTrack(song).id, song.id)
})

test('gated, unavailable and non-streamable records never become free full tracks', () => {
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), is_stream_gated: true }), null)
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), is_streamable: false }), null)
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), is_available: false }), null)
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), is_delete: true }), null)
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), id: '../invalid' }), null)
})

test('free downloads require the actual artist flag and cannot bypass download gating', () => {
  assert.equal(normalizeAudiusTrack(explicitTrackFixture()).downloadAllowed, false)
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), is_downloadable: true }).downloadAllowed, true)
  assert.equal(normalizeAudiusTrack({ ...explicitTrackFixture(), is_downloadable: true, is_download_gated: true }).downloadAllowed, false)
})

test('download-denied fixture fails before opening an audio stream', async () => {
  let requests = 0
  const service = createAudiusService({ fetcher: async url => {
    requests++
    assert.equal(new URL(url).pathname, '/v1/tracks/fixture123')
    return new Response(JSON.stringify({ data: [explicitTrackFixture()] }), { status: 200 })
  } })
  await assert.rejects(service.stream('audius:fixture123', { headers: {} }, {}, { download: true }), error => error.code === 'AUDIUS_DOWNLOAD_NOT_ALLOWED' && error.status === 403)
  assert.equal(requests, 1)
  service.close()
})

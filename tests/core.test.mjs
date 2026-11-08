import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { resolveRange } from '../server/range.mjs'
import { normalizeSong, createYoutubeService, validateTrackId } from '../server/youtube.mjs'
import { parseLrc, getActiveLyricIndex } from '../src/lib/lyrics.mjs'
import { createApplication } from '../server/app.mjs'

const scratch = process.env.TMPDIR
assert.ok(scratch, 'Isolated test storage must use the configured scratch directory')
const fixtureRow = { resultType: 'song', videoType: 'MUSIC_VIDEO_TYPE_ATV', videoId: 'aaaaaaaaaaa', title: 'Fixture song', artists: ['Fixture artist'], album: 'Fixture album', duration: 190, thumbnail: 'https://yt3.googleusercontent.com/example' }
const fixtureSong = normalizeSong(fixtureRow)

test('range requests include seek, suffix, open-end and invalid boundaries', () => {
  assert.equal(resolveRange(null, 100), null)
  assert.deepEqual(resolveRange('bytes=10-19', 100), { start: 10, end: 19 })
  assert.deepEqual(resolveRange('bytes=90-', 100), { start: 90, end: 99 })
  assert.deepEqual(resolveRange('bytes=-10', 100), { start: 90, end: 99 })
  assert.deepEqual(resolveRange('bytes=0-999', 100), { start: 0, end: 99 })
  for (const input of ['bytes=100-', 'bytes=-0', 'bytes=2-1', 'bytes=0-1,2-3', 'bytes=-', 'items=1-2']) assert.throws(() => resolveRange(input, 100), RangeError)
})

test('catalogue admits registered YouTube Music songs, never generic videos or podcasts', () => {
  assert.equal(fixtureSong.type, 'song')
  assert.equal(fixtureSong.source, 'youtube-music')
  assert.equal(normalizeSong({ ...fixtureRow, resultType: 'video' }), null)
  assert.equal(normalizeSong({ ...fixtureRow, resultType: 'episode' }), null)
  assert.equal(normalizeSong({ ...fixtureRow, videoType: 'MUSIC_VIDEO_TYPE_OMV' }), null)
  assert.equal(normalizeSong({ ...fixtureRow, artists: [] }), null)
  assert.equal(normalizeSong({ ...fixtureRow, duration: 9000 }), null)
  assert.equal(normalizeSong({ ...fixtureRow, videoId: '../private' }), null)
  assert.equal(normalizeSong({ ...fixtureRow, thumbnail: 'http://127.0.0.1:22/private' }).thumbnail, '')
  assert.throws(() => validateTrackId('yt:aaaaaaaaaaa-extra'))
})

test('unregistered film or arbitrary ID cannot start extraction', async () => {
  const directory = await mkdtemp(join(scratch, 'mi-tune-source-test-'))
  const source = createYoutubeService({ dataDir: directory, executable: '/nonexistent-tool' })
  try {
    await assert.rejects(source.prepare('yt:aqz-KE-bpKQ'), error => error.status === 404)
    await assert.rejects(source.metadata('yt:aqz-KE-bpKQ'), error => error.status === 404)
    await assert.rejects(source.search('https://youtube.com/watch?v=aqz-KE-bpKQ'), error => error.status === 400)
    assert.throws(() => source.audio('yt:aqz-KE-bpKQ'), error => error.status === 404)
  } finally { source.close(); await rm(directory, { recursive: true, force: true }) }
})

test('real audio-clock lyric selection handles fractional timestamps, offsets, repeats and seeking', () => {
  const lines = parseLrc('[offset:100]\n[00:01.50][00:03.000]Fixture line\n[00:05.25]Second fixture\n[01:99.00]Invalid')
  assert.deepEqual(lines.map(line => line.time), [1.6, 3.1, 5.35])
  assert.equal(getActiveLyricIndex(lines, 0), -1)
  assert.equal(getActiveLyricIndex(lines, 3.15), 1)
  assert.equal(getActiveLyricIndex(lines, 1.7), 0)
  assert.equal(getActiveLyricIndex(lines, 100), 2)
  assert.deepEqual(parseLrc('plain text without timestamps'), [])
})

test('HTTP accounts, ownership, friends, MP3 range transport, CSRF and session persistence', async () => {
  const directory = await mkdtemp(join(scratch, 'mi-tune-http-test-'))
  const audioPath = join(directory, 'transport-fixture.bin')
  await writeFile(audioPath, Buffer.alloc(512, 7))
  const job = { id: randomUUID(), trackId: fixtureSong.id, status: 'ready', progress: 100, stage: 'Fixture ready', error: null, track: fixtureSong }
  const fixtureSource = {
    search: async () => [fixtureSong], lookup: id => id === fixtureSong.id ? { ...fixtureSong, thumbnail: '' } : undefined,
    prepare: async () => job, job: id => id === job.id ? job : undefined,
    audio: id => id === fixtureSong.id ? { path: audioPath, size: 512, mime: 'audio/mpeg', track: fixtureSong } : undefined,
    close() {},
  }
  const create = () => createApplication({ dataDir: directory, musicService: fixtureSource, lyricsFetcher: async () => ({ matched: false, source: 'fixture', plainLyrics: null, syncedLyrics: null }), refreshIntervalMs: 60000 })
  let application = await create()
  await new Promise(resolve => application.server.listen(0, '127.0.0.1', resolve))
  let base = `http://127.0.0.1:${application.server.address().port}`
  function client() {
    const cookies = new Map()
    return async function call(path, method = 'GET', value, headers = {}) {
      const result = await fetch(base + '/api' + path, { method, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(value !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: value !== undefined ? JSON.stringify(value) : undefined })
      for (const cookie of result.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)) }
      const payload = result.headers.get('content-type')?.includes('application/json') ? await result.json() : await result.arrayBuffer()
      return { status: result.status, headers: result.headers, data: payload.data, error: payload.error, raw: payload }
    }
  }
  const a = client(), b = client(), c = client()
  const password = randomBytes(18).toString('base64url')
  try {
    const userA = (await a('/auth/register', 'POST', { username: 'fixture_a', displayName: 'Fixture A', password })).data
    const userB = (await b('/auth/register', 'POST', { username: 'fixture_b', displayName: 'Fixture B', password })).data
    await c('/auth/register', 'POST', { username: 'fixture_c', password })
    assert.equal((await a('/auth/me')).data.user, null)
    assert.equal((await a('/auth/login', 'POST', { username: 'fixture_a', password })).status, 200)
    assert.equal((await b('/auth/login', 'POST', { username: 'fixture_b', password })).status, 200)
    await c('/auth/login', 'POST', { username: 'fixture_c', password })
    assert.equal((await a('/auth/me')).data.user.id, userA.id)
    assert.equal((await a('/search?q=fixture')).data.tracks.length, 1)
    const playlist = (await a('/playlists', 'POST', { name: 'My fixture list' })).data
    assert.equal((await b(`/playlists/${playlist.id}`, 'PATCH', { name: 'Hijacked' })).status, 404)
    assert.equal((await a(`/playlists/${playlist.id}/tracks`, 'PUT', { trackIds: [fixtureSong.id] })).status, 200)
    await a(`/favorites/${encodeURIComponent(fixtureSong.id)}`, 'PUT', { liked: true })
    assert.deepEqual((await a('/library')).data.favoriteIds, [fixtureSong.id])
    assert.equal((await b('/library')).data.playlists.length, 0)
    assert.equal((await a('/playlists', 'POST', { name: 'Cross site' }, { Origin: 'https://attacker.invalid' })).status, 403)
    assert.equal((await a('/users?q=fixture_b')).data[0].id, userB.id)
    const request = (await a('/friend-requests', 'POST', { userId: userB.id })).data
    assert.equal((await b('/friends')).data.incoming[0].id, request.id)
    assert.equal((await c(`/friend-requests/${request.id}`, 'PATCH', { action: 'accept' })).status, 404)
    await b(`/friend-requests/${request.id}`, 'PATCH', { action: 'accept' })
    assert.equal((await a('/friends')).data.friends[0].id, userB.id)
    assert.equal((await b('/friends')).data.friends[0].id, userA.id)
    await a(`/friends/${userB.id}`, 'DELETE')
    assert.equal((await b('/friends')).data.friends.length, 0)
    assert.equal((await a('/media/jobs', 'POST', { trackId: fixtureSong.id, rightsConfirmed: false })).status, 400)
    assert.equal((await a('/media/jobs', 'POST', { trackId: fixtureSong.id, purpose: 'playback' })).status, 200)
    assert.equal((await a('/media/jobs', 'POST', { trackId: fixtureSong.id, purpose: 'download', rightsConfirmed: false })).status, 400)
    assert.equal((await a('/media/jobs', 'POST', { trackId: fixtureSong.id, purpose: 'invalid' })).status, 400)
    assert.equal((await a('/media/jobs', 'POST', { trackId: 'yt:aqz-KE-bpKQ', purpose: 'playback' })).status, 404)
    assert.equal((await a('/media/jobs', 'POST', { trackId: fixtureSong.id, rightsConfirmed: true })).status, 200)
    assert.equal((await b(`/media/jobs/${job.id}`)).status, 404)
    const response = await a(`/tracks/${encodeURIComponent(fixtureSong.id)}/audio`, 'GET', undefined, { Range: 'bytes=10-29' })
    assert.equal(response.status, 206)
    assert.equal(response.raw.byteLength, 20)
    assert.equal(response.headers.get('content-range'), 'bytes 10-29/512')
    assert.equal((await a(`/tracks/${encodeURIComponent(fixtureSong.id)}/cover`)).status, 404)
    assert.equal((await a('/health')).status, 200)
    await application.close()
    application = await create()
    await new Promise(resolve => application.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${application.server.address().port}`
    assert.equal((await a('/auth/me')).data.user.id, userA.id)
    assert.equal((await a('/library')).data.playlists[0].trackIds[0], fixtureSong.id)
    await a('/auth/logout', 'POST')
    assert.equal((await a('/auth/me')).data.user, null)
  } finally { await application.close(); await rm(directory, { recursive: true, force: true }) }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { createYoutubeService } from '../server/youtube.mjs'

const scratch = process.env.TMPDIR
assert.ok(scratch)
const artistId = 'UC' + 'a'.repeat(22)
const albumId = 'MPREb_fixturealbum1'
const song = { id: 'yt:aaaaaaaaaaa', title: 'Explicit artist fixture song', artist: 'Fixture artist', artists: ['Fixture artist'], artistRefs: [{ id: artistId, name: 'Fixture artist' }], album: 'Fixture album', albumId, duration: 180, source: 'youtube-music', type: 'song', musicType: 'MUSIC_VIDEO_TYPE_ATV' }
const artist = { id: artistId, name: 'Fixture artist', thumbnail: '', description: 'Explicit isolated fixture, not a live musician.', tracks: [song], albums: [{ id: albumId, title: 'Fixture album', year: '2026', type: 'Album', thumbnail: '', artists: [{ id: artistId, name: 'Fixture artist' }] }], singles: [], related: [], source: 'youtube-music', updatedAt: Date.now(), stale: false }
const album = { ...artist.albums[0], description: '', tracks: [song], sourceTotal: 1, source: 'youtube-music', updatedAt: Date.now(), stale: false }

async function fixture() {
  const directory = await mkdtemp(join(scratch, 'mi-tune-artists-http-'))
  const calls = []
  let failSource = false
  const catalogue = {
    searchArtists: async query => { calls.push(query); return { artists: [artist] } },
    artist: async id => { calls.push(id); if (failSource) throw Object.assign(new Error('Fixture unavailable'), { status: 503, code: 'ARTIST_UNAVAILABLE' }); return artist },
    album: async id => { calls.push(id); return album },
    close() {},
  }
  const music = { search: async () => [], lookup: () => null, close() {} }
  let app
  let base
  async function start() {
    app = await createApplication({ dataDir: directory, musicService: music, artistCatalog: catalogue })
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${app.server.address().port}/api`
  }
  await start()
  function client() {
    const cookies = new Map()
    return async function request(path, method = 'GET', value, headers = {}) {
      const response = await fetch(base + path, { method, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(value !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: value !== undefined ? JSON.stringify(value) : undefined })
      for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)) }
      return { status: response.status, headers: response.headers, ...(await response.json()) }
    }
  }
  async function account(username) {
    const request = client()
    const password = randomBytes(16).toString('hex')
    assert.equal((await request('/auth/register', 'POST', { username, password })).status, 201)
    assert.equal((await request('/auth/login', 'POST', { username, password })).status, 200)
    return request
  }
  return { client, account, calls, stopSource: () => { failSource = true }, restart: async () => { await app.close(); await start() }, close: async () => { await app.close(); await rm(directory, { recursive: true, force: true }) } }
}

test('artist and album songs enter the existing playback registry with stable provenance', async () => {
  const directory = await mkdtemp(join(scratch, 'mi-tune-artist-registry-'))
  let source
  try {
    source = createYoutubeService({ dataDir: directory })
    const registered = source.register([song, { ...song, id: 'yt:bbbbbbbbbbb', source: 'not-a-music-source' }])
    assert.equal(registered.length, 1)
    assert.equal(source.lookup(song.id).albumId, albumId)
    assert.deepEqual(source.lookup(song.id).artistRefs, song.artistRefs)
    source.close()
    source = createYoutubeService({ dataDir: directory })
    assert.equal(source.lookup(song.id).albumId, albumId)
    assert.deepEqual(source.lookup(song.id).artistRefs, song.artistRefs)
  } finally { source?.close(); await rm(directory, { recursive: true, force: true }) }
})

test('guests browse sourced artists/albums, register playable catalogue identities, but cannot follow', async () => {
  const f = await fixture()
  try {
    const guest = f.client()
    const search = await guest('/artists?q=Fixture')
    assert.equal(search.status, 200)
    assert.equal(search.data.artists[0].id, artistId)
    const profile = await guest('/artists/' + artistId)
    assert.equal(profile.status, 200)
    assert.equal(profile.data.following, false)
    assert.equal(profile.data.artist.albums[0].id, albumId)
    assert.equal(profile.data.artist.coverUrl, '/api/artists/' + artistId + '/cover')
    assert.equal((await guest('/albums/' + albumId)).data.album.tracks[0].id, song.id)
    const registered = await guest('/tracks/' + song.id)
    assert.equal(registered.status, 200)
    assert.equal(registered.data.albumId, albumId)
    assert.deepEqual(registered.data.artistRefs, song.artistRefs)
    assert.equal((await guest('/artists/' + artistId + '/follow', 'PUT', {})).status, 401)
    assert.equal((await guest('/followed-artists')).status, 401)
    const previousCalls = f.calls.length
    assert.equal((await guest('/artists/invalid')).status, 400)
    assert.equal((await guest('/albums/invalid')).status, 400)
    assert.equal(f.calls.length, previousCalls)
  } finally { await f.close() }
})

test('artist follows are idempotent, owner-isolated, persistent and removable without the source', async () => {
  const f = await fixture()
  try {
    const first = await f.account('artist_fixture_a')
    const second = await f.account('artist_fixture_b')
    const path = '/artists/' + artistId
    assert.equal((await first(path + '/follow', 'PUT', { userId: 'different-owner' })).status, 400)
    assert.equal((await first(path + '/follow', 'PUT', {}, { Origin: 'https://invalid.example' })).status, 403)
    assert.equal((await first(path + '/follow', 'PUT', {})).data.following, true)
    assert.equal((await first(path + '/follow', 'PUT', {})).data.following, true)
    assert.equal((await first(path)).data.following, true)
    assert.equal((await second(path)).data.following, false)
    assert.equal((await first('/followed-artists')).data.artists.length, 1)
    assert.equal((await second('/followed-artists')).data.artists.length, 0)
    await f.restart()
    assert.equal((await first(path)).data.following, true)
    f.stopSource()
    assert.equal((await first(path + '/follow', 'DELETE')).data.following, false)
    assert.equal((await first('/followed-artists')).data.artists.length, 0)
    assert.equal((await first(path + '/follow', 'DELETE')).data.following, false)
  } finally { await f.close() }
})

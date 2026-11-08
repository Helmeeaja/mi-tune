import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createArtistCatalog, normalizeCatalogue } from '../server/artist-catalog.mjs'
import { normalizeSong } from '../server/youtube.mjs'
import { createApplication } from '../server/app.mjs'

const artistId = 'UC' + 'a'.repeat(22)
const albumId = 'MPREb_isolated_catalog_album'
const row = { resultType: 'song', videoType: 'MUSIC_VIDEO_TYPE_OMV', videoId: 'aaaaaaaaaaa', title: 'Explicit isolated release fixture', artists: ['Fixture artist'], artistRefs: [{ id: artistId, name: 'Fixture artist' }], album: 'Fixture album', albumId, duration: 120, available: true }
const artist = { id: artistId, name: 'Fixture artist', thumbnail: '', albums: [], singles: [], tracks: [], related: [] }
const album = { id: albumId, title: 'Fixture album', artists: [{ id: artistId, name: 'Fixture artist' }], thumbnail: '', type: 'Album', tracks: [row, { ...row, videoId: null, title: 'Unavailable isolated source track', available: false }] }

test('official release videos are playable only with validated release provenance, not as arbitrary music video search', () => {
  assert.equal(normalizeSong(row), null)
  assert.equal(normalizeSong({ ...row, albumId: null }, { catalogueType: 'album-track' }), null)
  assert.equal(normalizeSong(row, { catalogueType: 'album-track' }).musicType, 'MUSIC_VIDEO_TYPE_OMV')
  const value = normalizeCatalogue('album', album)
  assert.equal(value.sourceTotal, 2)
  assert.equal(value.tracks.length, 1)
  assert.equal(value.tracklist.length, 2)
  assert.deepEqual(value.tracklist.map(track => track.position), [1, 2])
  assert.equal(value.tracklist[1].playable, false)
  assert.equal(value.tracklist[0].catalogueType, 'album-track')
})

test('catalogue validates literal IDs and query formats before invoking external tools', async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR, 'mi-tune-catalogue-validation-'))
  const source = createArtistCatalog({ dataDir: directory, pythonBinary: '/nonexistent-explicit-fixture' })
  try {
    await assert.rejects(source.artist('invalid'), error => error.status === 400)
    await assert.rejects(source.album('invalid'), error => error.status === 400)
    await assert.rejects(source.search('https://example.invalid'), error => error.status === 400)
    await assert.rejects(source.search('x'), error => error.status === 400)
  } finally { source.close(); await rm(directory, { recursive: true, force: true }) }
})

test('mixed search combines bounded relevant profiles/releases and keeps the legacy tracks envelope', async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR, 'mi-tune-catalogue-search-'))
  const track = normalizeSong({ ...row, videoType: 'MUSIC_VIDEO_TYPE_ATV' })
  let unavailable = false
  const music = { search: async () => { if (unavailable) throw Object.assign(new Error('Explicit isolated song source outage'), { status: 503 }); return [track] }, lookup: () => track, close() {} }
  const catalogue = { search: async () => ({ artists: [artist, artist], albums: [album, album] }), artist: async () => artist, album: async () => album, close() {} }
  const app = await createApplication({ dataDir: directory, musicService: music, artistCatalog: catalogue })
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${app.server.address().port}/api`
  try {
    let response = await fetch(base + '/search?q=Fixture')
    assert.deepEqual((await response.json()).data.tracks.map(item => item.id), [track.id])
    response = await fetch(base + '/search/discovery?q=Fixture')
    let value = (await response.json()).data
    assert.equal(value.artists.length, 1)
    assert.equal(value.albums.length, 1)
    assert.equal(value.tracks.length, 1)
    assert.equal(value.artists[0].id, artistId)
    unavailable = true
    response = await fetch(base + '/search/discovery?q=Fixture')
    value = (await response.json()).data
    assert.equal(response.status, 200)
    assert.equal(value.tracks.length, 0)
    assert.equal(value.artists.length, 1)
    assert.equal(value.warnings[0].code, 'SONG_SEARCH_UNAVAILABLE')
    assert.equal((await fetch(base + '/search/discovery?q=x')).status, 400)
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }) }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { validatePlaylistCover } from '../server/playlist-cover.mjs'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWYAAAAASUVORK5CYII='

test('playlist artwork validator accepts bounded raster images and bundled presets, never URLs or SVG', async () => {
  const jpeg = `data:image/jpeg;base64,${(await readFile(new URL('../public/artwork/studio.jpg', import.meta.url))).toString('base64')}`
  assert.equal(validatePlaylistCover(jpeg), jpeg)
  assert.equal(validatePlaylistCover(png), png)
  assert.equal(validatePlaylistCover('/artwork/forest.jpg'), '/artwork/forest.jpg')
  assert.equal(validatePlaylistCover(null), null)
  for (const cover of [false, {}, '', 'https://evil.example/a.jpg', '/etc/passwd', '/artwork/../icon.svg', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/jpeg;base64,PHN2Zy8+', 'data:image/png;base64,!!!!', 'data:image/png;base64,' + 'A'.repeat(900000)]) assert.throws(() => validatePlaylistCover(cover), { code: 'INVALID_PLAYLIST_COVER' })
})

test('account playlist covers migrate additively, persist after restart, and stay owner-isolated', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mi-tune-cover-test-'))
  const original = new DatabaseSync(join(dir, 'mi-tune.sqlite'))
  original.exec("CREATE TABLE playlists(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,track_ids TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL)")
  original.prepare('INSERT INTO playlists VALUES(?,?,?,?,?)').run('legacy', 'legacy-owner', 'Existing playlist', '[]', 1)
  original.close()
  const music = { search: async () => [], lookup: () => undefined, close() {} }
  let app
  let base
  async function start() {
    app = await createApplication({ dataDir: dir, distDir: join(dir, 'dist'), musicService: music })
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${app.server.address().port}`
  }
  async function call(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(base + '/api' + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
    return { status: response.status, data: await response.json(), cookie: response.headers.getSetCookie().map(header => header.split(';')[0]).join('; ') }
  }
  async function account(username) {
    const password = 'IsolatedFixtureOnly-456!'
    assert.equal((await call('/auth/register', { method: 'POST', body: { username, displayName: username, password } })).status, 201)
    const response = await call('/auth/login', { method: 'POST', body: { username, password } })
    assert.equal(response.status, 200)
    return response.cookie
  }
  try {
    await start()
    const alice = await account('cover_alice')
    const bob = await account('cover_bob')
    const created = await call('/playlists', { method: 'POST', cookie: alice, body: { name: 'My artwork', cover: '/artwork/dawn.jpg' } })
    assert.equal(created.status, 201)
    const id = created.data.data.id
    assert.equal((await call('/library', { cookie: alice })).data.data.playlists[0].cover, '/artwork/dawn.jpg')
    assert.equal((await call(`/playlists/${id}`, { method: 'PATCH', cookie: bob, body: { cover: '/artwork/forest.jpg' } })).status, 404)
    assert.equal((await call('/library', { cookie: bob })).data.data.playlists.length, 0)
    const jpeg = `data:image/jpeg;base64,${(await readFile(new URL('../public/artwork/studio.jpg', import.meta.url))).toString('base64')}`
    assert.ok(jpeg.length > 32768)
    assert.equal((await call(`/playlists/${id}`, { method: 'PATCH', cookie: alice, body: { cover: jpeg } })).status, 200)
    assert.equal((await call('/library', { cookie: alice })).data.data.playlists[0].cover, jpeg)
    assert.equal((await call(`/playlists/${id}`, { method: 'PATCH', cookie: alice, body: { name: 'Renamed' } })).status, 200)
    assert.equal((await call('/library', { cookie: alice })).data.data.playlists[0].cover, jpeg)
    for (const body of [{}, { cover: 'https://evil.example/a.jpg' }, { cover: png, owner_id: 'cover_bob' }, { cover: png, name: '' }]) assert.equal((await call(`/playlists/${id}`, { method: 'PATCH', cookie: alice, body })).status, 400)
    assert.equal((await call('/library', { cookie: alice })).data.data.playlists[0].cover, jpeg)
    assert.equal((await call('/playlists', { method: 'POST', cookie: alice, body: { name: 'Large', cover: 'A'.repeat(950000) } })).status, 413)
    assert.equal((await call('/auth/register', { method: 'POST', body: { username: 'large_payload', password: 'A'.repeat(40000), displayName: 'Large' } })).status, 413)
    await app.close()
    await start()
    const persisted = (await call('/library', { cookie: alice })).data.data.playlists[0]
    assert.equal(persisted.name, 'Renamed')
    assert.equal(persisted.cover, jpeg)
    assert.equal((await call(`/playlists/${id}`, { method: 'PATCH', cookie: alice, body: { cover: null } })).status, 200)
    assert.equal((await call('/library', { cookie: alice })).data.data.playlists[0].cover, null)
    const database = new DatabaseSync(join(dir, 'mi-tune.sqlite'))
    const legacy = database.prepare('SELECT * FROM playlists WHERE id=?').get('legacy')
    assert.equal(legacy.name, 'Existing playlist')
    assert.equal(legacy.owner_id, 'legacy-owner')
    assert.equal(legacy.track_ids, '[]')
    assert.equal(legacy.cover, null)
    database.close()
  } finally {
    await app?.close()
    await rm(dir, { recursive: true, force: true })
  }
})

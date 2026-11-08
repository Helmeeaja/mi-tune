import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { validateProfilePatch } from '../server/profile.mjs'

const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWYAAAAASUVORK5CYII='

test('profile fields and raster uploads reject unknown ownership fields and unsafe images', () => {
  assert.deepEqual(validateProfilePatch({ displayName: ' Hello ', username: 'Case_Name', bio: ' Hi ', email: '', avatar }), { displayName: 'Hello', username: 'Case_Name', bio: 'Hi', email: '', avatar })
  for (const value of [{}, { id: 'other' }, { username: ' bad' }, { bio: 'x'.repeat(501) }, { email: 'not an email' }, { avatar: '/artwork/studio.jpg' }, { avatar: 'data:image/svg+xml;base64,PHN2Zy8+' }]) assert.throws(() => validateProfilePatch(value), { code: 'INVALID_PROFILE' })
})

test('account profile, authenticated downloads, request cancellation and password rotation work with isolated storage', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR, 'mi-tune-accounts-'))
  const audioPath = join(directory, 'fixture-audio.bin')
  await writeFile(audioPath, Buffer.alloc(128, 9))
  const song = { id: 'yt:aaaaaaaaaaa', title: 'Isolated fixture', artist: 'Fixture', artists: ['Fixture'], duration: 180, source: 'youtube-music', type: 'song', musicType: 'MUSIC_VIDEO_TYPE_ATV' }
  const job = { id: randomUUID(), trackId: song.id, status: 'ready', progress: 100, track: song }
  const source = { lookup: id => id === song.id ? song : null, search: async () => [song], prepare: async () => job, job: () => job, audio: () => ({ path: audioPath, size: 128, mime: 'audio/mpeg' }), close() {} }
  let app
  let base
  async function start() {
    app = await createApplication({ dataDir: directory, musicService: source })
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${app.server.address().port}/api`
  }
  function client() {
    const cookies = new Map()
    return async (path, method = 'GET', value) => {
      const response = await fetch(base + path, { method, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: value === undefined ? undefined : JSON.stringify(value) })
      for (const cookie of response.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0].split('='); cookies.set(key, value) }
      const content = response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : { bytes: (await response.arrayBuffer()).byteLength }
      return { status: response.status, data: content.data, error: content.error, headers: response.headers, bytes: content.bytes }
    }
  }
  const a = client(), b = client(), otherSession = client(), guest = client()
  const password = randomBytes(20).toString('base64url')
  const nextPassword = randomBytes(20).toString('base64url')
  try {
    await start()
    const userA = (await a('/auth/register', 'POST', { username: 'profile_a', displayName: 'Listener A', password })).data
    const userB = (await b('/auth/register', 'POST', { username: 'profile_b', displayName: 'Listener B', password })).data
    assert.ok(Number.isFinite(userA.joinedAt))
    assert.equal((await a('/auth/me')).data.user, null)
    await a('/auth/login', 'POST', { username: 'profile_a', password })
    await b('/auth/login', 'POST', { username: 'profile_b', password })
    await otherSession('/auth/login', 'POST', { username: 'profile_a', password })
    const patch = { displayName: 'New listener', username: 'New_Name', bio: 'Musik untuk pulang.', email: 'private@example.test', avatar }
    assert.equal((await a('/profile', 'PATCH', patch)).status, 200)
    const saved = (await a('/profile')).data.user
    for (const [key, value] of Object.entries(patch)) assert.equal(saved[key], value)
    assert.equal((await a('/auth/me')).data.user.username, 'New_Name')
    assert.equal((await a('/profile', 'PATCH', { username: 'PROFILE_B' })).status, 409)
    assert.equal((await a('/profile', 'PATCH', { ownerId: userB.id })).status, 400)
    const found = (await b('/users?q=New_Name')).data[0]
    assert.equal(found.avatar, avatar)
    assert.equal(found.bio, patch.bio)
    for (const privateField of ['email', 'salt', 'password_hash']) assert.equal(Object.hasOwn(found, privateField), false)
    for (const path of ['/profile', '/library', '/friends', '/users?q=New']) assert.equal((await guest(path)).status, 401)
    assert.equal((await guest('/media/jobs', 'POST', { trackId: song.id, purpose: 'download', rightsConfirmed: true })).status, 401)
    assert.equal((await guest(`/tracks/${song.id}/download`)).status, 401)
    assert.equal((await guest('/media/jobs', 'POST', { trackId: song.id, purpose: 'playback' })).status, 200)
    assert.equal((await guest(`/tracks/${song.id}/stream`)).bytes, 128)
    assert.equal((await a(`/tracks/${song.id}/download`)).bytes, 128)
    const sent = (await a('/friend-requests', 'POST', { userId: userB.id })).data
    assert.equal((await b(`/friend-requests/${sent.id}`, 'DELETE')).status, 404)
    assert.equal((await a(`/friend-requests/${sent.id}`, 'DELETE')).status, 200)
    assert.equal((await b('/friends')).data.incoming.length, 0)
    const second = (await a('/friend-requests', 'POST', { userId: userB.id })).data
    await b(`/friend-requests/${second.id}`, 'PATCH', { action: 'accept' })
    assert.equal((await b('/friends')).data.friends[0].displayName, patch.displayName)
    assert.equal((await a('/auth/password', 'POST', { currentPassword: password, newPassword: nextPassword })).status, 200)
    assert.equal((await a('/auth/me')).data.user.id, userA.id)
    assert.equal((await otherSession('/auth/me')).data.user, null)
    assert.equal((await guest('/auth/login', 'POST', { username: 'New_Name', password })).status, 401)
    assert.equal((await guest('/auth/login', 'POST', { username: 'New_Name', password: nextPassword })).status, 200)
    await app.close()
    await start()
    assert.equal((await a('/profile')).data.user.bio, patch.bio)
    assert.equal((await b('/friends')).data.friends[0].avatar, avatar)
  } finally {
    await app?.close()
    await rm(directory, { recursive: true, force: true })
  }
})

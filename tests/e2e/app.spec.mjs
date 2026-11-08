import { test, expect } from '@playwright/test'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { createApplication } from '../../server/app.mjs'
import { translate } from '../../src/lib/i18n.mjs'
import { normalizeSong } from '../../server/youtube.mjs'

const songs = ['a', 'b', 'c', 'd'].map((letter, index) => normalizeSong({ resultType: 'song', videoType: 'MUSIC_VIDEO_TYPE_ATV', videoId: letter.repeat(11), title: `UI test song ${index + 1}`, artists: ['UI fixture artist'], album: 'UI fixture album', duration: 120, thumbnail: '' }))
let application
let directory
let base
let audioPath
let audioSize
const jobs = new Map()
const failures = []

function unavailable() { return Object.assign(new Error('UI fixture source unavailable'), { status: 503, code: 'FIXTURE_UNAVAILABLE' }) }

test.beforeEach(async () => {
  test.setTimeout(75000)
  if (!process.env.TMPDIR) throw new Error('Browser tests require the configured scratch directory')
  directory = await mkdtemp(join(process.env.TMPDIR, 'mi-tune-browser-test-'))
  audioPath = join(directory, 'ui-test-tone.mp3')
  execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=120', '-threads', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', audioPath], { timeout: 45000 })
  audioSize = (await stat(audioPath)).size
  const source = {
    search: async query => {
      if (query === 'unavailable') throw unavailable()
      if (query === 'empty') return []
      if (/https?:\/\//.test(query)) throw Object.assign(new Error('Cari judul lagu, bukan URL video.'), { status: 400 })
      if (query === 'autoplay') return [songs[3]]
      return query === 'failure' ? [songs[2]] : songs.slice(0, 2)
    },
    trending: async () => ({ tracks: songs.slice(0, 2).map((track,index)=>({...track,rankingSource:'spotify',spotifyUri:'spotify:track:'+String.fromCharCode(65+index).repeat(22),rank:index+1})), source: 'Explicit isolated Spotify-shaped fixture, not live chart data', region:'ZZ',chartVersion:3,chartOrigin:'spotify',chartProvider:'spotify',chartId:'37i9dQZEVXbMDoHDwVN2tF',sourceUrl:'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF',sourceTotal:2,unavailable:[],updatedAt:Date.now(),dateKind:'retrieved',stale:false }),
    lookup: id => songs.find(song => song.id === id),
    prepare: async id => {
      const song = songs.find(item => item.id === id)
      const job = { id: randomUUID(), trackId: id, status: id === songs[2].id ? 'downloading' : id === songs[3].id ? 'queued' : 'ready', progress: 0, stage: 'UI fixture preparation', error: null, track: { ...song, fileSize: audioSize } }
      jobs.set(job.id, job)
      return job
    },
    job: id => { const job = jobs.get(id); if (job?.trackId === songs[2].id) throw unavailable(); if (job?.trackId === songs[3].id) { job.status = 'ready'; job.progress = 100 } return job },
    audio: id => id === songs[2].id || (id === songs[3].id && ![...jobs.values()].some(job => job.trackId === id && job.status === 'ready')) ? undefined : { path: audioPath, size: audioSize, mime: 'audio/mpeg', track: songs.find(song => song.id === id) },
    close() {},
  }
  application = await createApplication({ dataDir: directory, distDir: resolve('dist'), musicService: source, lyricsFetcher: async () => ({ matched: true, source: 'Explicit UI test fixture', syncedLyrics: '[00:00.00]UI first cue\n[00:05.00]UI second cue\n[00:10.00]UI third cue\n[00:20.00]UI last cue', plainLyrics: null }), refreshIntervalMs: 3600000 })
  await new Promise(done => application.server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${application.server.address().port}`
})

test.afterEach(async () => {
  await application?.close()
  if (directory) await rm(directory, { recursive: true, force: true })
  jobs.clear()
})

test.beforeEach(async ({ page }) => {
  failures.length = 0
  await page.addInitScript(() => window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); event.stopImmediatePropagation() }, true))
  page.on('pageerror', error => failures.push(error.message))
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-page="home"]')).toBeVisible()
})

test.afterEach(async () => { expect(failures).toEqual([]) })

function player(page) { return page.getByRole('region', { name: 'Pemutar musik', exact: true }) }
function lyrics(page) { return page.locator('aside[aria-label="Lirik lagu"]') }

async function search(page, value = 'UI test') {
  await page.getByRole('textbox', { name: 'Cari lagu, artis, atau podcast' }).fill(value)
  await page.getByRole('button', { name: 'Cari musik sekarang' }).click()
  await expect(page.getByRole('heading', { name: translate('id','Hasil untuk “{query}”',{query:value}) })).toBeVisible()
}

async function prepare(page, title = songs[0].title, download = false) {
  await page.getByRole('button', { name: `${download ? 'Unduh' : 'Putar'} ${title}`, exact: true }).click()
  if (download) {
    const consent = page.getByRole('dialog', { name: 'Simpan untuk offline' })
    await expect(consent).toBeVisible()
    await expect(consent.getByRole('button', { name: 'Unduh lagu', exact: true })).toBeDisabled()
    await consent.getByRole('checkbox').check()
    await consent.getByRole('button', { name: 'Unduh lagu', exact: true }).click()
  } else await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function navigation(page, name) { const label = name === 'Perpustakaan' ? 'Koleksi' : name instanceof RegExp && name.source.startsWith('^Downloads') ? /^Unduhan(?:\s*\d+)?$/ : name; await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: label, exact: true }).click() }
async function waitAudio(page) {
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => !audio.paused && audio.currentTime > 0.2), { timeout: 15000 }).toBe(true)
}

async function account(context, username) {
  const password = randomBytes(24).toString('base64url')
  const registered = await context.request.post(base + '/api/auth/register', { data: { username, displayName: username, password } })
  expect(registered.status()).toBe(201)
  const loggedIn = await context.request.post(base + '/api/auth/login', { data: { username, password } })
  expect(loggedIn.status()).toBe(200)
  return (await loggedIn.json()).data.user
}

test('single click plays an initially queued song without a preparation popup', async ({ page }) => {
  await search(page, 'autoplay')
  await page.evaluate(() => {
    window.preparationPopups = 0
    new MutationObserver(() => { if (document.querySelector('dialog[open]')) window.preparationPopups += 1 }).observe(document.body, { childList: true, subtree: true })
  })
  const response = page.waitForResponse(value => value.url().endsWith(`/api/tracks/${encodeURIComponent(songs[3].id)}/stream`))
  await page.getByRole('button', { name: `Putar ${songs[3].title}`, exact: true }).click()
  const started = await response
  expect([200, 206]).toContain(started.status())
  expect(started.request().method()).toBe('GET')
  await waitAudio(page)
  await expect(page.locator('audio:not([aria-hidden="true"])')).toHaveAttribute('data-track', songs[3].id)
  await expect(page).toHaveURL(base + '/track/' + encodeURIComponent(songs[3].id))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.preparationPopups)).toBe(0)
})

test('desktop search error and empty states, native keyboard focus, and installation guidance', async ({ page, context }) => {
  await account(context, 'modal_' + randomBytes(4).toString('hex'))
  await page.reload()
  await navigation(page, 'Perpustakaan')
  const create = page.getByRole('button', { name: 'Playlist baru', exact: true })
  await create.click()
  const dialog = page.getByRole('dialog', { name: 'Playlist baru' })
  await expect(dialog).toBeVisible()
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Shift+Tab')
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(create).toBeFocused()
  await page.getByRole('button', { name: 'Instal Mi Tune', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Mi Tune, lebih dekat.' })).toContainText('HTTPS atau localhost')
  await page.keyboard.press('Escape')
  await search(page, 'empty')
  await expect(page.getByRole('heading', { name: 'Belum menemukan yang cocok' })).toBeVisible()
  await search(page, 'unavailable')
  await expect(page.getByRole('alert')).toContainText('UI fixture source unavailable')
  await search(page)
  await expect(page.locator('main article')).toHaveCount(2)
})

test('audio clock, pause, seek, synchronized inline lyrics, next, previous, shuffle, repeat and mute', async ({ page }) => {
  await search(page)
  await prepare(page)
  await waitAudio(page)
  const dock = player(page)
  await dock.getByRole('button', { name: 'Jeda musik', exact: true }).click()
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.paused)).toBe(true)
  const slider = dock.getByRole('slider', { name: 'Posisi pemutaran' })
  const box = await slider.boundingBox()
  await slider.click({ position: { x: box.width * 12 / songs[0].duration, y: box.height / 2 } })
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime)).toBeGreaterThan(10)
  await expect(lyrics(page).locator('[data-lyric-index][data-active="true"]')).toHaveText('UI third cue')
  await lyrics(page).getByRole('button', { name: 'Lompat ke lirik: UI second cue', exact: true }).click()
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime)).toBeCloseTo(5, 0)
  await expect(lyrics(page).locator('[data-lyric-index][data-active="true"]')).toHaveText('UI second cue')
  await dock.getByRole('button', { name: 'Lagu berikutnya', exact: true }).click()
  await waitAudio(page)
  await expect(page.locator('audio:not([aria-hidden="true"])')).toHaveAttribute('data-track', songs[1].id)
  await slider.click({ position: { x: 0, y: box.height / 2 } })
  await dock.getByRole('button', { name: 'Lagu sebelumnya', exact: true }).click()
  await waitAudio(page)
  await expect(page.locator('audio:not([aria-hidden="true"])')).toHaveAttribute('data-track', songs[0].id)
  await dock.getByRole('button', { name: 'Acak antrean', exact: true }).click()
  await expect(dock.getByRole('button', { name: 'Acak antrean', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await dock.getByRole('button', { name: 'Ulangi: mati', exact: true }).click()
  await dock.getByRole('button', { name: 'Ulangi: semua', exact: true }).click()
  await expect(dock.getByRole('button', { name: 'Ulangi: satu', exact: true })).toBeVisible()
  await dock.getByRole('button', { name: 'Bisukan', exact: true }).click()
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.muted)).toBe(true)
  await dock.getByRole('button', { name: 'Aktifkan suara', exact: true }).click()
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.muted)).toBe(false)
})

test('Now Playing search and browser history preserve the current audio node and clock', async ({ page, context }) => {
  await account(context, 'history_' + randomBytes(4).toString('hex'))
  await page.reload()
  await search(page)
  await prepare(page)
  await waitAudio(page)
  const before = await page.locator('audio:not([aria-hidden="true"])').evaluate(element => { element.dataset.persistentNode = 'verified'; return element.currentTime })
  await search(page, 'other songs')
  await expect(page).toHaveURL(base + '/track/' + encodeURIComponent(songs[0].id))
  await expect(page.getByRole('region', { name: 'Jelajahi musik' }).locator('article')).toHaveCount(2)
  await navigation(page, 'Perpustakaan')
  await expect(page.getByRole('heading', { name: 'Koleksi musikmu.' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: songs[0].title, exact: true, level: 1 })).toBeVisible()
  const after = await page.locator('audio:not([aria-hidden="true"])').evaluate(element => ({ marker: element.dataset.persistentNode, time: element.currentTime, paused: element.paused, track: element.dataset.track }))
  expect(after).toMatchObject({ marker: 'verified', paused: false, track: songs[0].id })
  expect(after.time).toBeGreaterThan(before)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('account favorites and playlist CRUD, ordering and custom artwork survive reopening', async ({ page, context }) => {
  const who = await account(context, 'playlist_' + randomBytes(4).toString('hex'))
  await page.reload()
  await search(page)
  await page.getByRole('button', { name: `Favoritkan ${songs[0].title}`, exact: true }).click()
  await page.getByRole('button', { name: `Tambah ${songs[0].title} ke playlist`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Playlist baru', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nama playlist' }).fill('UI saved playlist')
  await page.getByRole('dialog').getByRole('button', { name: 'Buat playlist', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await search(page)
  await page.getByRole('button', { name: `Tambah ${songs[0].title} ke playlist`, exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'UI saved playlist', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: `Tambah ${songs[1].title} ke playlist`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'UI saved playlist', exact: true }).click()
  await navigation(page, 'Perpustakaan')
  await page.locator('main').getByRole('heading', { name: 'UI saved playlist', exact: true }).click()
  await page.getByRole('button', { name: `Naikkan ${songs[1].title}`, exact: true }).click()
  await expect(page.locator('main article').first()).toHaveAttribute('data-track-id', songs[1].id)
  await page.getByRole('button', { name: 'Ubah sampul', exact: true }).click()
  const artwork = page.getByRole('dialog', { name: 'Sampul playlist' })
  await artwork.getByRole('button', { name: 'Pilih sampul Hutan', exact: true }).click()
  await artwork.getByRole('button', { name: 'Simpan sampul', exact: true }).click()
  await page.getByRole('button', { name: 'Ubah sampul', exact: true }).click()
  await expect(artwork.getByRole('img', { name: 'Pratinjau sampul playlist' })).toHaveAttribute('src', '/artwork/forest.jpg')
  await artwork.getByLabel('Unggah gambar sampul').setInputFiles(resolve('public/artwork/studio.jpg'))
  await expect(artwork.getByRole('img', { name: 'Pratinjau sampul playlist' })).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect.poll(() => artwork.getByRole('img', { name: 'Pratinjau sampul playlist' }).evaluate(image => image.complete && image.naturalWidth === 512 && image.naturalHeight === 512)).toBe(true)
  await artwork.getByRole('button', { name: 'Simpan sampul', exact: true }).click()
  const storedCover = await page.evaluate(id => JSON.parse(localStorage.getItem(`mi-tune-library:${id}`)).playlists[0].cover, who.id)
  expect(storedCover).toMatch(/^data:image\/jpeg;base64,/)
  await page.getByRole('button', { name: 'Ubah nama', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nama playlist' }).fill('UI renamed playlist')
  await page.getByRole('button', { name: 'Simpan nama', exact: true }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'UI renamed playlist', exact: true })).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(2)
  await expect(page.locator('main img[src^="data:image/jpeg;base64,"]')).toHaveAttribute('src', storedCover)
  await page.getByRole('button', { name: `Hapus ${songs[0].title} dari playlist`, exact: true }).click()
  await expect(page.locator('main article')).toHaveCount(1)
  await page.getByRole('button', { name: 'Hapus playlist', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus playlist', exact: true }).click()
  await expect(page.locator('main').getByRole('heading', { name: 'UI renamed playlist', exact: true })).toHaveCount(0)
})

test('complete download, offline reopening, cached lyrics, byte-range seek and removal', async ({ page, context }) => {
  await account(context, 'offline_' + randomBytes(4).toString('hex'))
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await search(page)
  await prepare(page, songs[0].title, true)
  await expect(page.getByRole('button', { name: `Tersimpan offline ${songs[0].title}`, exact: true })).toBeDisabled()
  await navigation(page, /^Downloads(?:\s+\d+)?$/)
  await expect(page.getByRole('heading', { name: '1 lagu siap didengar' })).toBeVisible()
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Dengarkan offline' })).toBeVisible()
  await expect(page.getByText('Kamu offline. Musik yang tersimpan tetap berjalan.')).toBeVisible()
  await page.getByRole('button', { name: `Putar ${songs[0].title}`, exact: true }).click()
  await waitAudio(page)
  await expect(lyrics(page).getByRole('button', { name: 'Lompat ke lirik: UI first cue', exact: true })).toBeVisible()
  const range = await page.evaluate(async id => {
    const response = await fetch(`/api/tracks/${encodeURIComponent(id)}/audio`, { headers: { Range: 'bytes=100-199' } })
    return { status: response.status, bytes: (await response.arrayBuffer()).byteLength, range: response.headers.get('content-range') }
  }, songs[0].id)
  expect(range).toEqual({ status: 206, bytes: 100, range: `bytes 100-199/${audioSize}` })
  await navigation(page, /^Downloads(?:\s+\d+)?$/)
  await page.getByRole('button', { name: `Hapus unduhan ${songs[0].title}`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus unduhan', exact: true }).click()
  await expect(page.getByRole('heading', { name: '0 lagu siap didengar' })).toBeVisible()
  await context.setOffline(false)
})

test('failed preparation clears loading and remains retryable without a popup', async ({ page }) => {
  await search(page, 'failure')
  await prepare(page, songs[2].title)
  await expect(page.getByRole('alert')).toContainText('Lagu belum bisa diputar. Cek koneksi, lalu coba lagi.')
  await expect(page.getByRole('button', { name: 'Putar musik di halaman lagu', exact: true })).toBeEnabled()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('mobile navigation, advanced controls and populated playlist actions fit 320 to 1440 pixels', async ({ page, context }) => {
  await account(context, 'responsive_' + randomBytes(4).toString('hex'))
  await page.reload()
  await page.setViewportSize({ width: 390, height: 844 })
  await search(page)
  await prepare(page)
  await waitAudio(page)
  await player(page).getByRole('button', { name: 'Buka antrean', exact: true }).click()
  const queue = page.getByRole('dialog', { name: 'Antrean pemutaran' })
  await expect(queue.getByRole('button', { name: 'Acak antrean', exact: true })).toBeVisible()
  await expect(queue.getByRole('button', { name: 'Ulangi: mati', exact: true })).toBeVisible()
  await expect(queue.getByRole('slider', { name: 'Volume' })).toBeVisible()
  await page.keyboard.press('Escape')
  const created = await context.request.post(base + '/api/playlists', { data: { name: 'UI layout fixture' } })
  expect(created.status()).toBe(201)
  const layoutPlaylist = (await created.json()).data
  expect((await context.request.put(base + '/api/playlists/' + layoutPlaylist.id + '/tracks', { data: { trackIds: [songs[0].id] } })).status()).toBe(200)
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/library?playlist=' + encodeURIComponent(layoutPlaylist.id), { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main article')).toHaveCount(1)
    const bounds = await page.locator('main article .track-actions button').evaluateAll(elements => elements.map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })))
    expect(bounds.every(box => box.left >= 0 && box.right <= width)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width < 1024) await expect(page.getByRole('navigation', { name: 'Navigasi mobile' })).toBeVisible()
  }
})

test('direct track links and private imported LRC display and seek correctly', async ({ page }) => {
  await page.goto(base + '/track/' + encodeURIComponent(songs[0].id), { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: songs[0].title, exact: true, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Putar musik di halaman lagu', exact: true }).click()
  await waitAudio(page)
  await page.getByRole('button', { name: 'Impor lirik LRC', exact: true }).click()
  await page.getByRole('dialog').getByLabel('File lirik LRC').setInputFiles({ name: 'ui-private.lrc', mimeType: 'text/plain', buffer: Buffer.from('[00:00.00]UI private start\n[00:08.00]UI private seek') })
  await expect(lyrics(page).getByRole('button', { name: 'Lompat ke lirik: UI private seek', exact: true })).toBeVisible()
  await player(page).getByRole('button', { name: 'Jeda musik', exact: true }).click()
  await lyrics(page).getByRole('button', { name: 'Lompat ke lirik: UI private seek', exact: true }).click()
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime)).toBeCloseTo(8, 0)
})

test('two isolated accounts send, accept and remove friendship through live SSE', async ({ page, context, browser }) => {
  const second = await browser.newContext()
  try {
    const firstUser = await account(context, 'ui_alpha')
    const secondUser = await account(second, 'ui_beta')
    await page.reload({ waitUntil: 'domcontentloaded' })
    const other = await second.newPage()
    other.on('pageerror', error => failures.push(error.message))
    await other.goto(base + '/friends', { waitUntil: 'domcontentloaded' })
    await navigation(page, 'Teman')
    await page.getByRole('textbox', { name: 'Cari username teman' }).fill(secondUser.username)
    await page.locator('main').getByRole('button', { name: 'Cari', exact: true }).click()
    await page.getByRole('button', { name: 'Tambah', exact: true }).click()
    await expect(other.getByRole('button', { name: `Terima ${firstUser.username}`, exact: true })).toBeVisible()
    await other.getByRole('button', { name: `Terima ${firstUser.username}`, exact: true }).click()
    await expect.poll(async () => ((await (await context.request.get(base + '/api/friends')).json()).data.friends.map(friend => friend.id))).toContain(secondUser.id)
    await expect(page.locator('main').getByText(`@${secondUser.username}`, { exact: true }).last()).toBeVisible()
    await expect.poll(async () => ((await (await second.request.get(base + '/api/friends')).json()).data.friends.map(friend => friend.id))).toContain(firstUser.id)
    await page.getByRole('button', { name: `Hapus teman ${secondUser.username}`, exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hapus teman', exact: true }).click()
    await expect.poll(async () => ((await (await second.request.get(base + '/api/friends')).json()).data.friends.length)).toBe(0)
  } finally { await second.close() }
})

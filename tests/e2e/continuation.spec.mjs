import { test, expect, request } from '@playwright/test'
import { mkdtemp, rm, stat, mkdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createApplication } from '../../server/app.mjs'
import { normalizeSong } from '../../server/youtube.mjs'

const artistId = 'UC' + 'a'.repeat(22)
const secondArtistId = 'UC' + 'b'.repeat(22)
const albumId = 'MPREb_isolated_ui_album_a'
const singleId = 'MPREb_isolated_ui_single_a'
const songs = ['a', 'b', 'c'].map((letter, index) => ({ ...normalizeSong({ resultType: 'song', videoType: 'MUSIC_VIDEO_TYPE_ATV', videoId: letter.repeat(11), title: `Isolated song fixture ${index + 1}`, artists: ['Isolated artist fixture'], album: 'Isolated album fixture', duration: 60, thumbnail: '' }), artistRefs: [{ id: artistId, name: 'Isolated artist fixture' }], albumId }))
const album = { id: albumId, title: 'Isolated album fixture', year: '2026', type: 'Album', thumbnail: '', artists: [{ id: artistId, name: 'Isolated artist fixture' }], tracks: songs, sourceTotal: songs.length, source: 'youtube-music', stale: false }
const single = { ...album, id: singleId, title: 'Isolated single fixture', type: 'Single', tracks: [songs[2]], sourceTotal: 1 }
const secondArtist = { id: secondArtistId, name: 'Second isolated artist fixture', thumbnail: '', description: 'Explicit isolated UI fixture, not a live musician.', tracks: [songs[1]], albums: [], singles: [], related: [], source: 'youtube-music', stale: false }
const artist = { id: artistId, name: 'Isolated artist fixture', thumbnail: '', description: 'Explicit isolated fixture biography. This is not a live musician.', tracks: songs, albums: [album], singles: [single], related: [secondArtist], source: 'youtube-music', stale: false }
let application
let directory
let base
let evidence
let preparations = 0
const queries = []

test.beforeEach(async () => {
  test.setTimeout(90000)
  if (!process.env.TMPDIR) throw new Error('Isolated UI tests require the configured scratch directory')
  directory = await mkdtemp(join(process.env.TMPDIR, 'mi-tune-continuation-fixture-'))
  evidence = join(process.env.TMPDIR, 'mi-tune-continuation-qa')
  await mkdir(evidence, { recursive: true })
  const audioPath = join(directory, 'explicit-isolated-test-tone.mp3')
  execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=60', '-threads', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', audioPath], { timeout: 60000 })
  const size = (await stat(audioPath)).size
  const source = {
    search: async query => { queries.push(query); if (query === 'empty') return []; if (query === 'unavailable') throw Object.assign(new Error('Explicit isolated source outage'), { status: 503, code: 'SOURCE_UNAVAILABLE' }); return query === songs[0].title ? [songs[0]] : songs },
    trending: async () => ({ tracks:songs.map((track,index)=>({...track,rankingSource:'spotify',spotifyUri:'spotify:track:'+String.fromCharCode(65+index).repeat(22),rank:index+1})),source:'Explicit isolated Spotify-shaped fixture, not live chart data',region:'ZZ',chartVersion:3,chartOrigin:'spotify',chartProvider:'spotify',chartId:'37i9dQZEVXbMDoHDwVN2tF',sourceUrl:'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF',sourceTotal:songs.length,unavailable:[],updatedAt:Date.now(),dateKind:'retrieved',stale:false }),
    lookup: id => songs.find(song => song.id === id),
    prepare: async id => { preparations += 1; return { id: 'isolated-ready-' + id, trackId: id, status: 'ready', progress: 100, stage: '', track: { ...songs.find(song => song.id === id), fileSize: size } } },
    audio: id => songs.some(song => song.id === id) ? { path: audioPath, size, mime: 'audio/mpeg', track: songs.find(song => song.id === id) } : undefined,
    close() {},
  }
  const catalogue = {
    search: async query => ({ artists: query === 'empty' ? [] : [artist, secondArtist], albums: query === 'empty' ? [] : [album, single] }),
    searchArtists: async query => ({ artists: query === 'empty' ? [] : [artist, secondArtist] }),
    searchAlbums: async query => ({ albums: query === 'empty' ? [] : [album, single] }),
    artist: async id => id === artistId ? artist : secondArtist,
    album: async id => id === albumId ? album : single,
    close() {},
  }
  application = await createApplication({ dataDir: directory, distDir: resolve('dist'), musicService: source, artistCatalog: catalogue, lyricsFetcher: async () => ({ matched: true, source: 'Explicit isolated lyric fixture', syncedLyrics: '[00:00.00]Isolated opening cue\n[00:10.00]Isolated second cue\n[00:30.00]Isolated final cue', plainLyrics: null }), refreshIntervalMs: 3600000 })
  await new Promise(done => application.server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${application.server.address().port}`
})

test.afterEach(async () => { await application?.close(); if (directory) await rm(directory, { recursive: true, force: true }) })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('mi-tune-settings')) localStorage.setItem('mi-tune-settings', JSON.stringify({ language: 'id', animations: false, smoothScroll: false, preloadNext:false, autoplayNext:false }))
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); event.stopImmediatePropagation() }, true)
  })
})

async function openHome(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-page="home"]')).toBeVisible()
}

async function search(page, query = 'Isolated artist fixture') {
  await page.locator('#music-search').fill(query)
  await page.locator('#music-search').press('Enter')
  await expect(page.locator('[data-search-results] article[data-track-id]').first()).toBeVisible()
}

async function waitAudio(page, id = songs[0].id) {
  await expect(page.locator('audio:not([aria-hidden="true"])')).toHaveAttribute('data-track', id)
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => !audio.paused && audio.currentTime > .2), { timeout: 20000 }).toBe(true)
}

async function account(context, name) {
  const password = randomBytes(24).toString('base64url')
  const registered = await context.request.post(base + '/api/auth/register', { data: { username: name, displayName: 'Isolated account fixture', password } })
  expect(registered.status()).toBe(201)
  const response = await context.request.post(base + '/api/auth/login', { data: { username: name, password } })
  expect(response.status()).toBe(200)
  return (await response.json()).data.user
}

async function noHorizontalClipping(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const clipped = await page.evaluate(() => [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.top < innerHeight && style.visibility !== 'hidden' && !element.classList.contains('sr-only') && (rect.left < -1 || rect.right > innerWidth + 1)
  }).map(element => ({ text: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 70), rect: element.getBoundingClientRect().toJSON() })))
  if (clipped.length) console.log('layout diagnostic', await page.evaluate(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollX,desktop:matchMedia('(min-width:1024px)').matches,main:getComputedStyle(document.querySelector('main')).width,wrappers:[...document.querySelectorAll('#root > div, #root > div > div')].map(node=>({class:node.className,margin:getComputedStyle(node).marginLeft,width:getComputedStyle(node).width,transform:getComputedStyle(node).transform}))})))
  expect(clipped).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

test('whole song rows open and play once, while play and secondary actions stay independent', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await openHome(page)
  await search(page)
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => { window.audioStarts = 0; audio.addEventListener('loadstart', () => { window.audioStarts += 1 }) })
  const row = page.locator('[data-search-results] article[data-track-id]').first()
  await row.locator('[data-track-open]').click({ position: { x: 15, y: 20 } })
  await waitAudio(page)
  await expect(page).toHaveURL(base + '/track/' + encodeURIComponent(songs[0].id))
  expect(await page.evaluate(() => window.audioStarts)).toBe(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
  const before = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => ({ time: audio.currentTime, source: audio.currentSrc }))
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Cari musik', exact: true }).click()
  const same = page.locator('[data-search-results] article[data-track-id]').first()
  await same.getByRole('button', { name: 'Antrekan ' + songs[0].title, exact: true }).click()
  await expect(page).toHaveURL(base + '/search')
  expect(await page.evaluate(() => window.audioStarts)).toBe(1)
  await same.locator('[data-track-open]').click({ position: { x: 90, y: 20 } })
  await expect(page).toHaveURL(base + '/track/' + encodeURIComponent(songs[0].id))
  const after = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => ({ time: audio.currentTime, source: audio.currentSrc }))
  expect(after.source).toBe(before.source)
  expect(after.time).toBeGreaterThanOrEqual(before.time)
  expect(await page.evaluate(() => window.audioStarts)).toBe(1)
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Cari musik', exact: true }).click()
  await page.locator('[data-search-results] article[data-track-id]').nth(1).getByRole('button', { name: 'Putar ' + songs[1].title, exact: true }).click()
  await waitAudio(page, songs[1].id)
  expect(await page.evaluate(() => window.audioStarts)).toBe(2)
  expect(errors).toEqual([])
})

test('mixed discovery exposes artist profiles and albums for an artist name and a song title', async ({ page }) => {
  await openHome(page)
  await search(page)
  await expect(page.locator('[data-search-results] [data-artist-id]')).toHaveCount(2)
  await expect(page.locator('[data-search-results] [data-album-id]')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Artis', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Album & rilisan', exact: true })).toBeVisible()
  await page.locator('[data-search-results] [data-artist-id]').first().click()
  await expect(page).toHaveURL(base + '/artist/' + artistId)
  await expect(page.locator('[data-page="artist"] h1')).toHaveText(artist.name)
  await expect(page.locator('[data-page="artist"] article[data-track-id]')).toHaveCount(songs.length)
  await expect(page.locator('[data-page="artist"] [data-album-id]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await expect(page).toHaveURL(base + '/search')
  await search(page, songs[0].title)
  await expect(page.locator('[data-search-results] [data-artist-id="' + artistId + '"]')).toBeVisible()
  await expect(page.locator('[data-search-results] article[data-track-id]')).toHaveCount(1)
})

test('album tracklists are complete and play in release order without breaking profile navigation', async ({ page }) => {
  await openHome(page)
  await search(page)
  await page.locator('[data-search-results] [data-artist-id="' + artistId + '"]').click()
  await page.locator('[data-page="artist"] [data-album-id="' + albumId + '"]').click()
  await expect(page).toHaveURL(base + '/album/' + albumId)
  const ids = await page.locator('[data-page="album"] article[data-track-id]').evaluateAll(rows => rows.map(row => row.dataset.trackId))
  expect(ids).toEqual(songs.map(song => song.id))
  await page.locator('[data-page="album"] article[data-track-id]').nth(1).locator('[data-track-open]').click()
  await waitAudio(page, songs[1].id)
  const before = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime)
  await page.locator('[data-page="now-playing"] a[href="/artist/' + artistId + '"]').first().click()
  await expect(page.locator('[data-page="artist"] h1')).toHaveText(artist.name)
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime), { timeout: 10000 }).toBeGreaterThan(before)
  await expect(page.locator('audio:not([aria-hidden="true"])')).toHaveAttribute('data-track', songs[1].id)
})

test('follow and unfollow require an account, persist, and remain isolated between accounts', async ({ page, context }) => {
  await openHome(page)
  await search(page)
  await page.locator('[data-search-results] [data-artist-id="' + artistId + '"]').click()
  await page.getByRole('button', { name: 'Ikuti artis', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  const suffix = randomBytes(4).toString('hex')
  await account(context, 'follow_fixture_' + suffix)
  await page.reload()
  await expect(page.locator('[data-page="artist"] h1')).toHaveText(artist.name)
  await page.getByRole('button', { name: 'Ikuti artis', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mengikuti', exact: true })).toHaveAttribute('aria-pressed', 'true')
  let saved = await context.request.get(base + '/api/followed-artists')
  expect((await saved.json()).data.artists.map(value => value.id)).toContain(artistId)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Mengikuti', exact: true })).toBeVisible()
  const other = await request.newContext()
  try {
    await account({ request: other }, 'other_fixture_' + suffix)
    const response = await other.get(base + '/api/artists/' + artistId)
    expect((await response.json()).data.following).toBe(false)
  } finally { await other.dispose() }
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Koleksi', exact: true }).click()
  await expect(page.locator('[data-artist-id="' + artistId + '"]')).toBeVisible()
  await page.locator('[data-artist-id="' + artistId + '"]').click()
  await page.getByRole('button', { name: 'Mengikuti', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ikuti artis', exact: true })).toBeVisible()
  saved = await context.request.get(base + '/api/followed-artists')
  expect((await saved.json()).data.artists.map(value => value.id)).not.toContain(artistId)
})

test('language changes everywhere immediately and persists without remounting or pausing audio', async ({ page }) => {
  await openHome(page)
  await search(page)
  await page.locator('[data-search-results] article[data-track-id]').first().locator('[data-track-open]').click()
  await waitAudio(page)
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => { audio.dataset.identityMarker = 'retained-audio-node' })
  const before = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime)
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
  await page.getByRole('combobox', { name: /Bahasa|Language/ }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('[data-page="settings"] h1')).toContainText('Your player, your way.')
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Music player', exact: true })).toBeVisible()
  expect(await page.locator('audio:not([aria-hidden="true"])').getAttribute('data-identity-marker')).toBe('retained-audio-node')
  await expect.poll(() => page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.currentTime)).toBeGreaterThan(before)
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Search music', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Artists', exact: true }).or(page.getByRole('heading', { name: 'Artist', exact: true }))).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  const settings = JSON.parse(await page.evaluate(() => localStorage.getItem('mi-tune-settings')))
  expect(settings.language).toBe('en')
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/\bmi tune\b/)
  expect(text).not.toMatch(/\bbrowser\b|peramban/i)
})

test('combined local time/day contexts change together, greetings stay stable, and reopening avoids repeats', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 9, 11, 59, 0) })
  await openHome(page)
  await expect(page.locator('[data-page="home"]')).toHaveAttribute('data-context', '1-morning')
  const opening = await page.locator('[data-greeting]').innerText()
  const openingIndex = await page.locator('[data-greeting]').getAttribute('data-greeting')
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Jelajahi', exact: true }).click()
  await expect(page.locator('[data-greeting]')).toHaveText(opening)
  await expect(page.locator('[data-greeting]')).toHaveAttribute('data-greeting', openingIndex)
  const chartOrder = await page.locator('[data-page="home"] article[data-track-id]').evaluateAll(rows=>rows.map(row=>row.dataset.trackId))
  await page.clock.fastForward(61050)
  await expect(page.locator('[data-page="home"]')).toHaveAttribute('data-context', '1-afternoon')
  await expect(page.locator('[data-greeting]')).not.toHaveText(opening)
  await expect.poll(()=>page.locator('[data-page="home"] article[data-track-id]').evaluateAll(rows=>rows.map(row=>row.dataset.trackId))).toEqual(chartOrder)
  await page.clock.setSystemTime(new Date(2026, 10, 13, 22, 0, 0))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('[data-page="home"]')).toHaveAttribute('data-context', '5-night')
  const seen = []
  for (let count = 0; count < 3; count += 1) {
    seen.push(await page.locator('[data-greeting]').innerText())
    await page.reload()
    await expect(page.locator('[data-page="home"]')).toBeVisible()
  }
  expect(new Set(seen).size).toBe(seen.length)
  await page.clock.setSystemTime(new Date(2026, 10, 16, 0, 0, 0))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('[data-page="home"]')).toHaveAttribute('data-context', '1-night')
})

test('new discovery surfaces fit mobile, tablet and desktop and have no automated serious accessibility violations', async ({ page }) => {
  await openHome(page)
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    await noHorizontalClipping(page)
    await page.screenshot({ path: join(evidence, `home-${width}.png`), fullPage: true })
  }
  await search(page)
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    await noHorizontalClipping(page)
    await page.screenshot({ path: join(evidence, `search-${width}.png`), fullPage: true })
  }
  await page.locator('[data-search-results] [data-artist-id="' + artistId + '"]').click()
  await expect(page.locator('[data-page="artist"] h1')).toBeVisible()
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    await noHorizontalClipping(page)
    await page.screenshot({ path: join(evidence, `artist-${width}.png`), fullPage: true })
  }
  await page.locator('[data-page="artist"] [data-album-id="' + albumId + '"]').click()
  await expect(page.locator('[data-page="album"] article[data-track-id]')).toHaveCount(songs.length)
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    await noHorizontalClipping(page)
    await page.screenshot({ path: join(evidence, `album-${width}.png`), fullPage: true })
  }
  await page.evaluate(await readFile(resolve('node_modules/axe-core/axe.min.js'), 'utf8'))
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(value => ({ id: value.id, impact: value.impact, nodes: value.nodes.map(node => node.target) })))
  expect(violations.filter(value => ['critical', 'serious'].includes(value.impact))).toEqual([])
})

test('custom cards and panels react immediately without changing the selected theme', async ({ page }) => {
  await openHome(page)
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
  const theme = await page.locator('html').getAttribute('data-theme')
  const original = await page.locator('.clay-panel').first().evaluate(node => getComputedStyle(node).backgroundColor)
  await page.getByLabel('Warna latar', { exact: true }).fill('#16352a')
  await expect.poll(() => page.locator('.clay-panel').first().evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(original)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  const first = await page.locator('.clay-panel').first().evaluate(node => getComputedStyle(node).backgroundColor)
  await page.getByLabel('Warna latar', { exact: true }).fill('#362039')
  await expect.poll(() => page.locator('.clay-panel').first().evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(first)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Jelajahi', exact: true }).click()
  const custom = await page.evaluate(() => ({ panel:getComputedStyle(document.documentElement).getPropertyValue('--clay-panel').trim(), surface:getComputedStyle(document.documentElement).getPropertyValue('--clay-surface').trim(), sidebar:getComputedStyle(document.documentElement).getPropertyValue('--clay-sidebar').trim() }))
  expect(custom.panel).toBeTruthy()
  expect(custom.surface).toBeTruthy()
  expect(custom.sidebar).toBeTruthy()
  await noHorizontalClipping(page)
})

test('regional chart caches never appear in global Trending, even before the source refreshes', async ({ page }) => {
  await page.addInitScript(() => {
    const regional = { region:'ID', chartVersion:2, feedVersion:2, chartId:'isolated_regional_fixture', source:'Explicit regional fixture', tracks:[{id:'yt:xxxxxxxxxxx',title:'OLD REGIONAL FIXTURE MUST NOT APPEAR',artist:'Explicit fixture'}] }
    localStorage.setItem('mi-tune-trending',JSON.stringify(regional))
    localStorage.setItem('mi-tune-discovery',JSON.stringify(regional))
  })
  await openHome(page)
  await expect(page.locator('body')).not.toContainText('OLD REGIONAL FIXTURE MUST NOT APPEAR')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mi-tune-trending') || '{}').region)).toBe('ZZ')
  const response = await page.request.get(base + '/api/trending')
  expect((await response.json()).data.region).toBe('ZZ')
})

test('direct artist and album links work, while invalid IDs and source outages remain recoverable', async ({ page }) => {
  await page.goto(base + '/artist/' + artistId)
  await expect(page.locator('[data-page="artist"] h1')).toHaveText(artist.name)
  await page.goto(base + '/album/' + albumId)
  await expect(page.locator('[data-page="album"] article[data-track-id]')).toHaveCount(songs.length)
  await page.goto(base + '/artist/not-an-id')
  await expect(page.getByRole('alert')).toContainText('valid')
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await expect(page.locator('#main-content[data-page="search"]')).toBeVisible()
  await page.locator('#music-search').fill('unavailable')
  await page.locator('#music-search').press('Enter')
  await expect(page.locator('[data-search-results]')).toBeVisible()
  await page.locator('#music-search').fill('Isolated artist fixture')
  await page.locator('#music-search').press('Enter')
  await expect(page.locator('[data-search-results] article[data-track-id]')).toHaveCount(songs.length)
})

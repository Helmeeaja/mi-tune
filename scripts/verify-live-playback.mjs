import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

if (!process.env.TMPDIR) throw new Error('Configured scratch directory required')
const base = process.env.MI_TUNE_LIVE_URL || 'http://127.0.0.1:5175'
const trending = JSON.parse(await readFile(join(process.env.TMPDIR, 'mi-tune-live-api-trending.json'), 'utf8')).data
const podcasts = JSON.parse(await readFile(join(process.env.TMPDIR, 'mi-tune-live-api-podcasts.json'), 'utf8')).data
const song = trending.tracks[0]
const episode = [...podcasts.episodes].sort((a, b) => a.duration - b.duration)[0]
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/brave-browser', args: ['--mute-audio'] })
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const evidence = { liveProviders: true, base, song: { id: song.id, title: song.title }, episode: { id: episode.id, title: episode.title }, journeys: [] }
try {
  await page.addInitScript(() => { if (!localStorage.getItem('mi-tune-settings')) localStorage.setItem('mi-tune-settings', JSON.stringify({ language: 'id', animations: false, smoothScroll: false, autoplayNext: false, preloadNext: false })) })
  await page.goto(base + '/trending', { waitUntil: 'domcontentloaded' })
  await page.locator(`[data-track-id="${song.id}"]`).waitFor({ state: 'visible', timeout: 90000 })
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => { audio.volume = 0; audio.muted = true })
  await page.locator(`[data-track-id="${song.id}"]`).getByRole('button', { name: `Putar ${song.title}`, exact: true }).click()
  await page.waitForFunction(() => { const audio = document.querySelector('audio:not([aria-hidden="true"])'); return audio && !audio.paused && audio.currentTime > 1 }, null, { timeout: 180000 })
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => { window.liveAudioIdentity = audio })
  const before = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => ({ time: audio.currentTime, src: audio.currentSrc, paused: audio.paused, trackId: audio.dataset.track }))
  await page.locator('aside a[href="/settings"]').click()
  await page.locator('div[data-page="settings"]').waitFor({ state: 'visible' })
  await page.waitForFunction(time => document.querySelector('audio:not([aria-hidden="true"])').currentTime > time + 1, before.time, { timeout: 10000 })
  const after = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => ({ sameNode: window.liveAudioIdentity === audio, time: audio.currentTime, src: audio.currentSrc, paused: audio.paused, trackId: audio.dataset.track }))
  if (!after.sameNode || after.src !== before.src || after.trackId !== before.trackId || after.paused || after.time <= before.time) throw new Error('Live music did not persist across navigation')
  evidence.journeys.push({ kind: 'music', before, after })
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.pause())
  await page.goto(base + '/podcasts/episode/' + encodeURIComponent(episode.id), { waitUntil: 'domcontentloaded' })
  await page.locator('[data-page="podcast-episode"] h1').waitFor({ state: 'visible', timeout: 90000 })
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => { audio.volume = 0; audio.muted = true })
  await page.locator('[data-page="podcast-episode"]').getByRole('button', { name: 'Putar episode', exact: true }).click()
  await page.waitForFunction(id => { const audio = document.querySelector('audio:not([aria-hidden="true"])'); return audio && audio.dataset.track === id && !audio.paused && audio.currentTime > 1 }, episode.id, { timeout: 180000 })
  const start = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => ({ time: audio.currentTime, src: audio.currentSrc, paused: audio.paused, trackId: audio.dataset.track }))
  await page.waitForFunction(time => document.querySelector('audio:not([aria-hidden="true"])').currentTime > time + 1, start.time, { timeout: 10000 })
  const end = await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => ({ time: audio.currentTime, src: audio.currentSrc, paused: audio.paused, trackId: audio.dataset.track }))
  if (end.time <= start.time || end.paused || !end.src.includes('/api/podcasts/episodes/')) throw new Error('Live podcast did not reach advancing playback')
  evidence.journeys.push({ kind: 'podcast', start, end })
  await page.locator('audio:not([aria-hidden="true"])').evaluate(audio => audio.pause())
  evidence.errors = errors
  if (errors.length) throw new Error(errors.join('\n'))
  evidence.passed = true
} catch (error) {
  evidence.passed = false
  evidence.error = error.message
  evidence.text = await page.locator('h1,h2,[role="alert"]').allTextContents()
  throw error
} finally {
  await writeFile(join(process.env.TMPDIR, 'mi-tune-live-playback-evidence.json'), JSON.stringify(evidence, null, 2))
  await browser.close()
  console.log(JSON.stringify(evidence, null, 2))
}

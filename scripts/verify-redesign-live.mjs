import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const output = join(process.env.TMPDIR, 'mi-tune-redesign-live')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--mute-audio'] })
const errors = []
const proof = { base, pages: [], errors, liveAudio: null }
try {
  for (const width of [1440, 768, 375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.locator('main img').first().waitFor()
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.complete ? null : new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 5000) }))) })
    const state = await page.evaluate(() => {
      const dock = document.querySelector('[aria-label="Pemutar musik"]')
      const nav = document.querySelector('[aria-label="Navigasi mobile"]')
      return {
        title: document.querySelector('h1')?.innerText,
        overflow: document.documentElement.scrollWidth - innerWidth,
        images: Array.from(document.images).filter(image => image.getBoundingClientRect().width > 0).map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0 })),
        background: getComputedStyle(document.body).backgroundColor,
        smoothScroll: document.documentElement.dataset.scrollExperience || 'native',
        dock: dock.getBoundingClientRect().toJSON(),
        mobileNav: nav.getBoundingClientRect().toJSON()
      }
    })
    await page.screenshot({ path: join(output, `home-${width}.png`), fullPage: true })
    proof.pages.push({ width, ...state })
    console.log(JSON.stringify({ width, title: state.title, overflow: state.overflow, loadedImages: state.images.filter(image => image.loaded).length, visibleImages: state.images.length, smoothScroll: state.smoothScroll }))
    if (state.overflow > 1) throw new Error(`Horizontal overflow at ${width}px`)
    await context.close()
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const candidates = ['yt:5Zhd2BBEesc', 'yt:AEBld6I_AKs']
  let track
  for (const id of candidates) {
    const response = await page.request.get(`${base}/api/tracks/${encodeURIComponent(id)}`)
    if (!response.ok()) continue
    const data = (await response.json()).data
    if ((data.audioReady || data.fileSize > 0) && /Jonathan Coulton/i.test(data.artist) && data.title === 'Code Monkey') { track = data; break }
  }
  if (!track) throw new Error('Cached permitted Code Monkey recording not available; live proof is incomplete.')
  await page.goto(`${base}/track/${encodeURIComponent(track.id)}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: track.title, level: 1, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Putar musik di halaman lagu', exact: true }).click()
  await page.waitForFunction(() => { const audio = document.querySelector('audio'); return audio.dataset.track && !audio.paused && audio.currentTime > 0.7 }, { timeout: 20000 })
  const started = await page.evaluate(() => ({ id: document.querySelector('audio').dataset.track, clock: document.querySelector('audio').currentTime, route: location.pathname }))
  await page.getByRole('textbox', { name: 'Cari lagu atau artis' }).fill('Code Monkey Jonathan Coulton')
  await page.getByRole('button', { name: 'Cari musik sekarang', exact: true }).click()
  await page.getByRole('heading', { name: 'Hasil untuk “Code Monkey Jonathan Coulton”', exact: true }).waitFor({ timeout: 45000 })
  await page.getByRole('region', { name: 'Jelajahi musik', exact: true }).locator('article').first().waitFor({ timeout: 45000 })
  const afterSearch = await page.evaluate(() => ({ id: document.querySelector('audio').dataset.track, clock: document.querySelector('audio').currentTime, route: location.pathname, paused: document.querySelector('audio').paused, dialogs: document.querySelectorAll('dialog[open]').length }))
  if (afterSearch.id !== track.id || afterSearch.paused || afterSearch.clock <= started.clock || afterSearch.route !== started.route || afterSearch.dialogs !== 0) throw new Error('Search interrupted current playback or left track page.')
  await page.screenshot({ path: join(output, 'now-playing-desktop.png'), fullPage: true })
  proof.liveAudio = { track: { id: track.id, title: track.title, artist: track.artist }, started, afterSearch, rightsSource: 'https://www.jonathancoulton.com/faq/' }
  console.log(JSON.stringify(proof.liveAudio))
  await context.close()
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`)
} finally {
  await writeFile(join(output, 'proof.json'), JSON.stringify(proof, null, 2))
  await browser.close()
  console.log(`Proof directory: ${output}`)
}

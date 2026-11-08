import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseLrc, getActiveLyricIndex } from '../src/lib/lyrics.mjs'

const base = process.argv[2] || 'http://127.0.0.1:5173'
if (!process.env.TMPDIR) throw new Error('Live browser verification requires the configured scratch directory')
const root = join(process.env.TMPDIR, 'mi-tune-live-proof')
await mkdir(root, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/brave-browser', headless: true, args: ['--mute-audio'] })
const proof = { source: 'Actual production app and YouTube Music recording; no synthetic music or test accounts', base, checks: {}, screenshots: [], pageErrors: [] }
let page
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  page = await context.newPage()
  page.on('pageerror', error => proof.pageErrors.push(error.message))
  await page.goto(base + '/search', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20000 }).toBe(true)
  await page.getByRole('textbox', { name: 'Cari lagu atau artis' }).fill('Code Monkey Jonathan Coulton')
  await page.getByRole('button', { name: 'Cari musik sekarang' }).click()
  const trackId = 'yt:AEBld6I_AKs'
  const row = page.locator(`main article[data-track-id="${trackId}"]`)
  await expect(row, { timeout: 85000 }).toBeVisible()
  await row.getByRole('button', { name: 'Putar Code Monkey', exact: true }).click()
  const consent = page.getByRole('dialog', { name: 'Siapkan audio lagu' })
  await expect(consent).toHaveCount(0)
  await expect.poll(() => page.locator('audio').evaluate(audio => !audio.paused && audio.currentTime > 1 && audio.readyState >= 2), { timeout: 30000 }).toBe(true)
  proof.checks.onlinePlayback = await page.locator('audio').evaluate(audio => ({ duration: audio.duration, currentTime: audio.currentTime, readyState: audio.readyState, paused: audio.paused, error: audio.error?.code || null }))
  expect(proof.checks.onlinePlayback.duration).toBeGreaterThan(180)
  await page.getByRole('button', { name: 'Jeda musik', exact: true }).click()
  const seek = page.getByRole('slider', { name: 'Posisi pemutaran' })
  const box = await seek.boundingBox()
  await seek.click({ position: { x: box.width / 2, y: box.height / 2 } })
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(80)
  const lyricsResponse = await context.request.get(base + `/api/tracks/${encodeURIComponent(trackId)}/lyrics`)
  expect(lyricsResponse.status()).toBe(200)
  const lyrics = (await lyricsResponse.json()).data
  const lines = parseLrc(lyrics.syncedLyrics || '')
  expect(lines.length).toBeGreaterThan(10)
  await page.getByRole('button', { name: 'Buka lirik', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Lirik' })
  await expect(panel.locator('[data-active]')).toHaveCount(lines.length)
  const currentTime = await page.locator('audio').evaluate(audio => audio.currentTime)
  await expect(panel.locator('[data-active="true"]')).toHaveText(lines[getActiveLyricIndex(lines, currentTime)].text)
  proof.checks.syncedLyrics = { cueCount: lines.length, sourceId: lyrics.sourceId, audioTime: currentTime, highlightedLine: await panel.locator('[data-active="true"]').innerText() }
  await page.keyboard.press('Escape')
  const desktop = join(root, 'desktop-player.png')
  await page.screenshot({ path: desktop, fullPage: true })
  proof.screenshots.push(desktop)
  await row.getByRole('button', { name: 'Unduh Code Monkey', exact: true }).click()
  await expect(consent).toBeVisible()
  await consent.getByRole('checkbox').check()
  await consent.getByRole('button', { name: 'Siapkan audio', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Tersimpan offline Code Monkey', exact: true }), { timeout: 30000 }).toBeDisabled()
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('button', { name: 'Downloads', exact: true }).click()
  await expect(page.locator('main article')).toHaveCount(1)
  const download = await page.evaluate(async id => {
    const audio = await (await caches.open('mi-tune-audio-v1')).match(`/api/tracks/${encodeURIComponent(id)}/audio`)
    const cover = await (await caches.open('mi-tune-covers-v1')).match(`/api/tracks/${encodeURIComponent(id)}/cover`)
    return { bytes: audio ? (await audio.arrayBuffer()).byteLength : 0, coverStored: Boolean(cover), caches: await caches.keys() }
  }, trackId)
  expect(download.bytes).toBeGreaterThan(1000000)
  expect(download.coverStored).toBe(true)
  proof.checks.deviceDownload = download
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Musik, tanpa internet.' })).toBeVisible()
  await page.getByRole('button', { name: 'Putar Code Monkey', exact: true }).click()
  await expect.poll(() => page.locator('audio').evaluate(audio => !audio.paused && audio.currentTime > 1), { timeout: 15000 }).toBe(true)
  const offlineRange = await page.evaluate(async id => {
    const response = await fetch(`/api/tracks/${encodeURIComponent(id)}/audio`, { headers: { Range: 'bytes=1000-1999' } })
    return { status: response.status, bytes: Array.from(new Uint8Array(await response.arrayBuffer())), range: response.headers.get('content-range'), online: navigator.onLine }
  }, trackId)
  expect(offlineRange.status).toBe(206)
  expect(offlineRange.bytes.length).toBe(1000)
  expect(offlineRange.online).toBe(false)
  proof.checks.offlineRange = { status: offlineRange.status, byteCount: offlineRange.bytes.length, range: offlineRange.range, sha256: createHash('sha256').update(Buffer.from(offlineRange.bytes)).digest('hex') }
  await page.getByRole('button', { name: 'Buka lirik', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Lirik' }).locator('[data-active]')).toHaveCount(lines.length)
  await page.keyboard.press('Escape')
  await expect.poll(() => page.locator('main img').first().evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  proof.checks.offlineReopen = { audioDecoded: true, lyricsAvailable: true, coverDecoded: true }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Navigasi ponsel' })).toBeVisible()
  proof.checks.mobile = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }))
  expect(proof.checks.mobile.documentWidth).toBeLessThanOrEqual(proof.checks.mobile.viewport)
  await page.getByRole('button', { name: 'Buka antrean', exact: true }).click()
  const queue = page.getByRole('dialog', { name: 'Antrean pemutaran' })
  await expect(queue.getByRole('button', { name: 'Acak antrean', exact: true })).toBeVisible()
  await expect(queue.getByRole('slider', { name: 'Volume' })).toBeVisible()
  await page.keyboard.press('Escape')
  const mobile = join(root, 'mobile-offline.png')
  await page.screenshot({ path: mobile, fullPage: true })
  proof.screenshots.push(mobile)
  expect(proof.pageErrors).toEqual([])
  proof.passed = true
  console.log(JSON.stringify({ ...proof, proofPath: join(root, 'browser-proof.json') }))
} catch (error) {
  proof.passed = false
  proof.failure = error.message
  if (page) await page.screenshot({ path: join(root, 'browser-failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await writeFile(join(root, 'browser-proof.json'), JSON.stringify(proof, null, 2))
  await browser.close()
}

import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const base = process.argv[2] || 'http://127.0.0.1:5173'
const output = join(process.env.TMPDIR, 'mi-tune-redesign-audit')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--mute-audio'] })
const report = { base, visualInspection: 'Unverified: auxiliary vision connection error', pages: [], keyboard: null }
try {
  for (const width of [1440, 375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, bypassCSP: true })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const route of ['/', '/search', '/library', '/downloads', '/friends', '/trending', '/track/yt%3AAEBld6I_AKs']) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30000 })
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(async () => {
        await Promise.all(Array.from(document.images).map(image => image.complete ? null : new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 10000) })))
      })
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const analysis = await page.evaluate(async () => {
        const axe = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
        const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden' }
        const targets = Array.from(document.querySelectorAll('button,a,input[type="range"]')).filter(element => visible(element) && !element.disabled).map(element => ({ name: element.getAttribute('aria-label') || element.innerText || element.type, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
        return {
          heading: document.querySelector('h1').innerText,
          overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          images: Array.from(document.images).filter(visible).map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0 })),
          smallTargets: targets.filter(target => target.width < 43 || target.height < 43),
          violations: axe.violations.map(violation => ({ id: violation.id, impact: violation.impact, description: violation.description, nodes: violation.nodes.map(node => ({ selector: node.target, summary: node.failureSummary })) }))
        }
      })
      const name = route === '/' ? 'home' : route.startsWith('/track/') ? 'now-playing' : route.slice(1)
      if (width !== 320) await page.screenshot({ path: join(output, `${name}-${width}.png`), fullPage: true })
      report.pages.push({ width, route, errors: [...errors], ...analysis })
      console.log(JSON.stringify({ width, route, overflow: analysis.overflow, violations: analysis.violations.map(item => item.id), smallTargets: analysis.smallTargets.length, unloadedImages: analysis.images.filter(image => !image.loaded).length, errors: errors.length }))
    }
    if (width === 1440) {
      await page.goto(base, { waitUntil: 'domcontentloaded' })
      const open = page.locator('header').getByRole('button', { name: /^Masuk/ })
      await open.click()
      await page.getByRole('dialog').waitFor()
      const trapped = await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement))
      await page.keyboard.press('Escape')
      const restored = await open.evaluate(element => document.activeElement === element)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const scroll = await page.evaluate(() => document.documentElement.dataset.scrollExperience || 'native')
      report.keyboard = { trapped, restored, reducedMotionScroll: scroll }
      console.log(JSON.stringify(report.keyboard))
    }
    await context.close()
  }
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`Audit directory: ${output}`)
}

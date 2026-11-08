import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const base = process.argv[2] || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--mute-audio'] })
const results = []
try {
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, bypassCSP: true })
    for (const route of ['/', '/library', '/track/yt%3AAEBld6I_AKs']) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 20000 })
      await page.evaluate(() => document.fonts.ready)
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const data = await page.evaluate(async () => {
        const report = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
        return { violations: report.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) }
      })
      results.push({ width, route, ...data })
      console.log(JSON.stringify({ width, route, violations: data.violations.map(item => item.id), overflow: data.overflow }))
    }
    if (width === 1440) {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => !document.documentElement.dataset.scrollExperience)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.waitForFunction(() => document.documentElement.dataset.scrollExperience === 'smooth')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => !document.documentElement.dataset.scrollExperience)
      console.log('Runtime reduced motion: native → smooth → native passed')
    }
    await page.close()
  }
} finally {
  await writeFile(join(process.env.TMPDIR, 'mi-tune-redesign-a11y-fixes.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
if (results.some(result => result.violations.length || result.overflow)) process.exitCode = 1

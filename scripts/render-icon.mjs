import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true, args: ['--mute-audio'] })
try {
  const page = await browser.newPage()
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;padding:0;width:100%;height:100%;}svg{display:block;width:100%;height:100%;}</style>${svg}`)
    await page.screenshot({ path: `public/icons/icon-${size}.png` })
    console.log(`PWA icon rendered: ${size}x${size}`)
  }
} finally {
  await browser.close()
}

import { Resvg } from '@resvg/resvg-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../public/', import.meta.url))
const svg = (await readFile(join(root, 'icon.svg'), 'utf8')).trim()
const square = svg.replace('rx="116"', '')
await mkdir(join(root, 'icons'), { recursive: true })
await mkdir(join(root, 'splash'), { recursive: true })

async function render(source, width, path) {
  const image = new Resvg(source, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng()
  await writeFile(join(root, path), image)
  console.log(`${path}: ${width}px, ${image.length} bytes`)
}

for (const size of [192, 512]) {
  await render(svg, size, `icons/icon-${size}.png`)
  await render(square, size, `icons/maskable-${size}.png`)
}
await render(square, 180, 'icons/apple-touch-icon.png')

const devices = [[320, 568, 2], [375, 667, 2], [375, 812, 3], [390, 844, 3], [393, 852, 3], [414, 896, 2], [430, 932, 3], [768, 1024, 2], [1024, 1366, 2]]
const links = []
const inner = square.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
for (const [deviceWidth, deviceHeight, ratio] of devices) {
  for (const orientation of ['portrait', 'landscape']) {
    const width = (orientation === 'portrait' ? deviceWidth : deviceHeight) * ratio
    const height = (orientation === 'portrait' ? deviceHeight : deviceWidth) * ratio
    const logo = Math.round(108 * ratio)
    const path = `splash/apple-splash-${width}x${height}.png`
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f4efe7"/><svg x="${(width - logo) / 2}" y="${(height - logo) / 2}" width="${logo}" height="${logo}" viewBox="0 0 512 512">${inner}</svg></svg>`
    await render(source, width, path)
    links.push(`<link rel="apple-touch-startup-image" href="/${path}" media="screen and (device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})" />`)
  }
}
console.log('\niOS startup links:\n' + links.join('\n'))

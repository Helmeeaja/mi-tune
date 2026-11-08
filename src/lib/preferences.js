export const defaultSettings = {
  language: 'id',
  theme: 'light',
  fontSize: 16,
  lyricSize: 1,
  accentColor: '#a44730',
  textColor: '',
  iconColor: '',
  backgroundColor: '',
  backgroundImage: '',
  animations: true,
  smoothScroll: true,
  compactMode: false,
  followLyrics: true,
  lyricOffset: 0,
  keyboardShortcuts: true,
  preloadNext: true,
  dataSaver: false,
  autoplayNext: true,
  sleepMinutes: 0
}

function color(value, fallback = '') {
  return typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? value : fallback
}

function number(value, fallback, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback
}

export function normalizeSettings(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const result = { ...defaultSettings }
  if (['id', 'en'].includes(input.language)) result.language = input.language
  if (['light', 'dark', 'system'].includes(input.theme)) result.theme = input.theme
  result.fontSize = number(input.fontSize, 16, 14, 20)
  result.lyricSize = number(input.lyricSize, 1, 0.85, 1.6)
  result.lyricOffset = number(input.lyricOffset, 0, -10, 10)
  result.sleepMinutes = number(input.sleepMinutes, 0, 0, 120)
  result.accentColor = color(input.accentColor, defaultSettings.accentColor)
  result.textColor = color(input.textColor)
  result.iconColor = color(input.iconColor)
  result.backgroundColor = color(input.backgroundColor)
  if (typeof input.backgroundImage === 'string' && input.backgroundImage.length <= 1500000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z\d+/]+={0,2}$/.test(input.backgroundImage)) result.backgroundImage = input.backgroundImage
  for (const key of ['animations', 'smoothScroll', 'compactMode', 'followLyrics', 'keyboardShortcuts', 'preloadNext', 'dataSaver', 'autoplayNext']) if (typeof input[key] === 'boolean') result[key] = input[key]
  return result
}

export function readSettings() {
  try { return { ...normalizeSettings(JSON.parse(localStorage.getItem('mi-tune-settings'))), sleepMinutes: 0 } }
  catch { return { ...defaultSettings } }
}

export function saveSettings(settings) {
  try { localStorage.setItem('mi-tune-settings', JSON.stringify({ ...normalizeSettings(settings), sleepMinutes: 0 })); return true }
  catch { return false }
}

function mix(first, second, amount) {
  return `#${[1, 3, 5].map(index => Math.round(parseInt(first.slice(index, index + 2), 16) * (1 - amount) + parseInt(second.slice(index, index + 2), 16) * amount).toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex) {
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastColor(hex) {
  const light = luminance(hex)
  return (light + 0.05) / 0.05 > 1.05 / (light + 0.05) ? '#171411' : '#ffffff'
}

function readableAccent(hex, background) {
  const canvas = luminance(background)
  const contrast = value => (Math.max(luminance(value), canvas) + 0.05) / (Math.min(luminance(value), canvas) + 0.05)
  if (contrast(hex) >= 4.5) return hex
  const target = canvas > 0.35 ? 0 : 255
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16))
  for (let step = 1; step <= 20; step += 1) {
    const value = `#${channels.map(channel => Math.round(channel + (target - channel) * step / 20).toString(16).padStart(2, '0')).join('')}`
    if (contrast(value) >= 4.5) return value
  }
  return target ? '#ffffff' : '#000000'
}

export function applySettings(value) {
  if (typeof document === 'undefined') return
  const settings = normalizeSettings(value)
  const root = document.documentElement
  root.lang = settings.language
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const reduced = !settings.animations || matchMedia('(prefers-reduced-motion: reduce)').matches
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.motion = reduced ? 'reduced' : 'full'
  root.dataset.compact = String(settings.compactMode)
  root.dataset.customText = String(Boolean(settings.textColor))
  root.dataset.customIcon = String(Boolean(settings.iconColor))
  root.style.fontSize = `${settings.fontSize}px`
  const canvas = settings.backgroundColor || (dark ? '#211f1d' : '#f4efe7')
  const custom = Boolean(settings.backgroundColor)
  const paletteDark = custom ? luminance(canvas) < 0.24 : dark
  const surface = custom ? mix(canvas, '#ffffff', paletteDark ? 0.075 : 0.2) : dark ? '#2b2825' : '#fbf8f2'
  const ink = settings.textColor || (paletteDark ? '#f4eade' : '#302c29')
  root.style.setProperty('--color-canvas', canvas)
  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) themeMeta.setAttribute('content', canvas)
  const statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (statusMeta) statusMeta.setAttribute('content', dark ? 'black-translucent' : 'default')
  root.style.setProperty('--color-surface', surface)
  root.style.setProperty('--color-ink', ink)
  root.style.setProperty('--color-muted', settings.textColor || (custom ? readableAccent(mix(ink, surface, 0.3), surface) : dark ? '#beb2a6' : '#6b6158'))
  root.style.setProperty('--color-user-text', ink)
  root.style.setProperty('--color-line', custom ? mix(surface, ink, 0.17) : dark ? '#49413b' : '#e5ded3')
  root.style.setProperty('--color-sage', custom ? mix(surface, '#8b9d7b', 0.18) : dark ? '#3c4234' : '#dde3d2')
  root.style.setProperty('--color-accent', settings.accentColor)
  root.style.setProperty('--color-accent-readable', readableAccent(settings.accentColor, surface))
  root.style.setProperty('--color-accent-contrast', contrastColor(settings.accentColor))
  root.style.setProperty('--color-accent-light', `color-mix(in srgb, ${settings.accentColor} ${paletteDark ? '26%' : '19%'}, ${surface})`)
  if (custom) {
    root.style.setProperty('--clay-panel', surface)
    root.style.setProperty('--clay-surface', mix(canvas, surface, 0.5))
    root.style.setProperty('--clay-button', mix(canvas, surface, 0.7))
    root.style.setProperty('--clay-sidebar', mix(canvas, surface, 0.25))
    root.style.setProperty('--clay-lyrics', mix(canvas, surface, 0.35))
    root.style.setProperty('--clay-highlight', paletteDark ? '#ffffff09' : '#ffffff66')
    root.style.setProperty('--clay-lowlight', paletteDark ? '#00000038' : '#00000012')
    root.style.setProperty('--clay-border', paletteDark ? '#ffffff0d' : '#ffffff66')
    root.style.setProperty('--clay-shadow', paletteDark ? '#00000045' : '#00000018')
  } else {
    for (const key of ['--clay-panel', '--clay-surface', '--clay-button', '--clay-sidebar', '--clay-lyrics', '--clay-highlight', '--clay-lowlight', '--clay-border', '--clay-shadow']) root.style.removeProperty?.(key)
  }
  root.style.setProperty('--color-icon', settings.iconColor || 'currentColor')
  root.style.setProperty('--lyric-scale', String(settings.lyricSize))
  root.style.setProperty('--app-background-image', settings.backgroundImage ? `url("${settings.backgroundImage}")` : 'none')
}

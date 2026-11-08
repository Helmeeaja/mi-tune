import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings, normalizeSettings, readSettings, saveSettings, applySettings } from '../src/lib/preferences.js'

test('settings validate literal values and reject unsafe images and non-boolean preferences', () => {
  const result = normalizeSettings({ theme: 'unknown', fontSize: 100, lyricSize: 0, lyricOffset: -200, accentColor: 'javascript:alert(1)', animations: 'false', backgroundImage: 'data:image/svg+xml;base64,PHN2Zz4=', dataSaver: true, ownerId: 'another-account' })
  assert.equal(result.theme, 'light')
  assert.equal(result.fontSize, 20)
  assert.equal(result.lyricSize, 0.85)
  assert.equal(result.lyricOffset, -10)
  assert.equal(result.accentColor, defaultSettings.accentColor)
  assert.equal(result.animations, true)
  assert.equal(result.backgroundImage, '')
  assert.equal(result.dataSaver, true)
  assert.equal(result.ownerId, undefined)
  assert.deepEqual(normalizeSettings(null), defaultSettings)
})

test('settings persist in browser storage without restarting a sleep timer', () => {
  const previous = globalThis.localStorage
  const values = new Map()
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  try {
    saveSettings({ ...defaultSettings, theme: 'dark', fontSize: 18, followLyrics: false, lyricOffset: 1.25, sleepMinutes: 30 })
    const settings = readSettings()
    assert.equal(settings.theme, 'dark')
    assert.equal(settings.fontSize, 18)
    assert.equal(settings.followLyrics, false)
    assert.equal(settings.lyricOffset, 1.25)
    assert.equal(settings.sleepMinutes, 0)
    values.set('mi-tune-settings', '{broken')
    assert.deepEqual(readSettings(), defaultSettings)
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous }
})

test('settings apply theme, typography, contrast, compact mode and reduced-motion to the actual root contract', () => {
  const previousDocument = globalThis.document
  const previousMatch = globalThis.matchMedia
  const values = new Map()
  const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value) } }
  globalThis.document = { documentElement: root }
  globalThis.matchMedia = query => ({ matches: query === '(prefers-color-scheme: dark)' })
  try {
    applySettings({ ...defaultSettings, theme: 'system', fontSize: 18, lyricSize: 1.4, animations: false, compactMode: true, accentColor: '#ffffff', textColor: '#eeeeee', iconColor: '#ccddaa' })
    assert.equal(root.dataset.theme, 'dark')
    assert.equal(root.dataset.motion, 'reduced')
    assert.equal(root.dataset.compact, 'true')
    assert.equal(root.style.fontSize, '18px')
    assert.equal(values.get('--lyric-scale'), '1.4')
    assert.equal(values.get('--color-accent-contrast'), '#171411')
    assert.equal(values.get('--color-ink'), '#eeeeee')
    assert.equal(values.get('--color-icon'), '#ccddaa')
    globalThis.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' })
    applySettings({ ...defaultSettings, animations: true })
    assert.equal(root.dataset.motion, 'reduced')
    assert.equal(root.dataset.theme, 'light')
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousMatch === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = previousMatch
  }
})

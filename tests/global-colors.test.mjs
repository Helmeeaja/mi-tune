import test from 'node:test'
import assert from 'node:assert/strict'
import { applySettings, defaultSettings } from '../src/lib/preferences.js'

function withRoot(check) {
  const oldDocument = globalThis.document
  const oldMatch = globalThis.matchMedia
  const properties = new Map()
  const root = { dataset: {}, style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) } }
  globalThis.document = { documentElement: root }
  globalThis.matchMedia = () => ({ matches: false })
  try { check(root, properties) }
  finally {
    if (oldDocument === undefined) delete globalThis.document
    else globalThis.document = oldDocument
    if (oldMatch === undefined) delete globalThis.matchMedia
    else globalThis.matchMedia = oldMatch
  }
}

test('custom text is a global foreground including secondary text in every theme and canvas', () => {
  withRoot((root, values) => {
    for (const theme of ['light', 'dark', 'system']) {
      for (const backgroundColor of ['', '#ffffff', '#112233']) {
        for (const textColor of ['#ffffff', '#111111', '#abcdef']) {
          applySettings({ ...defaultSettings, theme, backgroundColor, textColor })
          assert.equal(root.dataset.customText, 'true')
          assert.equal(values.get('--color-ink'), textColor)
          assert.equal(values.get('--color-muted'), textColor)
          assert.equal(values.get('--color-user-text'), textColor)
          assert.equal(values.get('--color-icon'), 'currentColor')
          assert.equal(root.dataset.customIcon, 'false')
        }
      }
    }
  })
})

test('icon overrides are independent of text and reset immediately', () => {
  withRoot((root, values) => {
    applySettings({ ...defaultSettings, textColor: '#ffffff', iconColor: '#44aaff' })
    assert.equal(root.dataset.customText, 'true')
    assert.equal(root.dataset.customIcon, 'true')
    assert.equal(values.get('--color-icon'), '#44aaff')
    assert.equal(values.get('--color-muted'), '#ffffff')
    applySettings({ ...defaultSettings, iconColor: '#ff4488' })
    assert.equal(root.dataset.customText, 'false')
    assert.equal(root.dataset.customIcon, 'true')
    assert.equal(values.get('--color-muted'), '#6b6158')
    assert.equal(values.get('--color-icon'), '#ff4488')
    applySettings(defaultSettings)
    assert.equal(root.dataset.customText, 'false')
    assert.equal(root.dataset.customIcon, 'false')
    assert.equal(values.get('--color-icon'), 'currentColor')
    assert.equal(values.get('--color-ink'), '#302c29')
  })
})

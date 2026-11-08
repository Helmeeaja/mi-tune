import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { translate, normalizeLanguage, formatDate } from '../src/lib/i18n.mjs'
import { featureTranslations } from '../src/lib/feature-translations.mjs'
import { interfaceTranslations } from '../src/lib/interface-translations.mjs'
import { copywriting } from '../src/lib/copywriting.mjs'

test('language selection falls back safely and interpolates data without translating music identities', () => {
  assert.equal(normalizeLanguage('en'), 'en')
  assert.equal(normalizeLanguage('unsupported'), 'id')
  assert.equal(translate('en', 'Buka dan putar {title}', { title: 'An actual song title' }), 'Open and play An actual song title')
  assert.equal(translate('id', 'Buka dan putar {title}', { title: 'An actual song title' }), 'Buka dan putar An actual song title')
  assert.equal(translate('en', 'An actual song title'), 'An actual song title')
  assert.equal(translate('en', null), '')
  assert.equal(formatDate('en', 'invalid'), '')
  const date = new Date(2026, 10, 8, 16, 30)
  assert.notEqual(formatDate('id', date), formatDate('en', date))
})

test('new discovery and player surfaces have complete English mappings for static translation keys', () => {
  const files = [...readdirSync(new URL('../src/components/', import.meta.url)).filter(file => file.endsWith('.jsx')).map(file => 'components/' + file), ...readdirSync(new URL('../src/pages/', import.meta.url)).filter(file => file.endsWith('.jsx')).map(file => 'pages/' + file)]
  const missing = new Set()
  for (const file of files) {
    const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
    for (const match of source.matchAll(/\bt\(\s*(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)")/g)) {
      const key = (match[1] ?? match[2]).replace(/\\'/g, "'").replace(/\\"/g, '"')
      if (!Object.hasOwn(featureTranslations, key) && !Object.hasOwn(interfaceTranslations, key) && !Object.hasOwn(copywriting, key)) missing.add(file + ': ' + key)
    }
  }
  assert.deepEqual([...missing], [])
})

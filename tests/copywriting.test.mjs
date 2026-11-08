import test from 'node:test'
import assert from 'node:assert/strict'
import { copywriting } from '../src/lib/copywriting.mjs'
import { translate } from '../src/lib/i18n.mjs'

const values = { title: 'Housewife', query: 'Ardhianzy', count: 17, available: 37, total: 50, minutes: 45, position: '12:34', date: '8 Nov 2026' }

test('casual app copy is available in both languages without changing source titles or people', () => {
  assert.equal(translate('en', 'Temui pemilik suaranya'), 'From your search')
  assert.equal(translate('id', 'Temui pemilik suaranya'), 'Dari pencarianmu')
  assert.equal(translate('en', 'Cari judul, artis, atau suasana. Temukan lagu, profil artis, dan rilisan dalam satu pencarian.'), 'Search songs, artists, albums, or podcasts.')
  assert.equal(translate('en', 'Housewife'), 'Housewife')
  assert.equal(translate('en', 'Ardhianzy'), 'Ardhianzy')
})

test('every rewritten label keeps the same interpolation contract', () => {
  for (const [key, pair] of Object.entries(copywriting)) {
    assert.equal(pair.length, 2)
    assert.ok(pair.every(text => typeof text === 'string' && text.trim()))
    const names = [...key.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort()
    for (const text of pair) assert.deepEqual([...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort(), names, key)
    for (const language of ['id','en']) assert.doesNotMatch(translate(language, key, values), /\{(?:title|query|count|available|total|minutes|position|date)\}/, key)
  }
})

test('fully formatted server messages also use the revised tone', () => {
  assert.equal(translate('en', 'Menampilkan 17 episode'), 'Menampilkan 17 episode')
  assert.equal(translate('en', '17 episode tersedia'), 'Showing 17 episodes')
  assert.equal(translate('id', '17 episode tersedia'), 'Menampilkan 17 episode')
  assert.match(translate('en', 'Putar episode Housewife'), /Play episode Housewife/)
})

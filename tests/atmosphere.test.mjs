import test from 'node:test'
import assert from 'node:assert/strict'
import { greetingPools, getListeningContext, chooseGreeting } from '../src/lib/atmosphere.mjs'

function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
}

test('every combined day/time context has eight unique bilingual greetings and its own coherent mood selection', () => {
  assert.equal(Object.keys(greetingPools).length, 28)
  const allId = new Set()
  const allEn = new Set()
  for (let day = 0; day < 7; day += 1) for (const [period, hour] of [['morning', 8], ['afternoon', 14], ['evening', 19], ['night', 23]]) {
    const date = new Date(2026, 10, 8 + day, hour)
    assert.equal(date.getDay(), day)
    const context = getListeningContext(date)
    assert.equal(context.key, `${day}-${period}`)
    assert.equal(context.period, period)
    assert.ok(context.title.id && context.title.en && context.tag.id && context.tag.en && context.description.id && context.description.en)
    assert.ok(context.queries.length >= 2)
    assert.match(context.artwork, /^\/artwork\/.+\.jpg$/)
    const pool = greetingPools[context.key]
    assert.ok(pool.length >= 8)
    assert.equal(new Set(pool.map(value => value.id)).size, pool.length)
    assert.equal(new Set(pool.map(value => value.en)).size, pool.length)
    for (const value of pool) { allId.add(value.id); allEn.add(value.en); assert.ok(value.id && value.en); assert.doesNotMatch(value.id + value.en, /browser|peramban/i) }
  }
  assert.equal(allId.size, 224)
  assert.equal(allEn.size, 224)
})

test('device-local boundaries and calendar midnight change the whole context', () => {
  for (const [hour, minute, period] of [[4,59,'night'],[5,0,'morning'],[11,59,'morning'],[12,0,'afternoon'],[16,59,'afternoon'],[17,0,'evening'],[21,59,'evening'],[22,0,'night']]) assert.equal(getListeningContext(new Date(2026,10,9,hour,minute)).period, period)
  assert.equal(getListeningContext(new Date(2026,10,8,23,59)).key, '0-night')
  assert.equal(getListeningContext(new Date(2026,10,9,0,0)).key, '1-night')
  assert.match(getListeningContext(new Date(2026,10,9,0,0)).stamp, /^2026-11-09:night$/)
  assert.throws(() => getListeningContext(new Date('invalid')), TypeError)
  assert.notDeepEqual(getListeningContext(new Date(2026,10,9,8)).queries, getListeningContext(new Date(2026,10,14,8)).queries)
  assert.notEqual(getListeningContext(new Date(2026,10,13,23)).mood, getListeningContext(new Date(2026,10,15,23)).mood)
})

test('shuffle bags prevent full-cycle and recent repetition across app opens in all contexts', () => {
  for (const key of Object.keys(greetingPools)) {
    const device = storage()
    const context = { key }
    let recent = []
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const seen = []
      for (let count = 0; count < greetingPools[key].length; count += 1) {
        const entry = chooseGreeting(context, { storage: device, random: () => .25 })
        assert.ok(!recent.includes(entry.index))
        recent = [...recent, entry.index].slice(-3)
        seen.push(entry.index)
      }
      assert.equal(new Set(seen).size, greetingPools[key].length)
    }
  }
})

test('corrupt or inaccessible storage and extreme random values stay safe without repeated greetings', () => {
  for (const random of [() => 0, () => 1, () => NaN]) {
    const device = { getItem() { throw new Error('Explicit isolated denied device storage') }, setItem() { throw new Error('Explicit isolated denied device storage') } }
    const seen = Array.from({length:8}, () => chooseGreeting({key:'0-night'}, {storage:device,random}).index)
    assert.equal(new Set(seen).size, 8)
  }
  const device = { getItem: () => '{broken', setItem() {} }
  assert.ok(chooseGreeting({key:'1-morning'}, {storage:device}).en)
  assert.throws(() => chooseGreeting({key:'unknown'}), TypeError)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { centeredScroll, lyricPadding } from '../src/lib/lyric-scroll.mjs'

test('active lyrics center relative to their own viewport, not the document', () => {
  assert.equal(centeredScroll({ scrollTop: 300, viewportTop: 220, viewportHeight: 400, lineTop: 550, lineHeight: 60, maxScroll: 1800 }), 460)
  assert.equal(centeredScroll({ scrollTop: 50, viewportTop: 120, viewportHeight: 240, lineTop: 230, lineHeight: 80, maxScroll: 900 }), 80)
})

test('first and final wrapped lyrics have enough padding to reach the center', () => {
  assert.deepEqual(lyricPadding(360, 64, 96), { top: 148, bottom: 132 })
  assert.equal(centeredScroll({ scrollTop: 0, viewportTop: 200, viewportHeight: 360, lineTop: 348, lineHeight: 64, maxScroll: 500 }), 0)
  assert.equal(centeredScroll({ scrollTop: 500, viewportTop: 200, viewportHeight: 360, lineTop: 332, lineHeight: 96, maxScroll: 500 }), 500)
  assert.equal(centeredScroll({ scrollTop: 0, viewportTop: 100, viewportHeight: 300, lineTop: -900, lineHeight: 50, maxScroll: 200 }), 0)
})

test('short viewports and invalid geometry never produce negative offsets', () => {
  assert.deepEqual(lyricPadding(40, 80, 100), { top: 0, bottom: 0 })
  assert.equal(centeredScroll({ scrollTop: NaN, viewportTop: 0, viewportHeight: 300, lineTop: 10, lineHeight: 50, maxScroll: 100 }), 0)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchTrackLyrics } from '../server/lyrics.mjs'

const track = { title: 'Explicit lyric fixture', artists: ['Fixture artist'], album: 'Fixture album', duration: 120 }
const record = { id: 42, trackName: track.title, artistName: track.artists[0], albumName: track.album, duration: 120, syncedLyrics: '[00:01.00]Explicit fixture cue', plainLyrics: null }

async function withFetch(handler, operation) {
  const original = globalThis.fetch
  globalThis.fetch = handler
  try { return await operation() }
  finally { globalThis.fetch = original }
}

test('lyrics retry a transient transport failure once without fabricating lyrics', async () => {
  let calls = 0
  await withFetch(async () => { calls += 1; if (calls === 1) throw new TypeError('Explicit transport fixture'); return Response.json(record) }, async () => {
    const result = await fetchTrackLyrics(track)
    assert.equal(calls, 2)
    assert.equal(result.syncedLyrics, record.syncedLyrics)
    assert.equal(result.sourceId, 42)
    assert.equal(result.matched, true)
  })
})

test('lyrics stop after the bounded retry and expose unavailable sources', async () => {
  let calls = 0
  await withFetch(async () => { calls += 1; throw new TypeError('Explicit failed transport fixture') }, async () => {
    await assert.rejects(fetchTrackLyrics(track), error => error.status === 502 && error.code === 'LYRICS_UNAVAILABLE')
    assert.equal(calls, 2)
  })
})

test('lyrics refuse another recording and return an honest empty match', async () => {
  let calls = 0
  await withFetch(async () => {
    calls += 1
    const mismatched = { ...record, artistName: 'Another fixture artist' }
    return Response.json(calls === 1 ? mismatched : [mismatched, { ...record, duration: 400 }])
  }, async () => {
    const result = await fetchTrackLyrics(track)
    assert.equal(result.matched, false)
    assert.equal(result.syncedLyrics, null)
    assert.equal(result.plainLyrics, null)
  })
})

test('exact identities tolerate punctuation and official-audio labels but not live versions', async () => {
  await withFetch(async () => Response.json({ ...record, trackName: 'EXPLICIT — LYRIC FIXTURE (Official Audio)', artistName: 'Fixture artist & Second artist' }), async () => {
    assert.equal((await fetchTrackLyrics(track)).matched, true)
  })
  let calls = 0
  await withFetch(async () => { calls += 1; return Response.json(calls === 1 ? record : [record]) }, async () => {
    const result = await fetchTrackLyrics({ ...track, title: `${track.title} (Live)` })
    assert.equal(result.matched, false)
    assert.equal(result.syncedLyrics, null)
  })
})

test('an exact synced match wins over plain lyrics from the same album', async () => {
  let calls = 0
  const textOnly = { ...record, id: 41, syncedLyrics: null, plainLyrics: 'Explicit plain fixture' }
  await withFetch(async () => { calls += 1; return Response.json(calls === 1 ? textOnly : [textOnly, { ...record, albumName: 'Another release of the same recording' }]) }, async () => {
    const result = await fetchTrackLyrics(track)
    assert.equal(result.sourceId, 42)
    assert.equal(result.syncedLyrics, record.syncedLyrics)
  })
})

test('trusted plain lyrics survive an unavailable synced-search fallback', async () => {
  let calls = 0
  await withFetch(async () => { calls += 1; if (calls > 1) throw new TypeError('Explicit search outage'); return Response.json({ ...record, syncedLyrics: null, plainLyrics: 'Explicit plain fixture' }) }, async () => {
    const result = await fetchTrackLyrics(track)
    assert.equal(result.plainLyrics, 'Explicit plain fixture')
    assert.equal(result.syncedLyrics, null)
    assert.equal(result.matched, true)
    assert.equal(calls, 3)
  })
})


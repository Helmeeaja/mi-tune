import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createApplication, selectDiscoveryTracks } from '../server/app.mjs'
import { createYoutubeService } from '../server/youtube.mjs'

const scratch = process.env.TMPDIR
assert.ok(scratch)
const first = { id: 'yt:aaaaaaaaaaa', title: 'Explicit chart fixture A', artist: 'Fixture A', artists: ['Fixture A'], duration: 180, source: 'youtube-music', type: 'song', musicType: 'MUSIC_VIDEO_TYPE_ATV', chartRank: 1, spotifyUri: 'spotify:track:aaaaaaaaaaaaaaaaaaaaaa', rankingSource: 'spotify' }
const second = { ...first, id: 'yt:bbbbbbbbbbb', title: 'Explicit chart fixture B', chartRank: 2 }
const third = { ...first, id: 'yt:ccccccccccc', title: 'Explicit chart fixture C', artist: 'Fixture B', artists: ['Fixture B'], chartRank: 3 }
const chart = () => ({ tracks: [first, second, third], region: 'ZZ', chartVersion: 3, chartOrigin: 'spotify', chartProvider: 'spotify', source: 'Explicit global fixture, not a live chart', chartId: '37i9dQZEVXbMDoHDwVN2tF', sourceUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF', sourceTotal: 3, updatedAt: Date.now(), stale: false })

test('global chart extraction resolves real song identities and preserves source rank', () => {
  const result = spawnSync(process.env.MUSIC_PYTHON || resolve('.venv/bin/python'), ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_music_charts.py'], { cwd: resolve('.'), encoding: 'utf8', timeout: 15000 })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('discovery diversifies artists without changing track identity or chart rank', () => {
  const result = selectDiscoveryTracks([first, second, first, third, { ...first, id: 'invalid' }])
  assert.deepEqual(result.map(item => item.id), [first.id, third.id, second.id])
  assert.equal(result[1].chartRank, 3)
  assert.deepEqual(selectDiscoveryTracks([]), [])
})

test('fresh local discovery is replaced with a global chart while search stays unrestricted', async () => {
  const directory = await mkdtemp(join(scratch, 'mi-tune-global-feed-'))
  const calls = []
  let app
  try {
    const db = new DatabaseSync(join(directory, 'mi-tune.sqlite'))
    db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
    db.prepare('INSERT INTO settings VALUES(?,?)').run('discovery', JSON.stringify({ tracks: [second], updatedAt: Date.now(), stale: false }))
    db.close()
    const music = { trending: async () => { calls.push('chart'); return chart() }, search: async query => { calls.push(query); return [second] }, lookup: () => null, close() {} }
    app = await createApplication({ dataDir: directory, musicService: music })
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${app.server.address().port}`
    const response = await fetch(base + '/api/discover')
    assert.equal(response.status, 200)
    const data = (await response.json()).data
    assert.equal(data.region, 'ZZ')
    assert.equal(data.feedVersion, 3)
    assert.deepEqual(data.tracks.map(item => item.id), [first.id, third.id, second.id])
    assert.deepEqual(calls, ['chart'])
    assert.equal((await fetch(base + '/api/search?q=lagu%20Indonesia')).status, 200)
    assert.equal(calls.at(-1), 'lagu Indonesia')
    const stored = new DatabaseSync(join(directory, 'mi-tune.sqlite'))
    const saved = JSON.parse(stored.prepare('SELECT value FROM settings WHERE key=?').get('discovery').value)
    stored.close()
    assert.equal(saved.region, 'ZZ')
    assert.equal(saved.feedVersion, 3)
  } finally { if (app) await app.close(); await rm(directory, { recursive: true, force: true }) }
})

test('global chart cache remains usable offline but a local chart never becomes the fallback', async () => {
  const globalDirectory = await mkdtemp(join(scratch, 'mi-tune-global-chart-'))
  const localDirectory = await mkdtemp(join(scratch, 'mi-tune-local-chart-'))
  let globalSource
  let localSource
  try {
    await writeFile(join(globalDirectory, 'trending.json'), JSON.stringify(chart()))
    await writeFile(join(localDirectory, 'trending.json'), JSON.stringify({ ...chart(), region: 'ID' }))
    globalSource = createYoutubeService({ dataDir: globalDirectory, pythonBinary: '/nonexistent-test-tool' })
    localSource = createYoutubeService({ dataDir: localDirectory, pythonBinary: '/nonexistent-test-tool' })
    assert.equal((await globalSource.trending()).region, 'ZZ')
    await assert.rejects(localSource.trending(), error => error.code === 'CHART_UNAVAILABLE')
  } finally { globalSource?.close(); localSource?.close(); await rm(globalDirectory, { recursive: true, force: true }); await rm(localDirectory, { recursive: true, force: true }) }
})

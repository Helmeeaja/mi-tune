import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createYoutubeService } from '../server/youtube.mjs'
import { createApplication } from '../server/app.mjs'

const dir = await mkdtemp(join(process.env.TMPDIR, 'mi-tune-live-chart-'))
const proof = join(process.env.TMPDIR, 'mi-tune-live-chart-http.json')
let application
try {
  const music = createYoutubeService({ dataDir: dir })
  application = await createApplication({ dataDir: dir, distDir: join(dir, 'dist'), musicService: music })
  await new Promise(resolve => application.server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${application.server.address().port}`
  const response = await fetch(base + '/api/trending', { signal: AbortSignal.timeout(65000) })
  assert.equal(response.status, 200)
  const chart = (await response.json()).data
  assert.ok(chart.tracks.length > 0)
  assert.equal(new Set(chart.tracks.map(track => track.id)).size, chart.tracks.length)
  assert.ok(chart.tracks.every(track => /^yt:[A-Za-z0-9_-]{11}$/.test(track.id) && track.type === 'song' && track.source === 'youtube-music' && track.musicType === 'MUSIC_VIDEO_TYPE_ATV' && track.artists.length && track.chartRank <= chart.sourceTotal))
  for (const track of chart.tracks) {
    const detail = await fetch(base + '/api/tracks/' + encodeURIComponent(track.id))
    assert.equal(detail.status, 200)
    assert.equal((await detail.json()).data.id, track.id)
  }
  const start = performance.now()
  const cached = await fetch(base + '/api/trending')
  assert.deepEqual((await cached.json()).data, chart)
  const cacheMs = performance.now() - start
  await application.close()
  application = null
  const restored = createYoutubeService({ dataDir: dir, pythonBinary: '/missing-tool-must-not-run' })
  const restarted = await restored.trending()
  assert.deepEqual(restarted, chart)
  restored.close()
  await writeFile(proof, JSON.stringify({ provider: 'live YouTube Music charts', verifiedAt: new Date().toISOString(), chart, cacheMs, registrationVerified: true, restartCacheVerified: true }, null, 2))
  console.log(JSON.stringify({ source: chart.source, chartId: chart.chartId, sourceTotal: chart.sourceTotal, playableAudioEntries: chart.tracks.length, cacheMs: Math.round(cacheMs), registrationVerified: true, restartCacheVerified: true, proof }))
} finally {
  await application?.close()
  await rm(dir, { recursive: true, force: true })
}

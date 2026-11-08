import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseLrc } from '../src/lib/lyrics.mjs'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const cookies = new Map()
async function call(path, method = 'GET', body) {
  const response = await fetch(base + '/api' + path, { method, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)) }
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return response.json().then(result => result.data)
}
await call('/auth/me')
const found = await call('/search?q=Code%20Monkey%20Jonathan%20Coulton')
assert.ok(found.tracks.length)
assert.ok(found.tracks.every(track => track.type === 'song' && track.musicType === 'MUSIC_VIDEO_TYPE_ATV'))
const track = found.tracks.find(track => track.title === 'Code Monkey' && track.artists[0] === 'Jonathan Coulton' && track.album === 'Thing a Week Three')
assert.ok(track, 'Actual original recording must be returned by YouTube Music')
let job = await call('/media/jobs', 'POST', { trackId: track.id, rightsConfirmed: true })
let previous
for (let attempt = 0; attempt < 360; attempt += 1) {
  if (job.status !== previous) { console.log(JSON.stringify({ stage: job.status, track: job.track.title, progress: job.progress })); previous = job.status }
  if (job.status === 'failed') throw new Error(job.error)
  if (job.status === 'ready') break
  await new Promise(resolve => setTimeout(resolve, 1000))
  job = await call(`/media/jobs/${job.id}`)
}
assert.equal(job.status, 'ready')
const lyrics = await call(`/tracks/${encodeURIComponent(track.id)}/lyrics`)
const cues = parseLrc(lyrics.syncedLyrics || '')
assert.ok(cues.length > 10, 'Actual synchronized lyrics must be available for the real recording')
const audio = await fetch(base + `/api/tracks/${encodeURIComponent(track.id)}/audio`)
assert.equal(audio.status, 200)
const audioBytes = await audio.arrayBuffer()
assert.equal(audioBytes.byteLength, job.track.fileSize)
const partial = await fetch(base + `/api/tracks/${encodeURIComponent(track.id)}/audio`, { headers: { Range: 'bytes=1000-1999' } })
assert.equal(partial.status, 206)
assert.equal((await partial.arrayBuffer()).byteLength, 1000)
const movie = await fetch(base + '/api/media/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify({ trackId: 'yt:aqz-KE-bpKQ', rightsConfirmed: true }) })
assert.equal(movie.status, 404)
const proof = { track: job.track, sourceSearchCount: found.tracks.length, allResultsAreSongs: true, mp3Bytes: audioBytes.byteLength, audioDuration: job.track.audioDuration, syncedLyricCues: cues.length, lyricSourceId: lyrics.sourceId, movieRejected: movie.status, artistRights: 'https://www.jonathancoulton.com/faq/' }
const root = join(process.env.TMPDIR, 'mi-tune-live-proof')
await mkdir(root, { recursive: true })
await writeFile(join(root, 'proof.json'), JSON.stringify(proof, null, 2))
console.log(JSON.stringify({ ...proof, proofPath: join(root, 'proof.json') }))

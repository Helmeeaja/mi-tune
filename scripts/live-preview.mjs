import { mkdtemp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { createYoutubeService } from '../server/youtube.mjs'
import { createArtistCatalog } from '../server/artist-catalog.mjs'
import { createPodcastService } from '../server/podcasts.mjs'

if (!process.env.TMPDIR) throw new Error('Configured scratch directory required')
const dataDir = process.env.MI_TUNE_LIVE_DATA_DIR || await mkdtemp(join(process.env.TMPDIR, 'mi-tune-live-verification-'))
let application
const musicService = createYoutubeService({ dataDir, onEvent: job => application?.notifyJob(job) })
const artistCatalog = createArtistCatalog({ dataDir })
const podcastService = createPodcastService({ dataDir })
application = await createApplication({ dataDir, distDir: process.env.MI_TUNE_TEST_DIST || resolve('dist'), musicService, artistCatalog, podcastService })
const port = Number(process.env.MI_TUNE_LIVE_PORT || 5175)
application.server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://127.0.0.1:${port}`, dataDir, liveSources: true })))
let closed = false
async function close() { if (closed) return; closed = true; await application.close() }
process.on('SIGINT', close)
process.on('SIGTERM', close)

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { createYoutubeService } from './youtube.mjs'
import { createArtistCatalog } from './artist-catalog.mjs'
import { createApplication } from './app.mjs'
import { createPodcastService } from './podcasts.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'))
let googleFile={}
if(process.env.GOOGLE_OAUTH_FILE){try{const parsed=JSON.parse(readFileSync(resolve(process.env.GOOGLE_OAUTH_FILE),'utf8'));googleFile=parsed.web||parsed}catch{throw new Error('File konfigurasi Google OAuth belum bisa dibaca. Periksa lokasi dan format JSON.')}}
const dataDir = process.env.MI_TUNE_DATA_DIR || resolve(root, 'data')
let application
const music = createYoutubeService({ dataDir, onEvent: job => application?.notifyJob(job) })
const artistCatalog = createArtistCatalog({ dataDir })
const podcastService = createPodcastService({ dataDir })
application = await createApplication({ dataDir, distDir: resolve(root, 'dist'), musicService: music, artistCatalog, podcastService, origin: process.env.APP_ORIGIN, googleOAuth:{clientId:process.env.GOOGLE_CLIENT_ID||googleFile.client_id||'',clientSecret:process.env.GOOGLE_CLIENT_SECRET||googleFile.client_secret||'',appOrigin:process.env.APP_ORIGIN||'http://127.0.0.1:5173'},refreshIntervalMs: Number(process.env.CATALOG_REFRESH_MS) || 300000 })
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT) || 5173
application.server.listen(port, host, () => console.log(`Mi Tune: http://${host}:${port}`))
let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  await application.close()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

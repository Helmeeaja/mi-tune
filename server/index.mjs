import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { createAudiusService } from './audius.mjs'
import { createApplication } from './app.mjs'
import { createPodcastService } from './podcasts.mjs'
import { restoreDatabase } from './persistence.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'))
let googleFile={}
if(process.env.GOOGLE_OAUTH_FILE){try{const parsed=JSON.parse(readFileSync(resolve(process.env.GOOGLE_OAUTH_FILE),'utf8'));googleFile=parsed.web||parsed}catch{throw new Error('File konfigurasi Google OAuth belum bisa dibaca. Periksa lokasi dan format JSON.')}}
const dataDir = process.env.MI_TUNE_DATA_DIR || resolve(root, 'data')
const vercelOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
const origin = (process.env.APP_ORIGIN || (vercelOrigin ? `https://${vercelOrigin}` : '')).replace(/\/$/, '')
await restoreDatabase(resolve(dataDir, 'mi-tune.sqlite'))
let application
const music = createAudiusService()
const artistCatalog = music.catalogue
const podcastService = createPodcastService({ dataDir })
application = await createApplication({ dataDir, distDir: resolve(root, 'dist'), musicService: music, artistCatalog, podcastService, origin: origin || undefined, googleOAuth:{clientId:process.env.GOOGLE_CLIENT_ID||googleFile.client_id||'',clientSecret:process.env.GOOGLE_CLIENT_SECRET||googleFile.client_secret||'',appOrigin:origin||'http://127.0.0.1:5173'},refreshIntervalMs: Number(process.env.CATALOG_REFRESH_MS) || 300000 })
const persistTimer = setInterval(() => { application.persist?.().catch(error => console.error('Mi Tune: Blob persist failed:', error.message)) }, 10000)
persistTimer.unref()
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT) || 5173
application.server.listen(port, host, () => console.log(`Mi Tune: http://${host}:${port}`))
let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(persistTimer)
  await application.close()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

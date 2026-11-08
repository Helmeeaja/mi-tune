import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const BLOB_PATH = 'mi-tune/mi-tune.sqlite'

export function blobPersistenceEnabled() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  )
}

function shouldRestore() {
  return blobPersistenceEnabled() && (process.env.VERCEL === '1' || process.env.MI_TUNE_BLOB_RESTORE === '1')
}

async function blobSdk() {
  return import('@vercel/blob')
}

export async function restoreDatabase(dbPath) {
  if (!shouldRestore()) return false
  try {
    const { list, get } = await blobSdk()
    const { blobs } = await list({ prefix: 'mi-tune/', limit: 100 })
    const candidates = blobs
      .filter(blob => blob.pathname === BLOB_PATH || blob.pathname.endsWith('/mi-tune.sqlite'))
      .sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime())
    if (!candidates.length) return false
    const latest = candidates[0]
    const result = await get(latest.url, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200 || !result.stream) return false
    const chunks = []
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk))
    if (!chunks.length) return false
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 })
    writeFileSync(dbPath, Buffer.concat(chunks), { mode: 0o600 })
    console.log(`Mi Tune: restored SQLite snapshot from Vercel Blob (${latest.pathname}).`)
    return true
  } catch (error) {
    console.error('Mi Tune: Vercel Blob restore failed:', error.message)
    return false
  }
}

export async function persistDatabase(dbPath) {
  if (!blobPersistenceEnabled()) return false
  const { put } = await blobSdk()
  const bytes = readFileSync(dbPath)
  await put(BLOB_PATH, bytes, {
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/vnd.sqlite3',
    cacheControlMaxAge: 60,
  })
  return true
}

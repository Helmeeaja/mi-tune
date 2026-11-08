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
    const { blobs, hasMore } = await list({ prefix: BLOB_PATH, limit: 100 })
    if (hasMore) throw new Error('Database snapshot listing requires an explicit review.')
    const candidates = blobs
      .filter(blob => blob.pathname === BLOB_PATH)
      .sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime())
    if (!candidates.length) return false
    const latest = candidates[0]
    const result = await get(latest.url, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Stored database snapshot could not be read.')
    const chunks = []
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk))
    if (!chunks.length) throw new Error('Stored database snapshot is empty.')
    const bytes = Buffer.concat(chunks)
    if (bytes.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') throw new Error('Stored database snapshot has an invalid format.')
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 })
    writeFileSync(dbPath, bytes, { mode: 0o600 })
    console.log(`Mi Tune: restored SQLite snapshot from Vercel Blob (${latest.pathname}).`)
    return true
  } catch (error) {
    console.error('Mi Tune: database restore failed; existing snapshot has not been overwritten.')
    throw new Error('Mi Tune could not restore its database. Check private Blob access before restarting.')
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

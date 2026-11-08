import { createHmac, timingSafeEqual } from 'node:crypto'

export function createMediaProof(secret, validateSong) {
  if (!secret) return { enabled: false, sign: () => null, verify: () => null }
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error('MI_TUNE_MEDIA_SIGNING_KEY must be a 32-byte base64url key.')
  const key = Buffer.from(secret, 'base64url')
  if (key.length !== 32 || key.toString('base64url') !== secret) throw new Error('MI_TUNE_MEDIA_SIGNING_KEY has an invalid format.')

  function signature(payload) {
    return createHmac('sha256', key).update(payload).digest()
  }

  function sign(song) {
    if (!validateSong(song)) return null
    const track = {
      id: song.id,
      source: song.source,
      type: song.type,
      musicType: song.musicType,
      catalogueType: song.catalogueType,
      title: song.title,
      artist: song.artist,
      artists: song.artists,
      artistRefs: song.artistRefs,
      album: song.album,
      albumId: song.albumId,
      duration: song.duration,
      thumbnail: song.thumbnail,
      coverUrl: `/api/tracks/${encodeURIComponent(song.id)}/cover`,
      sourceUrl: song.sourceUrl,
      downloadAllowed: song.downloadAllowed,
      genre: song.genre,
      publishedAt: song.publishedAt
    }
    const payload = Buffer.from(JSON.stringify({ version: 1, track })).toString('base64url')
    if (payload.length > 8000) return null
    return `${payload}.${signature(payload).toString('base64url')}`
  }

  function verify(token, expectedId) {
    if (typeof token !== 'string' || token.length > 8100) return null
    const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token)
    if (!match) return null
    const received = Buffer.from(match[2], 'base64url')
    if (received.toString('base64url') !== match[2]) return null
    const expected = signature(match[1])
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
    try {
      const bytes = Buffer.from(match[1], 'base64url')
      if (bytes.toString('base64url') !== match[1]) return null
      const value = JSON.parse(bytes.toString('utf8'))
      if (value.version !== 1 || value.track?.id !== expectedId || !validateSong(value.track)) return null
      return value.track
    } catch {
      return null
    }
  }

  return { enabled: true, sign, verify }
}

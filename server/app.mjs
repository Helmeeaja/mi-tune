import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync, chmodSync, statSync, existsSync, createReadStream } from 'node:fs'
import { join, resolve, extname, sep } from 'node:path'
import { resolveRange } from './range.mjs'
import { fetchTrackLyrics } from './lyrics.mjs'
import { validatePlaylistCover, COVER_BODY_LIMIT } from './playlist-cover.mjs'
import { migratePlaylistCovers } from './migrations/001-playlist-cover.mjs'
import { migrateUserProfiles } from './migrations/002-user-profile.mjs'
import { migrateArtistFollows } from './migrations/003-artist-follows.mjs'
import { migrateSharingVisibility } from './migrations/004-sharing-visibility.mjs'
import { createSharingService, visibility } from './sharing.mjs'
import { migrateGoogleIdentity } from './migrations/005-google-identity.mjs'
import { createGoogleAuth } from './google-auth.mjs'
import { publicProfile, privateProfile, validateProfilePatch, PROFILE_BODY_LIMIT } from './profile.mjs'

const derive = promisify(scrypt)
const SESSION_SECONDS = 60 * 60 * 24 * 14
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

function fail(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

function publicUser(row) { return publicProfile(row) }
function digest(token) { return createHash('sha256').update(token).digest('hex') }
function validTrack(track) { return track && /^yt:[A-Za-z0-9_-]{11}$/.test(track.id) && track.source === 'youtube-music' && track.type === 'song' && (track.musicType === 'MUSIC_VIDEO_TYPE_ATV' || (track.musicType === 'MUSIC_VIDEO_TYPE_OMV' && track.catalogueType === 'album-track' && /^MPRE[A-Za-z0-9_-]{4,124}$/.test(track.albumId || ''))) && Array.isArray(track.artists) && track.artists.length > 0 }

export function selectDiscoveryTracks(tracks) {
  const ids = new Set()
  const artists = new Set()
  const first = []
  const rest = []
  for (const track of tracks) {
    if (!validTrack(track) || ids.has(track.id)) continue
    ids.add(track.id)
    const artist = track.artistRefs?.[0]?.id || track.artists[0].normalize('NFKC').toLocaleLowerCase('en')
    if (artists.has(artist)) rest.push(track)
    else { artists.add(artist); first.push(track) }
  }
  return [...first, ...rest].slice(0, 20)
}

function checkedArtistId(id) {
  if (typeof id !== 'string' || !/^UC[A-Za-z0-9_-]{22}$/.test(id)) throw fail(400, 'INVALID_ARTIST', 'Identitas artis tidak valid.')
  return id
}

function checkedAlbumId(id) {
  if (typeof id !== 'string' || !/^MPRE[A-Za-z0-9_-]{4,124}$/.test(id)) throw fail(400, 'INVALID_ALBUM', 'Identitas album tidak valid.')
  return id
}

function artistSummary(value) {
  if (!value || !/^UC[A-Za-z0-9_-]{22}$/.test(value.id) || typeof value.name !== 'string' || !value.name.trim()) throw fail(502, 'INVALID_ARTIST_RESPONSE', 'Data artis dari sumber belum dapat divalidasi.')
  return { id: value.id, name: value.name, thumbnail: typeof value.thumbnail === 'string' ? value.thumbnail : '', coverUrl: `/api/artists/${encodeURIComponent(value.id)}/cover`, source: 'youtube-music' }
}

function albumSummary(value) {
  if (!value || !/^MPRE[A-Za-z0-9_-]{4,124}$/.test(value.id) || typeof value.title !== 'string' || !value.title.trim()) throw fail(502, 'INVALID_ALBUM_RESPONSE', 'Data album dari sumber belum dapat divalidasi.')
  return { id: value.id, title: value.title, year: value.year, type: value.type, thumbnail: typeof value.thumbnail === 'string' ? value.thumbnail : '', coverUrl: `/api/albums/${encodeURIComponent(value.id)}/cover`, artists: Array.isArray(value.artists) ? value.artists : [] }
}

async function body(req, maximum = 32768) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON_REQUIRED', 'Gunakan data JSON.')
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (Buffer.byteLength(text) > maximum) throw fail(413, 'BODY_TOO_LARGE', 'Data terlalu besar.')
  }
  try {
    const result = JSON.parse(text)
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error()
    return result
  } catch { throw fail(400, 'INVALID_JSON', 'Data JSON tidak valid.') }
}

export async function createApplication(options) {
  const { musicService: music, artistCatalog: catalogue, podcastService: podcasts, dataDir, distDir, origin, lyricsFetcher = fetchTrackLyrics, refreshIntervalMs = 300000 } = options
  if (!music || !dataDir) throw new Error('Sumber musik dan direktori data diperlukan.')
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  chmodSync(dataDir, 0o700)
  const dbPath = join(dataDir, 'mi-tune.sqlite')
  const db = new DatabaseSync(dbPath)
  chmodSync(dbPath, 0o600)
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE NOT NULL,display_name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tracks(id TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playlists(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,track_ids TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS favorites(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,track_id TEXT NOT NULL REFERENCES tracks(id),PRIMARY KEY(user_id,track_id));
    CREATE TABLE IF NOT EXISTS friend_requests(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),receiver_id TEXT NOT NULL REFERENCES users(id),UNIQUE(sender_id,receiver_id));
    CREATE TABLE IF NOT EXISTS friendships(a TEXT NOT NULL REFERENCES users(id),b TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(a,b));
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lyrics(track_id TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL);`)
  migratePlaylistCovers(db)
  migrateUserProfiles(db)
  migrateArtistFollows(db)
  migrateSharingVisibility(db)
  const sharing=createSharingService(db)
  migrateGoogleIdentity(db)
  const google=createGoogleAuth({db,...options.googleOAuth})
  const peers = new Set()
  const jobOwners = new Map()
  const limits = new Map()
  const images = new Map()
  const lyricRequests = new Map()
  let refreshPromise
  let server
  const dummySalt = randomBytes(16).toString('hex')
  const dummyHash = await derive(randomBytes(24).toString('hex'), dummySalt, 64)

  function send(res, data, status = 200) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ data }))
  }

  function cookie(res, name, value, seconds) {
    const secure = origin?.startsWith('https://') ? '; Secure' : ''
    const valueString = `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure}`
    const current = res.getHeader('Set-Cookie') || []
    res.setHeader('Set-Cookie', [...(Array.isArray(current) ? current : [current]), valueString])
  }

  function identity(req, res) {
    const cookies = {}
    for (const pair of (req.headers.cookie || '').split(';')) {
      const index = pair.indexOf('=')
      if (index > 0) cookies[pair.slice(0, index).trim()] = pair.slice(index + 1).trim()
    }
    let guest = cookies.mt_guest
    if (!/^[A-Za-z0-9_-]{43}$/.test(guest || '')) { guest = randomBytes(32).toString('base64url'); cookie(res, 'mt_guest', guest, SESSION_SECONDS) }
    const token = /^[A-Za-z0-9_-]{43}$/.test(cookies.mt_session || '') ? cookies.mt_session : null
    const user = token ? db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(digest(token), Date.now()) : null
    return { user, token, guestKey: `g:${guest}`, key: user ? `u:${user.id}` : `g:${guest}` }
  }

  function requireUser(who) {
    if (!who.user) throw fail(401, 'LOGIN_REQUIRED', 'Masuk ke akun Mi Tune untuk fitur ini.')
    return who.user
  }

  function rate(req, kind, maximum) {
    const key = `${req.socket.remoteAddress}:${kind}`
    const now = Date.now()
    let entry = limits.get(key)
    if (!entry || now - entry.at >= 60000) { entry = { at: now, count: 0 }; limits.set(key, entry) }
    entry.count += 1
    if (entry.count > maximum) throw fail(429, 'RATE_LIMITED', 'Terlalu banyak permintaan. Tunggu sebentar.')
    if (limits.size > 2000) for (const [id, value] of limits) if (now - value.at > 60000) limits.delete(id)
  }

  function emit(name, value, owners = null) {
    const target = owners ? new Set(owners) : null
    const packet = `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`
    for (const peer of peers) if (!target || [...peer.keys].some(key => target.has(key))) peer.res.write(packet)
  }

  function recordTracks(tracks) {
    music.register?.(tracks)
    const insert = db.prepare('INSERT INTO tracks(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
    for (const track of tracks) if (validTrack(track)) insert.run(track.id, JSON.stringify(track))
  }

  function recordArtist(value) {
    const summary = artistSummary(value)
    db.prepare('INSERT INTO artists(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').run(summary.id, JSON.stringify(summary), Date.now())
    return summary
  }

  function followedArtists(userId) {
    return db.prepare('SELECT artists.data,artist_follows.followed_at FROM artist_follows JOIN artists ON artists.id=artist_follows.artist_id WHERE artist_follows.user_id=? ORDER BY artist_follows.followed_at DESC,artist_follows.artist_id').all(userId).map(row => ({ ...JSON.parse(row.data), followedAt: row.followed_at }))
  }

  function followsArtist(userId, id) {
    return Boolean(userId && db.prepare('SELECT 1 FROM artist_follows WHERE user_id=? AND artist_id=?').get(userId, id))
  }

  async function combinedSearch(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 160 || /https?:\/\/|www\./i.test(query)) throw fail(400, 'INVALID_SEARCH', 'Cari judul lagu atau artis, bukan URL video. Gunakan 2–160 karakter.')
    query = query.trim()
    const results = await Promise.allSettled([music.search(query), catalogue?.search ? catalogue.search(query) : catalogue?.searchArtists ? catalogue.searchArtists(query) : Promise.reject(fail(503, 'CATALOGUE_UNAVAILABLE', 'Katalog artis dan album belum tersedia.'))])
    if (results.every(value => value.status === 'rejected')) throw results[0].reason
    const tracks = results[0].status === 'fulfilled' ? results[0].value.filter(validTrack).slice(0, 20) : []
    const found = results[1].status === 'fulfilled' ? results[1].value : { artists: [], albums: [] }
    const warnings = Array.isArray(found.warnings) ? [...found.warnings] : []
    if (results[0].status === 'rejected') warnings.push({ code: 'SONG_SEARCH_UNAVAILABLE', message: 'Daftar lagu belum dapat dimuat. Profil artis dan album yang tersedia tetap bisa dijelajahi.' })
    if (results[1].status === 'rejected') warnings.push({ code: 'CATALOGUE_SEARCH_UNAVAILABLE', message: 'Profil artis dan album belum dapat dimuat. Lagu yang tersedia tetap bisa diputar.' })
    if (found.stale) warnings.push({ code: 'CATALOGUE_STALE', message: 'Menampilkan hasil katalog tersimpan.' })
    recordTracks(tracks)
    const artists = new Map()
    for (const value of found.artists || []) {
      try { const summary = artistSummary(value); if (!artists.has(summary.id)) artists.set(summary.id, summary) } catch { }
    }
    const inferred = new Set()
    for (const song of tracks.slice(0, 3)) for (const value of song.artistRefs || []) {
      if (!/^UC[A-Za-z0-9_-]{22}$/.test(value.id || '')) continue
      inferred.add(value.id)
      if (!artists.has(value.id)) artists.set(value.id, artistSummary({ ...value, thumbnail: '' }))
    }
    const term = query.normalize('NFKC').toLocaleLowerCase('en')
    const rank = value => value.name.normalize('NFKC').toLocaleLowerCase('en') === term ? 100 : value.name.toLocaleLowerCase('en').includes(term) ? 80 : inferred.has(value.id) ? 60 : 20
    const ranked = [...artists.values()].sort((left, right) => rank(right) - rank(left))
    const relevant = ranked.filter(value => rank(value) >= 60)
    const selected = (relevant.length ? relevant : ranked.slice(0, 2)).slice(0, 4)
    const profiles = await Promise.all(selected.map(async value => {
      if (value.thumbnail || !catalogue?.summary) return value
      try { return artistSummary(await catalogue.summary(value.id)) } catch { return value }
    }))
    const albums = new Map()
    for (const value of found.albums || []) {
      try { const summary = albumSummary(value); if (!albums.has(summary.id)) albums.set(summary.id, summary) } catch { }
    }
    for (const song of tracks.slice(0, 3)) if (song.albumId && song.album && !albums.has(song.albumId)) {
      try { albums.set(song.albumId, albumSummary({ id: song.albumId, title: song.album, thumbnail: song.thumbnail, artists: song.artistRefs, type: 'Release' })) } catch { }
    }
    const preferredAlbums = new Set(tracks.slice(0, 3).map(track => track.albumId).filter(Boolean))
    const albumRank = value => preferredAlbums.has(value.id) ? 100 : value.title.toLocaleLowerCase('en').includes(term) ? 80 : value.artists.some(artist => inferred.has(artist.id)) ? 60 : 20
    const rankedAlbums = [...albums.values()].sort((left, right) => albumRank(right) - albumRank(left))
    const relevantAlbums = rankedAlbums.filter(value => albumRank(value) >= 60)
    return { tracks, artists: profiles, albums: (relevantAlbums.length ? relevantAlbums : rankedAlbums.slice(0, 2)).slice(0, 6), warnings }
  }

  function requireCatalogue() {
    if (!catalogue) throw fail(503, 'CATALOGUE_UNAVAILABLE', 'Katalog artis dan album belum tersedia.')
    return catalogue
  }

  async function artistProfile(id) {
    const profile = await requireCatalogue().artist(checkedArtistId(id))
    if (profile.id !== id || profile.source !== 'youtube-music') throw fail(502, 'INVALID_ARTIST_RESPONSE', 'Identitas artis dari sumber tidak sesuai.')
    const value = { ...profile, ...recordArtist(profile), tracks: (profile.tracks || []).filter(validTrack), albums: (profile.albums || []).map(albumSummary), singles: (profile.singles || []).map(albumSummary), related: (profile.related || []).map(artistSummary) }
    music.register?.(value.tracks)
    recordTracks(value.tracks)
    return value
  }

  async function albumProfile(id) {
    const profile = await requireCatalogue().album(checkedAlbumId(id))
    if (profile.id !== id || profile.source !== 'youtube-music') throw fail(502, 'INVALID_ALBUM_RESPONSE', 'Identitas album dari sumber tidak sesuai.')
    const value = { ...profile, ...albumSummary(profile), tracks: (profile.tracks || []).filter(validTrack) }
    music.register?.(value.tracks)
    recordTracks(value.tracks)
    return value
  }

  function track(id) {
    if (!/^yt:[A-Za-z0-9_-]{11}$/.test(id)) throw fail(400, 'INVALID_TRACK', 'Identitas lagu tidak valid.')
    const current = music.lookup(id)
    const stored = db.prepare('SELECT data FROM tracks WHERE id=?').get(id)
    const result = current || (stored ? JSON.parse(stored.data) : null)
    if (!validTrack(result)) throw fail(404, 'SONG_NOT_FOUND', 'Lagu belum ditemukan di katalog YouTube Music.')
    return result
  }

  function library(userId) {
    const playlists = db.prepare('SELECT * FROM playlists WHERE owner_id=? ORDER BY created_at DESC').all(userId).map(row => ({ id: row.id, name: row.name, trackIds: JSON.parse(row.track_ids), createdAt: row.created_at, cover: row.cover ?? null,visibility:row.visibility==='public'?'public':'private' }))
    const favoriteIds = db.prepare('SELECT track_id FROM favorites WHERE user_id=? ORDER BY rowid DESC').all(userId).map(row => row.track_id)
    const ids = new Set([...favoriteIds, ...playlists.flatMap(item => item.trackIds)])
    const tracks = [...ids].flatMap(id => {
      const saved = db.prepare('SELECT data FROM tracks WHERE id=?').get(id)
      return saved ? [JSON.parse(saved.data)] : []
    })
    return { playlists, favoriteIds, tracks }
  }

  function ownedPlaylist(id, userId) {
    const row = db.prepare('SELECT * FROM playlists WHERE id=? AND owner_id=?').get(id, userId)
    if (!row) throw fail(404, 'PLAYLIST_NOT_FOUND', 'Playlist tidak ditemukan.')
    return row
  }

  function name(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) throw fail(400, 'INVALID_NAME', 'Nama playlist harus sepanjang 1–60 karakter.')
    return value.trim()
  }

  async function refreshDiscovery() {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      if (typeof music.trending !== 'function') throw fail(503, 'GLOBAL_CHART_UNAVAILABLE', 'Chart musik global belum tersedia.')
      const chart = await music.trending()
      if (chart.region !== 'ZZ' || chart.chartVersion !== 3 || chart.chartOrigin !== 'spotify' || chart.chartId !== '37i9dQZEVXbMDoHDwVN2tF') throw fail(503, 'INVALID_DISCOVERY_REGION', 'Daftar Spotify global belum tersedia.')
      const tracks = selectDiscoveryTracks(chart.tracks)
      recordTracks(tracks)
      const value = { ...chart, tracks, region: 'ZZ', chartCountry: 'ZZ', feedVersion: 3, stale: Boolean(chart.stale) }
      db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('discovery', JSON.stringify(value))
      emit('catalogue', { updatedAt: value.updatedAt, count: tracks.length })
      return value
    })().finally(() => { refreshPromise = null })
    return refreshPromise
  }

  function friendshipKey(a, b) { return [a, b].sort() }

  function friends(userId) {
    const rows = db.prepare('SELECT users.* FROM friendships JOIN users ON users.id=CASE WHEN friendships.a=? THEN friendships.b ELSE friendships.a END WHERE friendships.a=? OR friendships.b=? ORDER BY users.username').all(userId, userId, userId)
    const incoming = db.prepare('SELECT friend_requests.id AS request_id,users.* FROM friend_requests JOIN users ON users.id=friend_requests.sender_id WHERE receiver_id=?').all(userId).map(row => ({ id: row.request_id, user: publicUser(row) }))
    const outgoing = db.prepare('SELECT friend_requests.id AS request_id,users.* FROM friend_requests JOIN users ON users.id=friend_requests.receiver_id WHERE sender_id=?').all(userId).map(row => ({ id: row.request_id, user: publicUser(row) }))
    return { friends: rows.map(publicUser), incoming, outgoing }
  }

  async function cover(song, res) {
    if (!song.thumbnail) throw fail(404, 'COVER_MISSING', 'Cover tidak tersedia.')
    const cached = images.get(song.id)
    if (cached && Date.now() - cached.at < 3600000) {
      res.setHeader('Content-Type', cached.mime)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.end(cached.bytes)
    }
    let url = new URL(song.thumbnail)
    if (['lh3.googleusercontent.com', 'yt3.googleusercontent.com'].includes(url.hostname)) url.pathname = url.pathname.replace(/=w\d+-h\d+(?=-|$)/, '=w600-h600')
    let response
    for (let attempts = 0; attempts < 3; attempts += 1) {
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !['lh3.googleusercontent.com', 'yt3.googleusercontent.com', 'i.ytimg.com'].includes(url.hostname)) throw fail(400, 'INVALID_COVER', 'Alamat cover tidak diizinkan.')
      try { response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) }) }
      catch { throw fail(502, 'COVER_UNAVAILABLE', 'Cover tidak dapat dimuat.') }
      if ([301, 302, 303, 307, 308].includes(response.status)) { url = new URL(response.headers.get('location'), url); continue }
      break
    }
    if (!response?.ok || !/^image\/(jpeg|png|webp|avif)/.test(response.headers.get('content-type') || '')) throw fail(502, 'COVER_UNAVAILABLE', 'Cover tidak dapat dimuat.')
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > 4194304) { await response.body.cancel().catch(() => {}); throw fail(413, 'COVER_TOO_LARGE', 'Cover terlalu besar.') }
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    const mime = response.headers.get('content-type')
    images.set(song.id, { at: Date.now(), mime, bytes })
    if (images.size > 40) images.delete(images.keys().next().value)
    res.setHeader('Content-Type', mime)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.end(bytes)
  }

  function audio(id, req, res) {
    const file = music.audio(id)
    if (!file) throw fail(409, 'AUDIO_NOT_READY', 'Siapkan audio lagu terlebih dahulu.')
    let range
    try { range = resolveRange(req.headers.range, file.size) }
    catch {
      res.writeHead(416, { 'Content-Range': `bytes */${file.size}` })
      return res.end()
    }
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (range) { res.statusCode = 206; res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`); res.setHeader('Content-Length', range.end - range.start + 1) }
    else res.setHeader('Content-Length', file.size)
    if (req.method === 'HEAD') return res.end()
    const stream = createReadStream(file.path, range || {})
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  }

  function staticFile(pathname, req, res) {
    if (!distDir) throw fail(404, 'NOT_FOUND', 'Halaman tidak ditemukan.')
    let path = resolve(distDir, `.${pathname}`)
    const root = resolve(distDir)
    if (path !== root && !path.startsWith(`${root}${sep}`)) throw fail(403, 'FORBIDDEN_PATH', 'Alamat tidak diizinkan.')
    if (!existsSync(path) || !statSync(path).isFile()) {
      if (extname(pathname)) throw fail(404, 'NOT_FOUND', 'File tidak ditemukan.')
      path = join(root, 'index.html')
    }
    if (!existsSync(path)) throw fail(503, 'BUILD_REQUIRED', 'Build frontend Mi Tune belum tersedia.')
    res.setHeader('Content-Type', mimeTypes[extname(path)] || 'application/octet-stream')
    res.setHeader('Cache-Control', pathname === '/sw.js' || extname(path) === '.html' ? 'no-cache' : 'public, max-age=86400')
    res.setHeader('Content-Length', statSync(path).size)
    if (req.method === 'HEAD') return res.end()
    const stream = createReadStream(path)
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  }

  server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'")
    try {
      const url = new URL(req.url, 'http://localhost')
      let pathname
      try { pathname = decodeURIComponent(url.pathname) } catch { throw fail(400, 'INVALID_URL', 'Alamat tidak valid.') }
      if (pathname.includes('\0') || pathname.split('/').includes('..')) throw fail(403, 'FORBIDDEN_PATH', 'Alamat tidak diizinkan.')
      const method = req.method
      if (pathname === '/api/health' && method === 'GET') return send(res, { status: 'ok', source: 'youtube-music', songsOnly: true, podcastsAvailable: Boolean(podcasts) })
      if (!pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(method)) throw fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.')
        return staticFile(pathname, req, res)
      }
      if (!['GET', 'HEAD'].includes(method)) {
        const allowed = [origin, `http://localhost:${req.socket.localPort}`, `http://127.0.0.1:${req.socket.localPort}`, 'http://localhost:5174', 'http://127.0.0.1:5174'].filter(Boolean)
        if ((req.headers.origin && !allowed.includes(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'INVALID_ORIGIN', 'Permintaan lintas situs tidak diizinkan.')
      }
      const who = identity(req, res)
      if(pathname==='/api/auth/google/config'&&method==='GET')return send(res,{enabled:google.enabled,startUrl:google.startUrl,redirectUri:google.redirectUri})
      if(pathname==='/api/auth/google'&&method==='GET'){
        rate(req,'google-auth',12)
        const linking=url.searchParams.get('link')==='1'
        const owner=linking?requireUser(who):null
        return google.begin(res,{next:url.searchParams.get('next'),owner:owner?.id,sessionHash:owner?digest(who.token):null})
      }
      if(pathname==='/api/auth/google/callback'&&method==='GET'){
        try{
          const signed=await google.complete(req,res,url)
          const token=randomBytes(32).toString('base64url')
          db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now())
          db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token),signed.user.id,Date.now()+SESSION_SECONDS*1000)
          cookie(res,'mt_session',token,SESSION_SECONDS)
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Mi Tune</title><script src="/auth-google-complete.js" defer></script></head><body data-status="success"><p>Sudah masuk. Jendela ini bisa ditutup.</p></body></html>')
        }catch{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Mi Tune</title><script src="/auth-google-complete.js" defer></script></head><body data-status="failed"><p>Login belum berhasil. Coba lagi dari Mi Tune.</p></body></html>')}
      }
      if (pathname === '/api/auth/me' && method === 'GET') return send(res, { user: privateProfile(who.user) })
      if (pathname === '/api/auth/register' && method === 'POST') {
        rate(req, 'auth', 12)
        const value = await body(req)
        if (typeof value.username !== 'string' || !/^[A-Za-z0-9_]{3,24}$/.test(value.username) || typeof value.password !== 'string' || value.password.length < 8 || value.password.length > 128) throw fail(400, 'INVALID_ACCOUNT', 'Username 3–24 huruf/angka/underscore dan password minimal 8 karakter diperlukan.')
        const displayName = typeof value.displayName === 'string' && value.displayName.trim() ? value.displayName.trim() : value.username
        if (displayName.length > 60) throw fail(400, 'INVALID_ACCOUNT', 'Nama tampilan maksimal 60 karakter.')
        const salt = randomBytes(16).toString('hex')
        const hash = (await derive(value.password, salt, 64)).toString('hex')
        const user = { id: randomUUID(), username: value.username, display_name: displayName, joined_at: Date.now() }
        try { db.prepare('INSERT INTO users(id,username,display_name,salt,password_hash,joined_at) VALUES(?,?,?,?,?,?)').run(user.id, user.username, displayName, salt, hash, user.joined_at) }
        catch (error) { if (error.message.includes('UNIQUE')) throw fail(409, 'USERNAME_TAKEN', 'Username sudah digunakan.'); throw error }
        return send(res, publicUser(user), 201)
      }
      if (pathname === '/api/auth/login' && method === 'POST') {
        rate(req, 'auth', 12)
        const value = await body(req)
        if (typeof value.username !== 'string' || typeof value.password !== 'string' || value.password.length > 128) throw fail(400, 'INVALID_ACCOUNT', 'Masukkan username dan password.')
        const user = db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(value.username)
        const actual = await derive(value.password, user?.salt || dummySalt, 64)
        const expected = user ? Buffer.from(user.password_hash, 'hex') : dummyHash
        if (!timingSafeEqual(actual, expected) || !user) throw fail(401, 'INVALID_CREDENTIALS', 'Username atau password tidak cocok.')
        const token = randomBytes(32).toString('base64url')
        db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now())
        db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token), user.id, Date.now() + SESSION_SECONDS * 1000)
        cookie(res, 'mt_session', token, SESSION_SECONDS)
        return send(res, { user: privateProfile(user) })
      }
      if (pathname === '/api/auth/logout' && method === 'POST') {
        if (who.token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(who.token))
        for (const peer of peers) if (who.token && peer.sessionHash === digest(who.token)) peer.res.end()
        cookie(res, 'mt_session', '', 0)
        return send(res, { loggedOut: true })
      }
      if (pathname === '/api/profile' && ['GET', 'PATCH'].includes(method)) {
        const user = requireUser(who)
        if (method === 'GET') return send(res, { user: privateProfile(user) })
        rate(req, 'profile', 20)
        const value = validateProfilePatch(await body(req, PROFILE_BODY_LIMIT))
        const next = { displayName: user.display_name, username: user.username, bio: user.bio, avatar: user.avatar, email: user.email,likesVisibility:user.likes_visibility || 'private', ...value }
        try { db.prepare('UPDATE users SET display_name=?,username=?,bio=?,avatar=?,email=?,likes_visibility=? WHERE id=?').run(next.displayName, next.username, next.bio, next.avatar, next.email,next.likesVisibility, user.id) }
        catch (error) { if (error.message.includes('UNIQUE')) throw fail(409, 'USERNAME_TAKEN', 'Username ini sudah dipakai. Coba yang lain.'); throw error }
        const saved = db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
        const contacts = db.prepare('SELECT a,b FROM friendships WHERE a=? OR b=?').all(user.id, user.id).flatMap(row => [row.a, row.b])
        const pending = db.prepare('SELECT sender_id,receiver_id FROM friend_requests WHERE sender_id=? OR receiver_id=?').all(user.id, user.id).flatMap(row => [row.sender_id, row.receiver_id])
        emit('profile', { changed: true }, [who.key])
        emit('friends', { changed: true }, [...new Set([user.id, ...contacts, ...pending])].map(id => `u:${id}`))
        return send(res, { user: privateProfile(saved) })
      }
      if (pathname === '/api/auth/password' && method === 'POST') {
        const user = requireUser(who)
        rate(req, 'password', 6)
        const value = await body(req)
        if (typeof value.currentPassword !== 'string' || value.currentPassword.length > 128 || typeof value.newPassword !== 'string' || value.newPassword.length < 8 || value.newPassword.length > 128) throw fail(400, 'INVALID_PASSWORD', 'Password baru perlu 8–128 karakter.')
        const actual = await derive(value.currentPassword, user.salt, 64)
        if (!timingSafeEqual(actual, Buffer.from(user.password_hash, 'hex'))) throw fail(403, 'WRONG_PASSWORD', 'Password sekarang belum cocok.')
        const salt = randomBytes(16).toString('hex')
        const hash = (await derive(value.newPassword, salt, 64)).toString('hex')
        db.exec('BEGIN')
        try {
          const updated = db.prepare('UPDATE users SET salt=?,password_hash=? WHERE id=? AND password_hash=?').run(salt, hash, user.id, user.password_hash)
          if (!updated.changes) throw fail(409, 'PASSWORD_CHANGED', 'Password baru saja berubah. Coba lagi.')
          db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id, digest(who.token))
          db.exec('COMMIT')
        } catch (error) { db.exec('ROLLBACK'); throw error }
        for (const peer of peers) if (peer.keys.has(who.key) && peer.sessionHash !== digest(who.token)) peer.res.end()
        return send(res, { changed: true })
      }
      if (pathname === '/api/events' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
        res.write(': connected\n\n')
        const peer = { res, keys: new Set([who.key, who.guestKey]), sessionHash: who.token ? digest(who.token) : null }
        peers.add(peer)
        const timer = setInterval(() => res.write(': keep-alive\n\n'), 15000)
        req.on('close', () => { clearInterval(timer); peers.delete(peer) })
        return
      }
      if (pathname.startsWith('/api/podcasts/')) {
        if (!podcasts) throw fail(503, 'PODCASTS_UNAVAILABLE', 'Podcast belum bisa dimuat. Coba lagi nanti.')
        if (pathname === '/api/podcasts/discover' && method === 'GET') { rate(req, 'podcast-discovery', 30); return send(res, await podcasts.discover({ refresh: url.searchParams.get('refresh') === '1' })) }
        if (pathname === '/api/podcasts/search' && method === 'GET') { rate(req, 'podcast-search', 30); return send(res, await podcasts.search(url.searchParams.get('q'))) }
        const creator = /^\/api\/podcasts\/creators\/(UC[A-Za-z0-9_-]{22})(?:\/(cover))?$/.exec(pathname)
        if (creator && ['GET', 'HEAD'].includes(method)) {
          if (creator[2] === 'cover') return await cover({ ...(podcasts.lookupCreator?.(creator[1]) || await podcasts.creator(creator[1])), id: `podcast:creator:${creator[1]}` }, res)
          rate(req, 'podcast-creator', 60)
          return send(res, { creator: await podcasts.creator(creator[1], { refresh: url.searchParams.get('refresh') === '1' }) })
        }
        const episode = /^\/api\/podcasts\/episodes\/(podcast:yt:[A-Za-z0-9_-]{11})(?:\/(cover|stream|transcript))?$/.exec(pathname)
        if (episode && ['GET', 'HEAD'].includes(method)) {
          if (episode[2] === 'stream') { rate(req, 'podcast-stream', 60); return await podcasts.stream(req, res, episode[1]) }
          if (episode[2] === 'transcript') { rate(req,'podcast-transcript',30); return send(res,await podcasts.transcript(episode[1],{language:url.searchParams.get('language') || 'id',refresh:url.searchParams.get('refresh') === '1'})) }
          if (episode[2] === 'cover') return await cover(podcasts.lookupEpisode?.(episode[1]) || await podcasts.episode(episode[1]), res)
          rate(req, 'podcast-episode', 60)
          return send(res, { episode: await podcasts.episode(episode[1], { refresh: url.searchParams.get('refresh') === '1' }) })
        }
        throw fail(404, 'PODCAST_NOT_FOUND', 'Alamat podcast ini tidak valid.')
      }
      if (pathname === '/api/artists' && method === 'GET') {
        rate(req, 'artist-search', 30)
        const query = url.searchParams.get('q')
        if (typeof query !== 'string' || query.trim().length < 2 || query.length > 160 || /https?:\/\/|www\./i.test(query)) throw fail(400, 'INVALID_SEARCH', 'Cari nama artis sepanjang 2–160 karakter, bukan URL.')
        const result = await requireCatalogue().searchArtists(query)
        return send(res, { artists: result.artists.map(artistSummary) })
      }
      if (pathname === '/api/followed-artists' && method === 'GET') {
        const user = requireUser(who)
        res.setHeader('Cache-Control', 'private, no-store')
        return send(res, { artists: followedArtists(user.id) })
      }
      const artistRoute = /^\/api\/artists\/([^/]+)(?:\/(follow|cover))?$/.exec(pathname)
      if (artistRoute) {
        const id = checkedArtistId(artistRoute[1])
        if (artistRoute[2] === 'follow' && ['PUT', 'DELETE'].includes(method)) {
          const user = requireUser(who)
          rate(req, 'artist-follow', 30)
          res.setHeader('Cache-Control', 'private, no-store')
          let summary
          if (method === 'PUT') {
            const value = await body(req, 1024)
            if (Object.keys(value).length) throw fail(400, 'INVALID_FOLLOW', 'Follow menggunakan artis di alamat dan akun yang sedang masuk.')
            summary = artistSummary(await artistProfile(id))
            db.prepare('INSERT INTO artist_follows(user_id,artist_id,followed_at) VALUES(?,?,?) ON CONFLICT(user_id,artist_id) DO NOTHING').run(user.id, id, Date.now())
          } else {
            const stored = db.prepare('SELECT data FROM artists WHERE id=?').get(id)
            summary = stored ? JSON.parse(stored.data) : null
            db.prepare('DELETE FROM artist_follows WHERE user_id=? AND artist_id=?').run(user.id, id)
          }
          const following = followsArtist(user.id, id)
          emit('artist-follow', { artistId: id, following }, [who.key])
          emit('artists', { artistId: id, following }, [who.key])
          return send(res, { artist: summary, following })
        }
        if (!artistRoute[2] && method === 'GET') {
          rate(req, 'artist-profile', 60)
          res.setHeader('Cache-Control', 'private, no-store')
          return send(res, { artist: await artistProfile(id), following: followsArtist(who.user?.id, id) })
        }
        if (artistRoute[2] === 'cover' && ['GET', 'HEAD'].includes(method)) return await cover(catalogue?.summary ? artistSummary(await catalogue.summary(id)) : await artistProfile(id), res)
        throw fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.')
      }
      const albumRoute = /^\/api\/albums\/([^/]+)(?:\/(cover))?$/.exec(pathname)
      if (albumRoute) {
        const id = checkedAlbumId(albumRoute[1])
        if (albumRoute[2] === 'cover' && ['GET', 'HEAD'].includes(method)) return await cover(await albumProfile(id), res)
        if (!albumRoute[2] && method === 'GET') {
          rate(req, 'album-profile', 60)
          return send(res, { album: await albumProfile(id) })
        }
        throw fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.')
      }
      if (pathname === '/api/discover' && method === 'GET') {
        const saved = db.prepare('SELECT value FROM settings WHERE key=?').get('discovery')
        if (!saved) return send(res, await refreshDiscovery())
        let value
        try { value = JSON.parse(saved.value) } catch { return send(res, await refreshDiscovery()) }
        if (value.feedVersion !== 3 || value.region !== 'ZZ' || value.chartVersion !== 3 || value.chartOrigin !== 'spotify' || value.chartId !== '37i9dQZEVXbMDoHDwVN2tF' || value.sourceUrl !== 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF' || !Array.isArray(value.tracks) || !value.tracks.every(item => validTrack(item) && /^spotify:track:[A-Za-z0-9]{22}$/.test(item.spotifyUri || ''))) return send(res, await refreshDiscovery())
        if (Date.now() - value.updatedAt > refreshIntervalMs) {
          refreshDiscovery().catch(() => {})
          return send(res, { ...value, stale: true })
        }
        return send(res, value)
      }
      if (pathname === '/api/discover/refresh' && method === 'POST') { rate(req, 'refresh', 6); return send(res, await refreshDiscovery()) }
      if (pathname === '/api/trending' && method === 'GET') {
        if (typeof music.trending !== 'function') throw fail(503, 'CHART_UNAVAILABLE', 'Chart musik belum tersedia.')
        const chart = await music.trending()
        recordTracks(chart.tracks)
        return send(res, chart)
      }
      if (pathname === '/api/search/discovery' && method === 'GET') { rate(req, 'search', 30); return send(res, await combinedSearch(url.searchParams.get('q'))) }
      if (pathname === '/api/search' && method === 'GET') { rate(req, 'search', 30); const tracks = await music.search(url.searchParams.get('q')); recordTracks(tracks); return send(res, { tracks }) }
      const songRoute = /^\/api\/tracks\/(yt:[A-Za-z0-9_-]{11})(?:\/(cover|audio|stream|download|lyrics))?$/.exec(pathname)
      if (songRoute && ['GET', 'HEAD'].includes(method)) {
        const song = track(songRoute[1])
        if (songRoute[2] === 'cover') return await cover(song, res)
        if (songRoute[2] === 'audio') return audio(song.id, req, res)
        if (songRoute[2] === 'stream') {
          rate(req, 'stream', 60)
          if (music.audio(song.id)) return audio(song.id, req, res)
          if (typeof music.stream === 'function') {
            try { if (await music.stream(song.id, req, res)) return }
            catch (error) {
              if (res.headersSent || res.destroyed || req.aborted) return res.destroy()
              if ((error.status && error.status < 500) || /^(?:UNSAFE_|INVALID_|UNSUPPORTED_|NOT_MUSIC|DURATION_MISMATCH)/.test(error.code || '')) throw error
            }
          }
          let job = await music.prepare(song.id)
          const start = Date.now()
          while (!['ready', 'failed'].includes(job.status) && !res.destroyed && Date.now() - start < 245000) {
            await new Promise(resolve => setTimeout(resolve, 400))
            job = music.job(job.id) || job
          }
          if (res.destroyed) return
          if (job.status !== 'ready') throw fail(502, 'AUDIO_NOT_READY', 'Lagu ini belum bisa diputar. Coba lagi sebentar.')
          return audio(song.id, req, res)
        }
        if (songRoute[2] === 'download') {
          requireUser(who)
          res.setHeader('Cache-Control', 'private, no-store')
          res.setHeader('Content-Disposition', `attachment; filename="mi-tune-${song.id.slice(3)}.mp3"`)
          return audio(song.id, req, res)
        }
        if (songRoute[2] === 'lyrics') {
          const cached = db.prepare('SELECT value,updated_at FROM lyrics WHERE track_id=?').get(song.id)
          const stored = cached ? JSON.parse(cached.value) : null
          if (url.searchParams.get('refresh') !== '1' && stored?.matchingVersion === 2 && Date.now() - cached.updated_at < (stored.matched ? 86400000 : 120000)) return send(res, stored)
          rate(req, 'lyrics', 30)
          if (!lyricRequests.has(song.id)) {
            const pending = (async () => {
              const fetched = await lyricsFetcher(song)
              const valid = !fetched.trackId || fetched.trackId === song.id
              const result = { ...(valid ? fetched : { matched: false, syncedLyrics: null, plainLyrics: null, instrumental: false, source: '' }), trackId: song.id, matchingVersion: 2 }
              db.prepare('INSERT INTO lyrics(track_id,value,updated_at) VALUES(?,?,?) ON CONFLICT(track_id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(song.id, JSON.stringify(result), Date.now())
              return result
            })().finally(() => lyricRequests.delete(song.id))
            lyricRequests.set(song.id, pending)
          }
          return send(res, await lyricRequests.get(song.id))
        }
        return send(res, song)
      }
      if (pathname === '/api/media/jobs' && method === 'POST') {
        rate(req, 'prepare', 12)
        const value = await body(req)
        const purpose = value.purpose === undefined && value.rightsConfirmed === true ? 'download' : value.purpose
        if (!['playback', 'download'].includes(purpose)) throw fail(400, 'INVALID_MEDIA_PURPOSE', 'Pilih pemutaran atau unduhan lagu.')
        if (purpose === 'download') requireUser(who)
        if (purpose === 'download' && value.rightsConfirmed !== true) throw fail(400, 'RIGHTS_CONFIRMATION_REQUIRED', 'Konfirmasikan izin mengunduh audio ini.')
        track(value.trackId)
        const job = await music.prepare(value.trackId)
        let owners = jobOwners.get(job.id)
        if (!owners) { owners = new Set(); jobOwners.set(job.id, owners) }
        owners.add(who.key)
        emit('job', job, owners)
        return send(res, job, job.status === 'ready' ? 200 : 202)
      }
      const jobRoute = /^\/api\/media\/jobs\/([a-f0-9-]{36})$/.exec(pathname)
      if (pathname === '/api/media/preload' && method === 'POST') {
        rate(req, 'preload', 30)
        const value = await body(req)
        const song = track(value.trackId)
        if (typeof music.preload === 'function') return send(res, await music.preload(song.id))
        return send(res, { ready: Boolean(music.audio(song.id)) })
      }
      if (jobRoute && method === 'GET') {
        const owners = jobOwners.get(jobRoute[1])
        const job = music.job(jobRoute[1])
        if (!job || !owners || (!owners.has(who.key) && !owners.has(who.guestKey))) throw fail(404, 'JOB_NOT_FOUND', 'Antrean audio tidak ditemukan.')
        return send(res, job)
      }
      const playlistArtwork=/^\/api\/playlists\/([a-f0-9-]{36})\/cover$/.exec(pathname)
      if(playlistArtwork&&['GET','HEAD'].includes(method)){
        const row=db.prepare('SELECT owner_id,visibility,cover FROM playlists WHERE id=?').get(playlistArtwork[1])
        if(!row||!row.cover||(row.visibility!=='public'&&row.owner_id!==who.user?.id))throw fail(404,'COVER_NOT_FOUND','Sampul playlist tidak ditemukan.')
        const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(row.cover)
        if(!match)throw fail(404,'COVER_NOT_FOUND','Sampul playlist tidak ditemukan.')
        const bytes=Buffer.from(match[2],'base64')
        res.writeHead(200,{'Content-Type':match[1],'Content-Length':bytes.length,'Cache-Control':'no-store'})
        return res.end(method==='HEAD'?undefined:bytes)
      }
      if (pathname === '/api/public/playlists/search' && method === 'GET') { rate(req,'public-playlist-search',30);return send(res,sharing.search(url.searchParams.get('q'))) }
      const publicPlaylist=/^\/api\/public\/playlists\/([a-f0-9-]{36})$/.exec(pathname)
      if(publicPlaylist && method==='GET'){rate(req,'public-playlist',60);return send(res,sharing.playlist(publicPlaylist[1]))}
      const visibleProfile=/^\/api\/public\/profiles\/([A-Za-z0-9_]{3,24})$/.exec(pathname)
      if(visibleProfile && method==='GET'){rate(req,'public-profile',60);return send(res,sharing.profile(visibleProfile[1]))}
      if (pathname === '/api/library' && method === 'GET') return send(res, library(requireUser(who).id))
      if (pathname === '/api/playlists' && method === 'POST') {
        const user = requireUser(who)
        const value = await body(req, COVER_BODY_LIMIT)
        const playlist = { id: randomUUID(), name: name(value.name), trackIds: [], createdAt: Date.now(), cover: Object.hasOwn(value, 'cover') ? validatePlaylistCover(value.cover) : null,visibility:Object.hasOwn(value,'visibility')?visibility(value.visibility):'private' }
        db.prepare('INSERT INTO playlists(id,owner_id,name,created_at,cover,visibility) VALUES(?,?,?,?,?,?)').run(playlist.id, user.id, playlist.name, playlist.createdAt, playlist.cover,playlist.visibility)
        emit('library', { changed: true }, [who.key])
        return send(res, playlist, 201)
      }
      const playlistRoute = /^\/api\/playlists\/([a-f0-9-]{36})(?:\/(tracks))?$/.exec(pathname)
      if (playlistRoute) {
        const user = requireUser(who)
        const playlist = ownedPlaylist(playlistRoute[1], user.id)
        if (method === 'DELETE' && !playlistRoute[2]) db.prepare('DELETE FROM playlists WHERE id=? AND owner_id=?').run(playlist.id, user.id)
        else if (method === 'PATCH' && !playlistRoute[2]) {
          const value = await body(req, COVER_BODY_LIMIT)
          if ((!Object.hasOwn(value, 'name') && !Object.hasOwn(value, 'cover') && !Object.hasOwn(value,'visibility')) || Object.keys(value).some(key => !['name', 'cover','visibility'].includes(key))) throw fail(400, 'INVALID_PLAYLIST', 'Isi nama, sampul, atau privasi playlist yang akan diperbarui.')
          const nextName = Object.hasOwn(value, 'name') ? name(value.name) : playlist.name
          const nextCover = Object.hasOwn(value, 'cover') ? validatePlaylistCover(value.cover) : playlist.cover
          const nextVisibility=Object.hasOwn(value,'visibility')?visibility(value.visibility):playlist.visibility
          db.prepare('UPDATE playlists SET name=?,cover=?,visibility=? WHERE id=? AND owner_id=?').run(nextName, nextCover,nextVisibility, playlist.id, user.id)
        }
        else if (method === 'PUT' && playlistRoute[2] === 'tracks') {
          const value = await body(req)
          if (!Array.isArray(value.trackIds) || value.trackIds.length > 200 || !value.trackIds.every(id => typeof id === 'string')) throw fail(400, 'INVALID_PLAYLIST', 'Playlist maksimal 200 lagu.')
          const ids = [...new Set(value.trackIds)]
          const songs = ids.map(track)
          recordTracks(songs)
          db.prepare('UPDATE playlists SET track_ids=? WHERE id=? AND owner_id=?').run(JSON.stringify(ids), playlist.id, user.id)
        } else throw fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.')
        emit('library', { changed: true }, [who.key])
        return send(res, { saved: true })
      }
      const favoriteRoute = /^\/api\/favorites\/(yt:[A-Za-z0-9_-]{11})$/.exec(pathname)
      if (favoriteRoute && method === 'PUT') {
        const user = requireUser(who)
        const value = await body(req)
        if (typeof value.liked !== 'boolean') throw fail(400, 'INVALID_FAVORITE', 'Nilai favorit harus benar atau salah.')
        const song = track(favoriteRoute[1])
        recordTracks([song])
        if (value.liked) db.prepare('INSERT OR IGNORE INTO favorites(user_id,track_id) VALUES(?,?)').run(user.id, song.id)
        else db.prepare('DELETE FROM favorites WHERE user_id=? AND track_id=?').run(user.id, song.id)
        emit('library', { changed: true }, [who.key])
        return send(res, { liked: value.liked })
      }
      if (pathname === '/api/users' && method === 'GET') {
        const user = requireUser(who)
        rate(req, 'users', 30)
        const query = url.searchParams.get('q') || ''
        if (query.length < 2 || query.length > 60) throw fail(400, 'INVALID_SEARCH', 'Cari username atau nama sepanjang 2–60 karakter.')
        const escaped = query.replace(/[\\%_]/g, character => `\\${character}`)
        const rows = db.prepare("SELECT * FROM users WHERE id<>? AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') ORDER BY username LIMIT 10").all(user.id, `%${escaped}%`, `%${escaped}%`)
        return send(res, rows.map(publicUser))
      }
      if (pathname === '/api/friends' && method === 'GET') return send(res, friends(requireUser(who).id))
      if (pathname === '/api/friend-requests' && method === 'POST') {
        const user = requireUser(who)
        rate(req, 'friends', 20)
        const value = await body(req)
        if (typeof value.userId !== 'string' || value.userId === user.id || !db.prepare('SELECT id FROM users WHERE id=?').get(value.userId)) throw fail(400, 'INVALID_FRIEND', 'Pengguna tujuan tidak valid.')
        const [a, b] = friendshipKey(user.id, value.userId)
        if (db.prepare('SELECT a FROM friendships WHERE a=? AND b=?').get(a, b)) throw fail(409, 'ALREADY_FRIENDS', 'Kalian sudah berteman.')
        if (db.prepare('SELECT id FROM friend_requests WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)').get(user.id, value.userId, value.userId, user.id)) throw fail(409, 'REQUEST_EXISTS', 'Permintaan pertemanan sudah ada.')
        const id = randomUUID()
        db.prepare('INSERT INTO friend_requests(id,sender_id,receiver_id) VALUES(?,?,?)').run(id, user.id, value.userId)
        emit('friends', { changed: true }, [`u:${user.id}`, `u:${value.userId}`])
        return send(res, { id }, 201)
      }
      const requestRoute = /^\/api\/friend-requests\/([a-f0-9-]{36})$/.exec(pathname)
      if (requestRoute && method === 'DELETE') {
        const user = requireUser(who)
        const pending = db.prepare('SELECT * FROM friend_requests WHERE id=? AND sender_id=?').get(requestRoute[1], user.id)
        if (!pending) throw fail(404, 'REQUEST_NOT_FOUND', 'Permintaan ini sudah tidak ada.')
        db.prepare('DELETE FROM friend_requests WHERE id=? AND sender_id=?').run(pending.id, user.id)
        emit('friends', { changed: true }, [`u:${user.id}`, `u:${pending.receiver_id}`])
        return send(res, { cancelled: true })
      }
      if (requestRoute && method === 'PATCH') {
        const user = requireUser(who)
        const value = await body(req)
        const pending = db.prepare('SELECT * FROM friend_requests WHERE id=? AND receiver_id=?').get(requestRoute[1], user.id)
        if (!pending) throw fail(404, 'REQUEST_NOT_FOUND', 'Permintaan pertemanan tidak ditemukan.')
        if (!['accept', 'reject'].includes(value.action)) throw fail(400, 'INVALID_ACTION', 'Aksi tidak valid.')
        db.exec('BEGIN')
        try {
          if (value.action === 'accept') { const [a, b] = friendshipKey(pending.sender_id, user.id); db.prepare('INSERT OR IGNORE INTO friendships(a,b) VALUES(?,?)').run(a, b) }
          db.prepare('DELETE FROM friend_requests WHERE id=?').run(pending.id)
          db.exec('COMMIT')
        } catch (error) { db.exec('ROLLBACK'); throw error }
        emit('friends', { changed: true }, [`u:${user.id}`, `u:${pending.sender_id}`])
        return send(res, { accepted: value.action === 'accept' })
      }
      const friendRoute = /^\/api\/friends\/([a-f0-9-]{36})$/.exec(pathname)
      if (friendRoute && method === 'DELETE') {
        const user = requireUser(who)
        const [a, b] = friendshipKey(user.id, friendRoute[1])
        const result = db.prepare('DELETE FROM friendships WHERE a=? AND b=?').run(a, b)
        if (!result.changes) throw fail(404, 'FRIEND_NOT_FOUND', 'Teman tidak ditemukan.')
        emit('friends', { changed: true }, [`u:${user.id}`, `u:${friendRoute[1]}`])
        return send(res, { removed: true })
      }
      throw fail(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.')
    } catch (error) {
      if (res.headersSent) return res.destroy()
      const status = Number.isInteger(error.status) ? error.status : 500
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: { code: error.code || 'INTERNAL_ERROR', message: status === 500 ? 'Server tidak dapat menyelesaikan permintaan.' : error.message } }))
      if (status === 500) console.error('Mi Tune request error:', error.message)
    }
  })
  server.requestTimeout = 60000
  server.headersTimeout = 15000
  const refreshTimer = setInterval(() => { if (peers.size) refreshDiscovery().catch(() => {}) }, refreshIntervalMs)
  refreshTimer.unref()

  function notifyJob(job) {
    const owners = jobOwners.get(job.id)
    if (owners) emit('job', job, owners)
    if (job.status === 'ready' && validTrack(job.track)) recordTracks([job.track])
  }

  async function close() {
    clearInterval(refreshTimer)
    for (const peer of peers) peer.res.end()
    peers.clear()
    music.close?.()
    catalogue?.close?.()
    podcasts?.close?.()
    if (server.listening) await new Promise(resolve => server.close(resolve))
    db.close()
  }

  return { server, notifyJob, refreshDiscovery, close }
}

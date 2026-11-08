import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeSong } from './youtube.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

function image(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['lh3.googleusercontent.com', 'yt3.googleusercontent.com', 'i.ytimg.com'].includes(url.hostname) ? url.href : ''
  } catch { return '' }
}

function artistSummary(value) {
  if (!value || !/^UC[A-Za-z0-9_-]{22}$/.test(value.id || '') || typeof value.name !== 'string' || !value.name.trim()) return null
  return { id: value.id, name: value.name.trim(), thumbnail: image(value.thumbnail), coverUrl: `/api/artists/${encodeURIComponent(value.id)}/cover`, source: 'youtube-music' }
}

function albumSummary(value) {
  if (!value || !/^MPRE[A-Za-z0-9_-]{4,124}$/.test(value.id || '') || typeof value.title !== 'string' || !value.title.trim()) return null
  const artists = (value.artists || []).filter(artist => /^UC[A-Za-z0-9_-]{22}$/.test(artist?.id || '') && typeof artist.name === 'string').map(artist => ({ id: artist.id, name: artist.name }))
  return { id: value.id, title: value.title.trim(), thumbnail: image(value.thumbnail), coverUrl: `/api/albums/${encodeURIComponent(value.id)}/cover`, year: value.year, type: typeof value.type === 'string' ? value.type : 'Release', artists }
}

function unique(values) {
  return [...new Map(values.filter(Boolean).map(value => [value.id, value])).values()]
}

export function normalizeCatalogue(mode, raw) {
  if (mode === 'search') return { artists: unique((raw.artists || []).map(artistSummary)), albums: unique((raw.albums || []).map(albumSummary)), warnings: Array.isArray(raw.warnings) ? raw.warnings : [] }
  if (mode === 'summary') {
    const value = artistSummary(raw)
    if (!value) throw fail(502, 'INVALID_ARTIST_RESPONSE', 'Identitas artis dari sumber tidak sesuai.')
    return value
  }
  if (mode === 'artist') {
    const summary = artistSummary(raw)
    if (!summary) throw fail(502, 'INVALID_ARTIST_RESPONSE', 'Identitas artis dari sumber tidak sesuai.')
    return { ...summary, description: typeof raw.description === 'string' ? raw.description : '', tracks: unique((raw.tracks || []).filter(track => track.available !== false).map(track => normalizeSong(track, { catalogueType: track.catalogueType }))), albums: unique((raw.albums || []).map(albumSummary)), singles: unique((raw.singles || []).map(albumSummary)), related: unique((raw.related || []).map(artistSummary)), warnings: Array.isArray(raw.warnings) ? raw.warnings : [], albumsComplete: raw.albumsComplete !== false }
  }
  const summary = albumSummary(raw)
  if (!summary) throw fail(502, 'INVALID_ALBUM_RESPONSE', 'Identitas album dari sumber tidak sesuai.')
  const tracklist = (raw.tracks || []).map((track, index) => {
    const value = track.available === false ? null : normalizeSong({ ...track, albumId: summary.id, album: summary.title }, { catalogueType: 'album-track' })
    return value ? { ...value, position: index + 1, playable: true } : { position: index + 1, title: typeof track.title === 'string' ? track.title : '', artist: (track.artists || []).filter(name => typeof name === 'string').join(', '), duration: Number.isFinite(track.duration) ? track.duration : null, playable: false }
  })
  return { ...summary, description: typeof raw.description === 'string' ? raw.description : '', tracklist, tracks: tracklist.filter(track => track.playable), sourceTotal: tracklist.length, source: 'youtube-music' }
}

export function createArtistCatalog({ dataDir = join(project, 'data'), pythonBinary = process.env.MUSIC_PYTHON || join(project, '.venv/bin/python'), timeoutMs = 90000, maxConcurrent = 2 } = {}) {
  const cacheDir = join(dataDir, 'catalogue')
  mkdirSync(cacheDir, { recursive: true, mode: 0o700 })
  const memory = new Map()
  const pending = new Map()
  const children = new Set()
  const queue = []
  let active = 0
  let closed = false

  function file(key) { return join(cacheDir, createHash('sha256').update(key).digest('hex') + '.json') }
  function saved(key) {
    if (memory.has(key)) return memory.get(key)
    try {
      const value = JSON.parse(readFileSync(file(key), 'utf8'))
      if (value.version !== 1 || !Number.isFinite(value.updatedAt) || !value.data || typeof value.data !== 'object') return null
      memory.set(key, value)
      if (memory.size > 80) memory.delete(memory.keys().next().value)
      return value
    } catch { return null }
  }
  function persist(key, data) {
    const value = { version: 1, updatedAt: Date.now(), data }
    const target = file(key)
    try { writeFileSync(target + '.tmp', JSON.stringify(value), { mode: 0o600 }); renameSync(target + '.tmp', target) } catch { }
    memory.set(key, value)
    if (memory.size > 80) memory.delete(memory.keys().next().value)
    return value
  }
  function drain() {
    while (!closed && active < maxConcurrent && queue.length) {
      const task = queue.shift()
      active += 1
      task.run().then(task.resolve, task.reject).finally(() => { active -= 1; drain() })
    }
  }
  function run(mode, identity) {
    return new Promise((resolve, reject) => {
      if (closed) return reject(fail(503, 'SHUTTING_DOWN', 'Server sedang berhenti.'))
      const child = spawn(pythonBinary, [join(project, 'server/music_catalog.py'), mode, identity], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
      children.add(child)
      let stdout = ''
      let expired = false
      const timer = setTimeout(() => { expired = true; child.kill('SIGTERM') }, timeoutMs)
      child.stdout.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > 8388608) { expired = true; child.kill('SIGTERM') } })
      child.stderr.on('data', () => {})
      child.once('error', () => { clearTimeout(timer); children.delete(child); reject(fail(503, 'CATALOGUE_TOOL_MISSING', 'Komponen katalog musik belum dapat dijalankan.')) })
      child.once('close', code => {
        clearTimeout(timer)
        children.delete(child)
        if (expired) return reject(fail(504, 'CATALOGUE_TIMEOUT', 'Katalog musik terlalu lama merespons. Coba lagi.'))
        if (code !== 0) return reject(fail(503, 'CATALOGUE_UNAVAILABLE', 'Katalog artis dan album tidak tersedia saat ini. Coba lagi nanti.'))
        try { resolve(JSON.parse(stdout)) } catch { reject(fail(502, 'INVALID_CATALOGUE_RESPONSE', 'Respons katalog musik tidak valid.')) }
      })
    })
  }
  function fetchValue(mode, identity) {
    if (closed) return Promise.reject(fail(503, 'SHUTTING_DOWN', 'Server sedang berhenti.'))
    if (mode === 'search') {
      if (typeof identity !== 'string' || identity.trim().length < 2 || identity.length > 160 || /https?:\/\/|www\./i.test(identity)) return Promise.reject(fail(400, 'INVALID_SEARCH', 'Cari judul lagu atau artis, bukan URL video. Gunakan 2–160 karakter.'))
      identity = identity.trim()
    } else if (!(mode === 'album' ? /^MPRE[A-Za-z0-9_-]{4,124}$/ : /^UC[A-Za-z0-9_-]{22}$/).test(identity || '')) return Promise.reject(fail(400, mode === 'album' ? 'INVALID_ALBUM' : 'INVALID_ARTIST', mode === 'album' ? 'Identitas album tidak valid.' : 'Identitas artis tidak valid.'))
    const key = mode + ':' + identity
    const old = saved(key)
    const ttl = mode === 'search' ? 300000 : 21600000
    if (old && Date.now() - old.updatedAt < ttl) return Promise.resolve({ ...old.data, updatedAt: old.updatedAt, stale: false })
    if (pending.has(key)) return pending.get(key)
    if (queue.length >= 30) return Promise.reject(fail(429, 'CATALOGUE_BUSY', 'Katalog musik sedang sibuk. Coba lagi sebentar.'))
    const promise = new Promise((resolve, reject) => { queue.push({ run: () => run(mode, identity), resolve, reject }); drain() }).then(raw => {
      const value = normalizeCatalogue(mode, raw)
      if (mode !== 'search' && value.id !== identity) throw fail(502, 'INVALID_CATALOGUE_RESPONSE', 'Identitas katalog dari sumber tidak sesuai.')
      const stored = persist(key, value)
      if (mode === 'artist') persist('summary:' + identity, artistSummary(value))
      return { ...value, updatedAt: stored.updatedAt, stale: false }
    }).catch(error => {
      if (old) return { ...old.data, updatedAt: old.updatedAt, stale: true }
      throw error
    }).finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
  }
  return {
    search: query => fetchValue('search', query),
    searchArtists: async query => { const value = await fetchValue('search', query); return { artists: value.artists, warnings: value.warnings, stale: value.stale } },
    summary: identity => fetchValue('summary', identity),
    artist: identity => fetchValue('artist', identity),
    album: identity => fetchValue('album', identity),
    close() { closed = true; for (const child of children) child.kill('SIGTERM'); for (const task of queue.splice(0)) task.reject(fail(503, 'SHUTTING_DOWN', 'Server sedang berhenti.')) },
  }
}

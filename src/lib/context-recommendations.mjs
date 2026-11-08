export function selectContextTracks(value, offset = 0) {
  const tracks = Array.isArray(value) ? value : value?.tracks
  const seen = new Set()
  const artists = new Set()
  const first = []
  const rest = []
  for (const track of tracks || []) {
    if (!/^yt:[A-Za-z0-9_-]{11}$/.test(track?.id) || typeof track.title !== 'string' || typeof track.artist !== 'string' || seen.has(track.id)) continue
    seen.add(track.id)
    const artist = track.artistRefs?.[0]?.id || track.artist.toLocaleLowerCase('en')
    if (artists.has(artist)) rest.push(track)
    else { artists.add(artist); first.push(track) }
  }
  const available = [...first, ...rest].slice(0, 20)
  if (!available.length) return []
  const start = Math.abs(Math.trunc(Number(offset) || 0)) % available.length
  return [...available.slice(start), ...available.slice(0, start)]
}

export function readContextCache(key, storage) {
  try {
    const value = JSON.parse(storage.getItem(`mi-tune-atmosphere-tracks:${key}`))
    if (value?.key !== key || !Array.isArray(value.mixes) || !Number.isFinite(value.updatedAt)) return null
    const mixes = value.mixes.filter(mix => typeof mix.query === 'string').slice(0, 3).map(mix => ({ query: mix.query, tracks: selectContextTracks(mix.tracks) })).filter(mix => mix.tracks.length)
    return mixes.length ? { key, mixes, updatedAt: value.updatedAt, stale: true } : null
  } catch { return null }
}

export function saveContextCache(value, storage) {
  try { storage.setItem(`mi-tune-atmosphere-tracks:${value.key}`, JSON.stringify({ key: value.key, mixes: value.mixes, updatedAt: value.updatedAt })); return true } catch { return false }
}

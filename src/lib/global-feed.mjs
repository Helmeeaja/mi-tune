export function isGlobalFeed(value) {
  if (!value || value.region !== 'ZZ' || !Array.isArray(value.tracks)) return false
  if (value.chartOrigin === 'audius') return value.chartVersion === 4 && value.chartProvider === 'audius' && value.chartId === 'audius:trending:week' && value.sourceUrl === 'https://audius.co/explore' && value.tracks.length > 0 && value.tracks.every(track => /^audius:[A-Za-z0-9]{1,64}$/.test(track.id || '') && track.type === 'song' && track.source === 'audius' && track.musicType === 'FULL_TRACK')
  return value.chartVersion === 3 && value.chartOrigin === 'spotify' && value.chartProvider === 'spotify' && value.chartId === '37i9dQZEVXbMDoHDwVN2tF' && value.sourceUrl === 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF' && value.tracks.every(track => /^yt:[A-Za-z0-9_-]{11}$/.test(track.id || '') && track.type === 'song' && track.source === 'youtube-music' && track.musicType === 'MUSIC_VIDEO_TYPE_ATV' && /^spotify:track:[A-Za-z0-9]{22}$/.test(track.spotifyUri || '') && track.rankingSource === 'spotify')
}

export function readGlobalFeed(key, fallback, storage) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    if (isGlobalFeed(value)) return value
    storage.removeItem?.(key)
    return fallback
  } catch { return fallback }
}

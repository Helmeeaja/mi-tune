export function isGlobalFeed(value) {
  return Boolean(value && value.region === 'ZZ' && value.chartVersion === 3 && value.chartOrigin === 'spotify' && value.chartProvider === 'spotify' && value.chartId === '37i9dQZEVXbMDoHDwVN2tF' && value.sourceUrl === 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF' && Array.isArray(value.tracks) && value.tracks.every(track => /^yt:[A-Za-z0-9_-]{11}$/.test(track.id || '') && track.type === 'song' && track.source === 'youtube-music' && track.musicType === 'MUSIC_VIDEO_TYPE_ATV' && /^spotify:track:[A-Za-z0-9]{22}$/.test(track.spotifyUri || '') && track.rankingSource === 'spotify'))
}

export function readGlobalFeed(key, fallback, storage) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    if (isGlobalFeed(value)) return value
    storage.removeItem?.(key)
    return fallback
  } catch { return fallback }
}


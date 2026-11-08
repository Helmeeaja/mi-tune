import { isGlobalFeed } from './global-feed.mjs'
import { rotateItems } from './recommendation-rotation.mjs'

export function isTrendingFeed(feed) {
  return isGlobalFeed(feed) && Number.isFinite(feed.updatedAt) && feed.updatedAt > 0
}

export function readTrendingFeed(key, fallback, storage) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return isTrendingFeed(value) ? { ...value, stale: true } : fallback
  } catch { return fallback }
}

export function isSpotifyFeed(feed) {
  return feed?.chartOrigin === 'spotify' && isTrendingFeed(feed)
}

export function readSpotifyFeed(key, fallback, storage) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return isSpotifyFeed(value) ? { ...value, stale: true } : fallback
  } catch { return fallback }
}

export function chooseTrendingRecommendations(feed, seed = 0, recent = []) {
  if (!isTrendingFeed(feed)) return { tracks: [], mixes: [] }
  const tracks = rotateItems(feed.tracks, seed, recent, track => String(track.artists?.[0] || track.artist || track.id).normalize('NFKC').toLowerCase())
  const first = tracks.slice(0, 8)
  const second = tracks.slice(8, 16)
  return { tracks: tracks.slice(0, 16), mixes: [
    ...(first.length ? [{ id: 'trending-picks', title: 'Lagi banyak didengar', tracks: first }] : []),
    ...(second.length ? [{ id: 'trending-discover', title: 'Coba yang ini juga', tracks: second }] : [])
  ] }
}

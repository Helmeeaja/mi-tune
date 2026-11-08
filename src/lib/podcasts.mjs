const episodeId = /^podcast:yt:[A-Za-z0-9_-]{11}$/
const progressKey = 'mi-tune-podcast-progress'

export function isPodcastEpisode(item) {
  return Boolean(item && item.type === 'episode' && episodeId.test(item.id || ''))
}

export function mediaPath(item, offline = false) {
  if (isPodcastEpisode(item)) return `/api/podcasts/episodes/${encodeURIComponent(item.id)}/stream`
  if (!/^yt:[A-Za-z0-9_-]{11}$/.test(item?.id || '')) throw new Error('Audio tidak valid.')
  return `/api/tracks/${encodeURIComponent(item.id)}/${offline ? 'audio' : 'stream'}`
}

export function mediaDetailPath(item) {
  if (isPodcastEpisode(item)) return `/podcasts/episode/${encodeURIComponent(item.id)}`
  if (!/^yt:[A-Za-z0-9_-]{11}$/.test(item?.id || '')) throw new Error('Audio tidak valid.')
  return `/track/${encodeURIComponent(item.id)}`
}

export function podcastPathId(path, kind) {
  const prefix = kind === 'creator' ? '/podcasts/creator/' : '/podcasts/episode/'
  if (!path.startsWith(prefix)) return null
  try {
    const id = decodeURIComponent(path.slice(prefix.length))
    return (kind === 'creator' ? /^UC[A-Za-z0-9_-]{22}$/ : episodeId).test(id) ? id : null
  } catch { return null }
}

export function episodeDate(episode, locale) {
  if (!episode?.publishedAt) return ''
  const value = new Date(episode.publishedAt)
  if (!Number.isFinite(value.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(value)
}

export function readPodcastProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(progressKey) || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter(([id, item]) => episodeId.test(id) && item && Number.isFinite(item.position) && item.position >= 0 && Number.isFinite(item.duration) && item.duration > 0 && item.position < item.duration && Number.isFinite(item.updatedAt)).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 100))
  } catch { return {} }
}

export function savePodcastProgress(item, position, duration, storage) {
  if (!isPodcastEpisode(item) || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0) return false
  const data = readPodcastProgress(storage)
  if (position < 5 || position >= duration - 15) delete data[item.id]
  else data[item.id] = { position: Math.min(position, duration), duration, updatedAt: Date.now() }
  try {
    storage.setItem(progressKey, JSON.stringify(Object.fromEntries(Object.entries(data).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 100))))
    return true
  } catch { return false }
}

export function creatorEpisodes(creator) {
  const episodes = [...(creator?.episodes || []), ...(creator?.shows || []).flatMap(show => show.episodes || [])]
  return [...new Map(episodes.filter(isPodcastEpisode).map(episode => [episode.id, episode])).values()]
}

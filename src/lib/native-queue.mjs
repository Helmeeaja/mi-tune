import { isPodcastEpisode } from './podcasts.mjs'

export function nativeTrack(track) {
  if (!track || (!isPodcastEpisode(track) && !/^yt:[A-Za-z0-9_-]{11}$/.test(track.id || ''))) throw new Error('Audio tidak valid.')
  return {
    id: track.id,
    type: track.type,
    source: track.source,
    musicType: track.musicType,
    title: track.title,
    artist: track.artist,
    artists: track.artists || [track.artist],
    artistRefs: track.artistRefs || [],
    album: track.album || '',
    albumId: track.albumId || null,
    catalogueType: track.catalogueType,
    creatorId: track.creatorId,
    showId: track.showId,
    contentKind: track.contentKind,
    duration: track.duration || 0,
    thumbnail: track.thumbnail || '',
    coverUrl: track.coverUrl || '',
    fileSize: track.fileSize,
    chartRank: track.chartRank,
    publishedAt: track.publishedAt
  }
}

export function nativeQueue(tracks, current) {
  const unique = [...new Map((tracks || []).filter(track => isPodcastEpisode(track) || /^yt:[A-Za-z0-9_-]{11}$/.test(track?.id || '')).map(track => [track.id, track])).values()]
  const index = unique.findIndex(track => track.id === current?.id)
  if (index < 0) return current ? [nativeTrack(current)] : []
  if (unique.length <= 200) return unique.map(nativeTrack)
  return [...unique.slice(index), ...unique.slice(0, index)].slice(0, 200).map(nativeTrack)
}

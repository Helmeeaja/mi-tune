import { Play, Pause, ChevronRight, Globe2 } from 'lucide-react'
import PlaylistCover from './PlaylistCover.jsx'
import Cover from './Cover.jsx'
import { time } from './TrackRow.jsx'
import { useTranslation } from '../lib/i18n.jsx'

export function PublicPlaylistCards({ playlists = [], onPlaylist, onUser }) {
  const { t } = useTranslation()
  return <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">{playlists.map(playlist=><article key={playlist.id} data-public-playlist={playlist.id} className="min-w-0"><a href={`/playlist/${playlist.id}`} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onPlaylist(playlist)}} className="group block"><PlaylistCover playlist={playlist} tracks={playlist.tracks} className="aspect-square w-full !rounded-[24px] transition-transform duration-200 group-hover:-translate-y-1"/><p className="mb-1 mt-4 flex items-center gap-1.5 text-[10px] text-muted"><Globe2 size={12}/>{t('Playlist public')}</p><h3 className="line-clamp-2 text-sm font-extrabold leading-5">{playlist.name}</h3></a>{playlist.owner&&<a href={`/u/${playlist.owner.username}`} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onUser?.(playlist.owner)}} className="mt-1 block truncate text-xs text-muted hover:underline">{playlist.owner.displayName}</a>}<p className="mt-1 text-[10px] text-muted">{t('{count} lagu',{count:playlist.trackCount})}</p></article>)}</div>
}

export function ReadOnlyTracks({ tracks = [], onPlay, current, playing }) {
  const { t } = useTranslation()
  return <div className="space-y-2">{tracks.map((track,index)=>{
    const active=current?.id===track.id && playing
    return <article key={track.id} data-public-track={track.id}><button type="button" onClick={()=>onPlay(track,tracks)} aria-label={t(active?'Jeda {title}':'Putar {title}',{title:track.title})} className="group flex min-h-20 w-full min-w-0 items-center gap-3 rounded-[20px] px-3 py-3 text-left transition-colors hover:bg-surface sm:gap-4"><span className="hidden w-5 shrink-0 text-center text-xs tabular-nums text-muted sm:block">{index+1}</span><Cover track={track} className="size-12 shrink-0"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{track.title}</span><span className="mt-1 block truncate text-xs text-muted">{track.artist}</span></span><span className="hidden text-[10px] tabular-nums text-muted sm:block">{time(track.duration)}</span><span className="play-button !size-10 !rounded-full">{active?<Pause size={15} fill="currentColor"/>:<Play size={15} fill="currentColor"/>}</span></button></article>
  })}</div>
}

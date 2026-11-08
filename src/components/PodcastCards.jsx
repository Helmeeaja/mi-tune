import { ArrowUpRight, Headphones, ListPlus, LoaderCircle, Pause, Play, Mic2 } from 'lucide-react'
import { useTranslation } from '../lib/i18n.jsx'
import { CatalogArtwork } from './CatalogCards.jsx'
import Cover from './Cover.jsx'
import { time } from './TrackRow.jsx'
import { episodeDate } from '../lib/podcasts.mjs'

export function PodcastCreatorCard({ creator, onCreator }) {
  const { t } = useTranslation()
  return <a href={`/podcasts/creator/${encodeURIComponent(creator.id)}`} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onCreator(creator) }} data-podcast-creator={creator.id} className="clay-surface group flex min-w-0 items-center gap-4 p-4">
    <CatalogArtwork item={creator} artist className="size-16 !rounded-[20px]" />
    <div className="min-w-0 flex-1"><p className="mb-1 text-[10px] font-semibold text-muted">{t(creator.contentKind === 'audio-essay' ? 'Esai audio' : 'Kreator podcast')}{creator.active && <span> · {t('Baru upload')}</span>}</p><h3 className="truncate text-sm font-extrabold">{creator.name}</h3>{creator.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{creator.description}</p>}</div>
    <ArrowUpRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
  </a>
}

export function PodcastCreatorRail({ creators = [], onCreator }) {
  const { t } = useTranslation()
  return <div className="scroll-area -mx-1 flex gap-5 overflow-x-auto px-1 pb-3 sm:gap-7" data-lenis-prevent>{creators.map(creator=>{
    const item={...creator,title:creator.name,thumbnail:creator.thumbnail || creator.shows?.find(show=>show.thumbnail)?.thumbnail || creator.episodes?.find(episode=>episode.thumbnail)?.thumbnail}
    return <a key={creator.id} href={`/podcasts/creator/${encodeURIComponent(creator.id)}`} onClick={event=>{if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;event.preventDefault();onCreator(creator)}} data-podcast-creator={creator.id} className="group w-24 shrink-0 text-center sm:w-28"><CatalogArtwork item={item} artist={Boolean(creator.thumbnail)} className="mx-auto size-20 !rounded-full transition-transform duration-200 group-hover:-translate-y-1 sm:size-24"/><h3 className="mt-3 line-clamp-2 text-xs font-extrabold leading-5">{creator.name}</h3><p className="mt-1 text-[10px] text-muted">{t(creator.contentKind==='audio-essay'?'Esai audio':'Podcast')}</p></a>
  })}</div>
}

export function FeaturedPodcast({ episode, creator, onOpen, onPlay, current, playing, compact = false }) {
  const { t } = useTranslation()
  if (!episode) return null
  const active=current?.id===episode.id && playing
  return <article data-featured-podcast={episode.id} className={`min-w-0 ${compact?'':'grid gap-7 lg:grid-cols-[1.05fr_1fr] lg:items-center'}`}>
    <div className="group relative min-w-0"><a href={`/podcasts/episode/${encodeURIComponent(episode.id)}`} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onOpen(episode)}} className="block"><Cover track={episode} eager className={`w-full !rounded-[30px] ${compact?'aspect-[16/10]':'aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3]'}`}/></a><span className="absolute left-4 top-4 rounded-full border border-line bg-surface px-3 py-2 text-[10px] font-bold">{time(episode.duration)}</span><button type="button" onClick={()=>onPlay(episode)} aria-label={t(active?'Jeda episode {title}':'Putar episode {title}',{title:episode.title})} className="play-button absolute bottom-5 right-5 !size-14 !rounded-full shadow-lg transition-transform hover:scale-105">{active?<Pause size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}</button></div>
    <div className={compact?'px-1 pt-5':'min-w-0'}><p className="eyebrow mb-3">{t('Pilihan kali ini')}</p><a href={`/podcasts/episode/${encodeURIComponent(episode.id)}`} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onOpen(episode)}}><h2 className={`line-clamp-3 font-extrabold leading-[1.16] tracking-[-.045em] ${compact?'text-[25px] sm:text-[29px]':'text-[29px] sm:text-[38px] xl:text-[44px]'}`}>{episode.title}</h2></a><p className="mt-4 text-xs font-semibold text-muted">{creator?.name || episode.artist}</p>{!compact&&episode.description&&<p className="mt-4 line-clamp-3 text-sm leading-7 text-muted">{episode.description}</p>}{!compact&&<button type="button" onClick={()=>onPlay(episode)} className="clay-button clay-primary mt-6 !rounded-full !px-6">{active?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}{t(active?'Jeda':'Dengarkan sekarang')}</button>}</div>
  </article>
}

export function PodcastEpisodeRow({ episode, active, playing, busy, onPlay, onOpen, onCreator, onQueue, progress }) {
  const { t, locale } = useTranslation()
  const published = episodeDate(episode, locale)
  return <article data-podcast-episode={episode.id} data-active={active} className="clay-surface flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4">
    <a href={`/podcasts/episode/${encodeURIComponent(episode.id)}`} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(episode) }} className="shrink-0" aria-label={t('Buka episode {title}', { title: episode.title })}><Cover track={episode} className="size-14 sm:size-16" /></a>
    <div className="min-w-0 flex-1"><a href={`/podcasts/episode/${encodeURIComponent(episode.id)}`} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(episode) }} className="block"><h3 className="line-clamp-2 text-sm font-bold leading-5">{episode.title}</h3></a>
      {episode.creatorId && onCreator ? <a href={`/podcasts/creator/${encodeURIComponent(episode.creatorId)}`} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onCreator({ id: episode.creatorId }) }} className="mt-1 block truncate text-xs text-muted hover:underline">{episode.artist}</a> : <p className="mt-1 truncate text-xs text-muted">{episode.artist}</p>}
      <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted">{episode.contentKind === 'audio-essay' && <span>{t('Esai audio')}</span>}{published && <span>{published}</span>}<span>{time(episode.duration)}</span>{progress?.position > 0 && <span>{t('Lanjut dari {position}', { position: time(progress.position) })}</span>}</p>
    </div>
    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">{onQueue && <button type="button" className="icon-button" aria-label={t('Antrekan episode {title}', { title: episode.title })} onClick={() => onQueue(episode)}><ListPlus size={17} /></button>}
      <button type="button" onClick={() => onPlay(episode)} aria-label={t(active && playing ? 'Jeda episode {title}' : 'Putar episode {title}', { title: episode.title })} className="play-button !size-11 !rounded-[15px]">{busy ? <LoaderCircle size={18} className="motion-safe:animate-spin" /> : active && playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
    </div>
  </article>
}

export function PodcastResults({ data, busy, error, onCreator, renderEpisodes, empty = false }) {
  const { t } = useTranslation()
  const creators = data?.creators || []
  const episodes = data?.episodes || []
  return <div className="space-y-7" data-podcast-results>
    {error && <p role="alert" className="notice">{t(error)}</p>}
    {busy && <div className="clay-panel flex items-center gap-3 p-6"><LoaderCircle size={20} className="motion-safe:animate-spin text-accent" /><p role="status" className="text-sm text-muted">{t('Mencari podcast…')}</p></div>}
    {creators.length > 0 && <section aria-labelledby="podcast-creators-title"><h2 id="podcast-creators-title" className="section-heading mb-4">{t('Kreator podcast')}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{creators.map(creator => <PodcastCreatorCard key={creator.id} creator={creator} onCreator={onCreator} />)}</div></section>}
    {episodes.length > 0 && <section aria-labelledby="podcast-episodes-title"><h2 id="podcast-episodes-title" className="section-heading mb-4">{t('Episode untuk kamu')}</h2>{renderEpisodes(episodes)}</section>}
    {empty && !busy && !error && !creators.length && !episodes.length && <div className="clay-panel empty-state"><span className="empty-icon"><Mic2 size={26} /></span><h2 className="section-heading">{t('Podcastnya belum ketemu')}</h2><p className="muted-copy">{t('Coba nama kreator, judul, atau topik lain.')}</p></div>}
    {data?.stale && (creators.length > 0 || episodes.length > 0) && <p role="status" className="text-xs text-muted">{t('Menampilkan podcast yang terakhir dimuat. Sambungkan internet untuk pembaruan.')}</p>}
  </div>
}

export function PodcastPreview({ data, busy, error, onPodcasts, onCreator, renderEpisodes, onEpisode, onPlayEpisode, current, playing }) {
  const { t } = useTranslation()
  const creators = data?.creators?.slice(0, 8) || []
  const episodes = data?.episodes?.slice(0, 3) || []
  return <section aria-labelledby="home-podcasts-title" className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-2">{t('Ada yang seru buat didengar')}</p><h2 id="home-podcasts-title" className="section-heading">{t('Podcast')}</h2></div><button type="button" onClick={onPodcasts} className="flex min-h-11 items-center gap-2 text-xs font-bold text-muted">{t('Lihat podcast')}<ArrowUpRight size={15} /></button></div>
    {busy && !creators.length && <p role="status" className="flex items-center gap-2 text-sm text-muted"><LoaderCircle size={17} className="motion-safe:animate-spin" />{t('Memuat podcast…')}</p>}
    {episodes.length > 0 && <div className="grid min-w-0 gap-7 lg:grid-cols-[1.05fr_1fr]"><FeaturedPodcast episode={episodes[0]} creator={creators.find(creator=>creator.id===episodes[0].creatorId)} onOpen={onEpisode} onPlay={onPlayEpisode} current={current} playing={playing} compact/><div className="min-w-0 space-y-5 pt-1"><p className="eyebrow">{t('Coba suara lain')}</p>{renderEpisodes(episodes.slice(1))}<button type="button" onClick={onPodcasts} className="inline-flex min-h-11 items-center gap-2 text-xs font-bold">{t('Jelajahi semua podcast')}<ArrowUpRight size={15}/></button></div></div>}
    {creators.length > 0 && <PodcastCreatorRail creators={creators} onCreator={onCreator}/>}
    {!busy && !creators.length && !episodes.length && <div className="clay-panel flex flex-wrap items-center gap-4 p-6"><Headphones size={26} className="text-accent" /><p className="min-w-0 flex-1 text-sm text-muted">{t(error || 'Cari kreator favoritmu atau coba topik baru.')}</p><button type="button" onClick={onPodcasts} className="clay-button">{t('Cari podcast')}</button></div>}
  </section>
}

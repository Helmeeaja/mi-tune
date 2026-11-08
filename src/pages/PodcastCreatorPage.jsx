import { useEffect, useState } from 'react'
import { ChevronLeft, LoaderCircle, Mic2, RefreshCw, ArrowDown } from 'lucide-react'
import { CatalogArtwork } from '../components/CatalogCards.jsx'
import { useTranslation } from '../lib/i18n.jsx'
import { creatorEpisodes } from '../lib/podcasts.mjs'

export default function PodcastCreatorPage({ creator, busy, error, onBack, onRetry, renderEpisodes }) {
  const { t, locale } = useTranslation()
  const [showId,setShowId] = useState('')
  const [fullBio,setFullBio] = useState(false)
  const [visible,setVisible] = useState(12)
  useEffect(()=>{setShowId('');setFullBio(false);setVisible(12)},[creator?.id])
  useEffect(()=>setVisible(12),[showId])
  const allEpisodes = creatorEpisodes(creator)
  const episodes = showId?allEpisodes.filter(episode=>episode.showId===showId):allEpisodes
  const artwork = creator?{...creator,title:creator.name,thumbnail:creator.thumbnail||creator.shows?.find(show=>show.thumbnail)?.thumbnail||allEpisodes.find(episode=>episode.thumbnail)?.thumbnail}:null
  return <div data-page="podcast-creator" className="min-w-0 space-y-9 sm:space-y-12"><button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-xs font-bold text-muted"><ChevronLeft size={16}/>{t('Semua podcast')}</button>
    {error&&<div role="alert" className="notice flex flex-wrap items-center justify-between gap-3"><p>{t(error)}</p><button type="button" onClick={onRetry} className="clay-button"><RefreshCw size={15}/>{t('Coba lagi')}</button></div>}
    {busy&&!creator&&<div role="status" className="flex items-center gap-3 py-16"><LoaderCircle size={21} className="motion-safe:animate-spin"/>{t('Memuat kreator podcast…')}</div>}
    {creator&&<><section className="grid min-w-0 gap-7 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center lg:grid-cols-[220px_minmax(0,1fr)]"><CatalogArtwork item={artwork} artist={Boolean(creator.thumbnail)} eager className="size-40 !rounded-[36px] sm:size-full sm:aspect-square"/><div className="min-w-0"><p className="eyebrow mb-3">{t(creator.contentKind==='audio-essay'?'Esai audio':'Kreator podcast')}{creator.active&&<span className="ml-3 rounded-full bg-sage px-2.5 py-1 text-[9px] tracking-normal">{t('Baru upload')}</span>}</p><h1 className="break-words text-[38px] font-extrabold leading-[1.08] tracking-[-.055em] sm:text-[52px]">{creator.name}</h1><p className="mt-4 text-xs text-muted">{t('{count} episode tersedia',{count:allEpisodes.length.toLocaleString(locale)})}</p></div></section>
      <section className="max-w-3xl border-t border-line pt-7"><h2 className="mb-3 text-sm font-extrabold">{t('Tentang kreator')}</h2>{creator.description?<><p className={`whitespace-pre-line break-words text-sm leading-7 text-muted ${fullBio?'':'line-clamp-4'}`}>{creator.description}</p>{creator.description.length>240&&<button type="button" className="mt-3 min-h-11 text-xs font-bold" onClick={()=>setFullBio(value=>!value)}>{t(fullBio?'Ringkas':'Baca selengkapnya')}</button>}</>:<p className="text-sm text-muted">{t('Bio dari kreator belum tersedia.')}</p>}</section>
      {creator.shows?.length>1&&<div className="scroll-area flex gap-2 overflow-x-auto pb-2" aria-label={t('Pilih podcast dari kreator ini')} data-lenis-prevent><button type="button" onClick={()=>setShowId('')} aria-pressed={!showId} className="clay-button shrink-0 !rounded-full text-xs">{t('Semua episode')}</button>{creator.shows.map(show=><button type="button" key={show.id} onClick={()=>setShowId(show.id)} aria-pressed={showId===show.id} className="clay-button max-w-[260px] shrink-0 !rounded-full text-xs"><span className="truncate">{show.title}</span></button>)}</div>}
      <section aria-labelledby="creator-episodes" className="space-y-5"><h2 id="creator-episodes" className="text-[28px] font-extrabold tracking-[-.04em]">{t('Episode')}</h2>{episodes.length?renderEpisodes(episodes.slice(0,visible)):<div className="py-10"><Mic2 size={26} className="mb-4 text-muted"/><h3 className="text-lg font-extrabold">{t('Belum ada episode di sini')}</h3><p className="mt-2 text-sm text-muted">{t('Pilih podcast lain dari kreator ini atau coba lagi nanti.')}</p></div>}{episodes.length>visible&&<button type="button" onClick={()=>setVisible(value=>value+12)} className="clay-button mx-auto flex !rounded-full"><ArrowDown size={16}/>{t('Lihat episode lainnya')}</button>}</section>
      {creator.stale&&<p role="status" className="text-xs text-muted">{t('Profil terakhir yang dimuat. Episode terbaru akan muncul setelah tersambung.')}</p>}
    </>}
  </div>
}

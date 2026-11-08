import { useEffect, useState } from 'react'
import { Search, X, RefreshCw, ArrowDown, Mic2 } from 'lucide-react'
import { useTranslation } from '../lib/i18n.jsx'
import { FeaturedPodcast, PodcastCreatorRail, PodcastResults } from '../components/PodcastCards.jsx'

export default function PodcastsPage({ data, busy, error, query, onQuery, onSearch, onRefresh, onCreator, renderEpisodes, onEpisode, onPlayEpisode, current, playing }) {
  const { t } = useTranslation()
  const [visible,setVisible] = useState(12)
  const episodes = data?.episodes || []
  const creators = data?.creators || []
  const featured = episodes[0]
  useEffect(()=>setVisible(12),[query,data?.updatedAt])
  return <div data-page="podcasts" className="min-w-0 space-y-10 sm:space-y-12">
    <header className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow mb-3">{t('Ada cerita baru buat didengar')}</p><h1 className="text-[52px] font-extrabold leading-none tracking-[-.065em] sm:text-[72px]">{t('Podcast')}<span className="text-accent">.</span></h1><p className="mt-4 max-w-md text-sm leading-7 text-muted">{t('Obrolan seru, cerita panjang, dan suara yang belum kamu kenal.')}</p></div><button type="button" disabled={busy} onClick={onRefresh} className="clay-button self-start !rounded-full sm:self-auto"><RefreshCw size={15} className={busy?'motion-safe:animate-spin':''}/>{t('Pilihan lainnya')}</button></header>
    <div className="space-y-4"><form role="search" aria-label={t('Cari podcast')} onSubmit={event=>{event.preventDefault();onSearch(query.trim())}} className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface p-2 pl-5"><Search size={19} className="shrink-0 text-muted"/><label htmlFor="podcast-query" className="sr-only">{t('Nama kreator, judul, atau topik podcast')}</label><input id="podcast-query" type="search" value={query} onChange={event=>onQuery(event.target.value)} maxLength={120} minLength={2} placeholder={t('Cari podcast atau kreator')} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"/>{query&&<button type="button" onClick={()=>{onQuery('');onSearch('')}} aria-label={t('Hapus pencarian podcast')} className="icon-button"><X size={17}/></button>}<button type="submit" disabled={busy||query.trim().length<2} className="clay-button !rounded-full !px-5">{t('Cari')}</button></form><div className="flex flex-wrap gap-2" aria-label={t('Topik podcast')}>{['Komedi','Cerita','Sains','Bisnis','Teknologi','Filsafat'].map(topic=><button type="button" key={topic} onClick={()=>{const term=`podcast ${topic.toLowerCase()}`;onQuery(term);onSearch(term)}} className="min-h-10 rounded-full border border-line px-4 text-[11px] font-semibold text-muted transition-colors hover:bg-surface hover:text-ink">{t(topic)}</button>)}</div></div>
    {query?<PodcastResults data={data} busy={busy} error={error} onCreator={onCreator} renderEpisodes={renderEpisodes} empty/>:<>
      {error&&<p role="alert" className="notice">{t(error)}</p>}
      {busy&&!featured&&<div role="status" className="skeleton h-72 rounded-[30px]" aria-label={t('Memuat podcast…')}/>}
      {featured&&<FeaturedPodcast episode={featured} creator={creators.find(creator=>creator.id===featured.creatorId)} onOpen={onEpisode} onPlay={onPlayEpisode} current={current} playing={playing}/>}
      {creators.length>0&&<section className="space-y-6 border-y border-line py-7 sm:py-8"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-extrabold tracking-[-.035em]">{t('Temukan suara baru')}</h2><p className="text-[11px] text-muted">{t('Kreator podcast')}</p></div><PodcastCreatorRail creators={creators} onCreator={onCreator}/></section>}
      {episodes.length>1&&<section className="space-y-5"><div><p className="eyebrow mb-2">{t('Jangan berhenti di satu cerita')}</p><h2 className="text-[28px] font-extrabold tracking-[-.04em]">{t('Episode buat kamu')}</h2></div>{renderEpisodes(episodes.slice(1,visible))}{episodes.length>visible&&<button type="button" onClick={()=>setVisible(value=>value+12)} className="clay-button mx-auto flex !rounded-full !px-6"><ArrowDown size={16}/>{t('Lihat episode lainnya')}</button>}</section>}
      {!busy&&!featured&&!creators.length&&<div className="py-14 text-center"><Mic2 size={35} className="mx-auto mb-5 text-muted"/><h2 className="text-xl font-extrabold">{t('Cari podcast pertamamu')}</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted">{t('Ketik nama kreator atau topik yang ingin kamu dengar.')}</p></div>}
    </>}
  </div>
}

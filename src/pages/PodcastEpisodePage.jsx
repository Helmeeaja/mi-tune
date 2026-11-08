import { lazy, Suspense } from 'react'
import { ChevronLeft, ChevronDown, FileText, LoaderCircle, Pause, Play, RefreshCw, RotateCcw, RotateCw, ListPlus, Share2 } from 'lucide-react'
import Cover from '../components/Cover.jsx'
import { time } from '../components/TrackRow.jsx'
import { useTranslation } from '../lib/i18n.jsx'
import { episodeDate } from '../lib/podcasts.mjs'

const PodcastTranscript = lazy(() => import('../components/PodcastTranscript.jsx'))

export default function PodcastEpisodePage({ episode, busy, error, current, playing, loading, playerError, position, duration, progress, onBack, onRetry, onPlay, onSeek, onCreator, onQueue, onShare, owner, onAuth, transcriptOpen = false, onTranscriptToggle }) {
  const { t, locale } = useTranslation()
  const active = current?.id === episode?.id
  const end = active ? duration || episode?.duration || 0 : episode?.duration || 0
  const elapsed = active ? position : progress?.position || 0
  const published = episodeDate(episode, locale)
  return <div data-page="podcast-episode" className="space-y-7"><button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-xs font-bold text-muted"><ChevronLeft size={16} />{t('Semua podcast')}</button>
    {error && <div role="alert" className="notice flex flex-wrap items-center justify-between gap-3"><p>{t(error)}</p><button type="button" onClick={onRetry} className="clay-button"><RefreshCw size={15} />{t('Coba lagi')}</button></div>}
    {busy && !episode && <div role="status" className="clay-panel flex items-center gap-3 p-8"><LoaderCircle size={21} className="motion-safe:animate-spin" />{t('Memuat episode…')}</div>}
    {episode && <section className="clay-panel grid gap-7 p-5 sm:p-8 lg:grid-cols-[220px_minmax(0,1fr)]"><Cover track={episode} eager className="mx-auto aspect-square w-full max-w-[280px] !rounded-[28px]" /><div className="min-w-0"><p className="eyebrow mb-3">{t('Episode podcast')}</p><h1 className="text-[28px] font-extrabold leading-tight tracking-[-.035em] sm:text-[36px]">{episode.title}</h1>{episode.creatorId ? <a href={`/podcasts/creator/${encodeURIComponent(episode.creatorId)}`} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onCreator({ id: episode.creatorId }) }} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:underline">{episode.artist}</a> : <p className="mt-3 text-sm text-muted">{episode.artist}</p>}
      <p className="mt-2 text-xs text-muted">{episode.album}{published ? ` · ${published}` : ''}{end ? ` · ${time(end)}` : ''}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => onPlay(episode)} className="clay-button clay-primary">{active && loading ? <LoaderCircle size={18} className="motion-safe:animate-spin" /> : active && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}{t(active && playing ? 'Jeda' : elapsed > 0 ? 'Lanjutkan episode' : 'Putar episode')}</button><button type="button" onClick={() => onQueue(episode)} className="icon-button" aria-label={t('Antrekan episode {title}', { title: episode.title })}><ListPlus size={19} /></button><button type="button" onClick={() => onShare(episode)} className="icon-button" aria-label={t('Bagikan episode {title}', { title: episode.title })}><Share2 size={18} /></button></div>
      {active && <div className="mt-5 space-y-3"><label htmlFor="podcast-progress" className="sr-only">{t('Posisi episode')}</label><input id="podcast-progress" type="range" min="0" max={end || 1} step="1" value={Math.min(elapsed, end || 1)} disabled={!end} onChange={event => onSeek(Number(event.target.value))} className="w-full" /><div className="flex items-center justify-between text-xs text-muted"><span>{time(elapsed)}</span><div className="flex gap-2"><button type="button" className="icon-button" onClick={() => onSeek(Math.max(0, elapsed - 10))} aria-label={t('Mundur 10 detik')}><RotateCcw size={18} /></button><button type="button" className="icon-button" onClick={() => onSeek(elapsed + 30)} aria-label={t('Maju 30 detik')}><RotateCw size={18} /></button></div><span>{time(end)}</span></div></div>}
      {active && playerError && <p role="alert" className="notice mt-4">{t(playerError)}</p>}
      {episode.description && <div className="mt-6 border-t border-line pt-5"><h2 className="mb-3 text-sm font-bold">{t('Tentang episode ini')}</h2><p className="whitespace-pre-line break-words text-sm leading-7 text-muted">{episode.description}</p></div>}
    </div></section>}
    {episode && <div className="space-y-4"><button type="button" onClick={onTranscriptToggle} aria-expanded={transcriptOpen} aria-controls="podcast-transcript-panel" className="clay-panel flex min-h-14 w-full items-center gap-3 px-5 py-4 text-left text-sm font-extrabold"><FileText size={18} /><span className="flex-1">{t('Transkrip')}</span><ChevronDown size={18} className={transcriptOpen ? 'rotate-180' : ''} /></button>{transcriptOpen && <div id="podcast-transcript-panel"><Suspense fallback={<div role="status" className="clay-panel flex items-center gap-3 p-6 text-sm text-muted"><LoaderCircle size={18} className="motion-safe:animate-spin" />{t('Memuat transkrip…')}</div>}><PodcastTranscript episode={episode} active={active} position={active ? position : 0} onSeek={onSeek} owner={owner} onAuth={onAuth} /></Suspense></div>}</div>}
  </div>
}

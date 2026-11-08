import { ArrowUpRight, Headphones, LoaderCircle, Mic2, Pause, Play, RefreshCw } from 'lucide-react'
import Cover from './Cover.jsx'
import TrackCard from './TrackCard.jsx'

import { FeaturedPodcast, PodcastCreatorRail } from './PodcastCards.jsx'
import { useTranslation } from '../lib/i18n.jsx'

export default function MobileHome({ atmosphere, recommendations, discovery, trending, trendingError, initialBusy, refreshBusy, current, playing, preparing, onPlay, onOpen, onArtist, onRefresh, onSearch, onTrending, renderTracks, online, podcasts, podcastBusy, podcastError, onPodcasts, onPodcastCreator, onEpisode, onPlayEpisode }) {
  const { t, language, locale } = useTranslation()
  const { context, greeting } = atmosphere
  const tracks = recommendations.tracks
  const quickTracks = tracks.slice(0, 6)
  const creators = podcasts?.creators || []
  const episode = podcasts?.episodes?.[0]
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date())

  return <div className="mobile-home lg:hidden" data-context={context.key}>
    <section className="mobile-greeting">
      <p className="eyebrow">{weekday}</p>
      <h1>{context.title[language]}</h1>
      <p data-greeting={greeting.index} className="mobile-greeting-copy">{greeting[language]}</p>
      <div className="mobile-content-switch" aria-label={t('Pilih konten')}>
        <button type="button" aria-pressed="true" onClick={() => document.getElementById('mobile-music-heading')?.scrollIntoView({ block: 'start', behavior: 'auto' })}>{t('Musik')}</button>
        <button type="button" onClick={onPodcasts}><Mic2 size={15} aria-hidden="true" />{t('Podcast')}</button>
        <button type="button" onClick={onTrending}>{t('Trending')}</button>
      </div>
    </section>

    {quickTracks.length > 0 && <section aria-label={t('Pilihan cepat')} className="mobile-quick-grid">
      {quickTracks.map(track => <button type="button" key={track.id} onClick={() => onPlay(track, tracks)} aria-label={t(current?.id === track.id && playing ? 'Jeda {title}' : 'Putar {title}', { title: track.title })} data-active={current?.id === track.id}>
        <Cover track={track} className="mobile-quick-art" />
        <span>{track.title}</span>
        {preparing[track.id] ? <LoaderCircle size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : current?.id === track.id && playing ? <Pause size={15} fill="currentColor" aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}
      </button>)}
    </section>}

    <section aria-labelledby="mobile-music-heading" className="mobile-section">
      <div className="mobile-section-heading"><div><p className="eyebrow">{t('Pilihan kali ini')}</p><h2 id="mobile-music-heading">{t('Untukmu')}</h2></div><button type="button" className="icon-button" onClick={onRefresh} disabled={!online || refreshBusy} aria-label={t('Perbarui katalog')}><RefreshCw size={19} className={refreshBusy ? 'motion-safe:animate-spin' : ''} /></button></div>
      {tracks.length ? <div className="mobile-content-rail" data-lenis-prevent>{tracks.slice(0, 8).map(track => <TrackCard key={track.id} track={track} onPlay={() => onPlay(track, tracks)} onOpen={() => onOpen(track, tracks)} onArtist={onArtist} active={current?.id === track.id} playing={playing} busy={Boolean(preparing[track.id])} />)}</div> : initialBusy || recommendations.busy ? <div className="mobile-content-rail" role="status" aria-label={t('Memuat lagu trending…')}><div className="skeleton aspect-square" /><div className="skeleton aspect-square" /></div> : <div className="mobile-empty clay-panel"><Headphones size={24} className="text-accent" /><h3>{t('Mulai dari lagu yang kamu suka')}</h3><p>{t(recommendations.error || 'Katalog belum tersedia. Cari judul atau nama artis untuk memulai.')}</p><button type="button" className="clay-button" onClick={() => onSearch('lagu Indonesia')}>{t('Cari musik')}</button></div>}
    </section>

    <section aria-labelledby="mobile-genres-heading" className="mobile-section">
      <div className="mobile-section-heading"><h2 id="mobile-genres-heading">{t('Genre & mood')}</h2></div>
      <div className="mobile-mood-grid">
        <button type="button" onClick={() => onSearch('acoustic chill songs')}><img src="/artwork/dawn.jpg" alt="" loading="lazy" /><span>{t('Pagi pelan')}</span></button>
        <button type="button" onClick={() => onSearch('indie pop songs')}><img src="/artwork/forest.jpg" alt="" loading="lazy" /><span>Indie</span></button>
        <button type="button" onClick={() => onSearch('lofi instrumental')}><img src="/artwork/studio.jpg" alt="" loading="lazy" /><span>{t('Lagi fokus')}</span></button>
        <button type="button" onClick={() => onSearch('rnb soul songs')}><img src="/artwork/afterhours.jpg" alt="" loading="lazy" /><span>R&B</span></button>
      </div>
      <div className="mobile-topic-rail" data-lenis-prevent><button type="button" onClick={() => onSearch('pop songs')}>Pop</button><button type="button" onClick={() => onSearch('jazz songs')}>Jazz</button><button type="button" onClick={() => onSearch('rock songs')}>Rock</button><button type="button" onClick={() => onSearch('kpop songs')}>K-Pop</button><button type="button" onClick={() => onSearch('lagu Indonesia')}>Indonesia</button></div>
    </section>

    <section aria-labelledby="mobile-podcast-heading" className="mobile-section">
      <div className="mobile-section-heading"><h2 id="mobile-podcast-heading">{t('Podcast')}</h2><button type="button" onClick={onPodcasts}>{t('Semua')}<ArrowUpRight size={16} aria-hidden="true" /></button></div>
      {episode && <FeaturedPodcast episode={episode} creator={creators.find(creator => creator.id === episode.creatorId)} onOpen={onEpisode} onPlay={onPlayEpisode} current={current} playing={playing} compact />}
      {creators.length > 0 && <PodcastCreatorRail creators={creators.slice(0, 8)} onCreator={onPodcastCreator} />}
      {podcastBusy && !episode && <p role="status" className="flex items-center gap-2 text-sm text-muted"><LoaderCircle size={17} className="motion-safe:animate-spin" />{t('Memuat podcast…')}</p>}
      {!podcastBusy && !episode && !creators.length && <div className="mobile-empty clay-panel"><p>{t(podcastError || 'Cari kreator favoritmu atau coba topik baru.')}</p><button type="button" onClick={onPodcasts} className="clay-button">{t('Cari podcast')}</button></div>}
    </section>

    <section aria-labelledby="mobile-trending-heading" className="mobile-section">
      <div className="mobile-section-heading"><h2 id="mobile-trending-heading">{t('Sedang ramai')}</h2><button type="button" onClick={onTrending}>{t('Semua')}<ArrowUpRight size={16} aria-hidden="true" /></button></div>

      {trending.tracks.length ? renderTracks(trending.tracks.slice(0, 5)) : <p className="mobile-empty clay-panel" role={trendingError ? 'alert' : 'status'}>{t(trendingError || 'Chart belum tersedia saat ini')}</p>}
    </section>

    {discovery.tracks.length > 0 && <section aria-labelledby="mobile-discover-heading" className="mobile-section"><div className="mobile-section-heading"><h2 id="mobile-discover-heading">{t('Pilihan untuk dijelajahi')}</h2></div><div className="mobile-content-rail" data-lenis-prevent>{discovery.tracks.slice(0, 8).map(track => <TrackCard key={track.id} track={track} onPlay={() => onPlay(track, discovery.tracks)} onOpen={() => onOpen(track, discovery.tracks)} onArtist={onArtist} active={current?.id === track.id} playing={playing} busy={Boolean(preparing[track.id])} />)}</div></section>}
  </div>
}

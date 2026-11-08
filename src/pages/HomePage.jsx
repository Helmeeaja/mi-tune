import { motion, useReducedMotion } from 'framer-motion'
import { Play, Pause, ArrowUpRight, ChevronRight, RefreshCw, Headphones, LoaderCircle, Sun, Sunset, Moon, CloudSun } from 'lucide-react'
import { RecordStack } from '../components/MusicMotion.jsx'
import TrackCard from '../components/TrackCard.jsx'
import { useTranslation } from '../lib/i18n.jsx'
import { motionTokens, springs } from '../lib/motion.js'
import Cover from '../components/Cover.jsx'
import ChartSource from '../components/ChartSource.jsx'
import { PodcastPreview } from '../components/PodcastCards.jsx'

export default function HomePage({ discovery, trending, trendingError, initialBusy, refreshBusy, current, playing, preparing, animations = true, onPlay, onOpen, onArtist, onRefresh, onSearch, onTrending, renderTracks, online, atmosphere, recommendations, podcasts, podcastBusy, podcastError, onPodcasts, onPodcastCreator, renderEpisodes, onEpisode, onPlayEpisode }) {
  const reduced = useReducedMotion()
  const { t, language, locale, date } = useTranslation()
  const { context, greeting } = atmosphere
  const featured = recommendations.tracks[0]
  const PeriodIcon = context.period === 'morning' ? Sun : context.period === 'afternoon' ? CloudSun : context.period === 'evening' ? Sunset : Moon
  const periodName = context.period === 'morning' ? t('Pagi') : context.period === 'afternoon' ? t('Siang') : context.period === 'evening' ? t('Sore') : t('Malam')
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date())
  return <div data-page="home" data-context={context.key} data-context-stamp={context.stamp} className="space-y-9 sm:space-y-12">
    <section data-period={context.period} data-mood={context.mood} className="clay-panel home-hero relative grid gap-6 overflow-hidden p-6 sm:p-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-center">
      <div className="relative z-10 max-w-lg">
        <div className="mb-5 flex flex-wrap items-center gap-2"><span className="grid size-7 place-items-center rounded-[10px] bg-surface/65 text-accent"><PeriodIcon size={15} /></span><span className="eyebrow">{weekday} · {periodName}</span></div>
        <motion.div key={context.stamp} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .35 }}><p className="mb-3 text-[11px] font-bold text-accent">{context.tag[language]}</p><h1 className="max-w-md text-[39px] font-extrabold leading-[1.12] tracking-[-.055em] sm:text-[52px]">{context.title[language]}</h1><p data-greeting={greeting.index} role="status" aria-live="polite" aria-atomic="true" className="mt-5 max-w-md text-sm leading-7 text-muted">{greeting[language]}</p></motion.div>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <motion.button type="button" onClick={() => featured && onPlay(featured, recommendations.tracks)} disabled={!featured} whileTap={reduced ? undefined : { scale: motionTokens.scale.press }} transition={springs.snappy} className="clay-button clay-primary !min-h-12 !px-6">{featured && preparing[featured.id] ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : current?.id === featured?.id && playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{current?.id === featured?.id && playing ? t('Jeda sebentar') : t('Mulai mendengarkan')}</motion.button>
          <button type="button" onClick={onTrending} className="flex min-h-11 items-center gap-2 px-2 text-xs font-bold text-muted">{t('Lihat trending')}<ArrowUpRight size={15} /></button>
        </div>
        <p className="mt-5 max-w-md text-[11px] leading-6 text-muted">{t('Mulai dari lagu-lagu yang lagi ramai.')}</p>
      </div>
      {recommendations.tracks.length ? <RecordStack tracks={recommendations.tracks} current={current} playing={playing} enabled={animations} onPlay={onPlay} /> : <motion.img key={context.artwork} src={context.artwork} alt="" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: .4 }} className="mx-auto aspect-[5/4] w-full max-w-[340px] rounded-[28px] object-cover" />}
    </section>
    <section aria-labelledby="context-heading">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">{t('Yang lagi banyak diputar')}</p><h2 id="context-heading" className="section-heading">{t('Pilihan dari chart')}</h2></div><button type="button" aria-label={t('Perbarui rekomendasi trending')} onClick={recommendations.refresh} disabled={!online || recommendations.busy} className="icon-button clay-surface"><RefreshCw size={17} className={recommendations.busy ? 'motion-safe:animate-spin' : ''} /></button></div>
      <ChartSource feed={trending} compact />
      {recommendations.busy && !recommendations.tracks.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2" role="status" aria-label={t('Memuat lagu trending…')}><div className="skeleton h-36" /><div className="skeleton h-36" /></div> : recommendations.mixes.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{recommendations.mixes.map(mix => <div key={mix.id} className="clay-panel flex min-w-0 gap-4 p-4 sm:p-5"><Cover track={mix.tracks[0]} className="size-20 self-start !rounded-[18px] sm:size-24" /><div className="min-w-0"><p className="text-[10px] font-bold text-muted">{t('{count} lagu', { count: mix.tracks.length.toLocaleString(locale) })}</p><h3 className="mt-2 text-sm font-extrabold leading-6">{t(mix.title)}</h3><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => onPlay(mix.tracks[0], mix.tracks)} className="clay-button !px-3 !text-xs"><Play size={13} fill="currentColor" />{t('Putar mix')}</button><button type="button" onClick={onTrending} className="min-h-11 px-1 text-xs font-bold text-accent">{t('Lihat chart')}</button></div></div></div>)}</div> : <div className="clay-panel mt-4 p-6"><p className="text-sm font-bold">{t('Chart belum bisa dimuat')}</p><p className="muted-copy mt-2">{t(recommendations.error || (online ? 'Coba perbarui sebentar lagi. Kamu tetap bisa mencari lagu.' : 'Sambungkan internet untuk melihat chart terbaru.'))}</p><button type="button" onClick={() => onSearch('pop songs')} className="clay-button mt-4">{t('Cari musik')}</button></div>}
      {recommendations.stale && recommendations.tracks.length > 0 && <p className="mt-4 text-[11px] text-muted">{t('Menampilkan chart yang terakhir dimuat.')}</p>}
      {recommendations.tracks.length > 0 && <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">{recommendations.tracks.slice(0, 4).map(track => <TrackCard key={track.id} track={track} onPlay={() => onPlay(track, recommendations.tracks)} onOpen={() => onOpen(track, recommendations.tracks)} onArtist={onArtist} active={current?.id === track.id} playing={playing} busy={Boolean(preparing[track.id])} />)}</div>}
    </section>
    <section aria-labelledby="mood-heading">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">{t('Genre & mood')}</p><h2 id="mood-heading" className="section-heading">{t('Atau pilih suasanamu sendiri')}</h2></div><span className="hidden text-xs text-muted sm:block">{t('Ikuti mood, bukan aturan.')}</span></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MoodCard name={t('Pagi pelan')} description={t('Lembut & santai')} image="/artwork/dawn.jpg" query="acoustic chill songs" onSearch={onSearch} />
        <MoodCard name={t('Jalan sendiri')} description={t('Pilihan indie')} image="/artwork/forest.jpg" query="indie pop songs" onSearch={onSearch} />
        <MoodCard name={t('Sore hangat')} description={t('Ringan & tenang')} image="/artwork/coast.jpg" query="chill pop songs" onSearch={onSearch} />
        <MoodCard name={t('Lagi fokus')} description={t('Teman kerja')} image="/artwork/studio.jpg" query="lofi instrumental" onSearch={onSearch} light />
        <MoodCard name={t('Lewat tengah malam')} description={t('Santai sebentar')} image="/artwork/afterhours.jpg" query="rnb soul songs" onSearch={onSearch} />
        <MoodCard name={t('Terus jalan')} description={t('Sedikit energi')} image="/artwork/city.jpg" query="upbeat pop songs" onSearch={onSearch} />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" data-lenis-prevent><Genre name="Pop" query="pop songs" onSearch={onSearch} /><Genre name="Indie" query="indie songs" onSearch={onSearch} /><Genre name="Jazz" query="jazz songs" onSearch={onSearch} /><Genre name="R&B" query="rnb songs" onSearch={onSearch} /><Genre name="Rock" query="rock songs" onSearch={onSearch} /><Genre name="K-Pop" query="kpop songs" onSearch={onSearch} /><Genre name="Indonesia" query="lagu Indonesia" onSearch={onSearch} /></div>
    </section>
    <PodcastPreview data={podcasts} busy={podcastBusy} error={podcastError} onPodcasts={onPodcasts} onCreator={onPodcastCreator} renderEpisodes={renderEpisodes} onEpisode={onEpisode} onPlayEpisode={onPlayEpisode} current={current} playing={playing}/>
    <section aria-labelledby="trending-heading" className="clay-panel p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 px-2"><div><p className="eyebrow mb-2">{t('Trending sekarang')}</p><h2 id="trending-heading" className="section-heading">{t('Sedang ramai')}</h2><p className="mt-2 text-xs leading-5 text-muted">{t('Lagu yang lagi banyak didengar.')}</p></div>{trending.tracks.length > 0 && <button type="button" onClick={onTrending} className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-bold text-accent">{t('Semua')}<ChevronRight size={15} /></button>}</div>
      {trending.tracks.length ? renderTracks(trending.tracks.slice(0, 4)) : <div className="rounded-[20px] bg-canvas px-5 py-6"><p className="text-sm font-bold">{t(initialBusy ? 'Mengambil chart terbaru…' : 'Chart belum tersedia saat ini')}</p><p className="mt-2 text-xs leading-6 text-muted">{t(trendingError || 'Saat sumber tersedia, lagu populer akan muncul di sini. Kamu tetap bisa menjelajahi katalog di bawah.')}</p></div>}
    </section>
    <section aria-labelledby="discover-heading">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="eyebrow mb-2">{t('Di luar suasana sekarang')}</p><h2 id="discover-heading" className="section-heading">{t('Pilihan untuk dijelajahi')}</h2></div><button type="button" aria-label={t('Perbarui katalog')} onClick={onRefresh} disabled={!online || refreshBusy} className="icon-button clay-surface"><RefreshCw size={17} className={refreshBusy ? 'motion-safe:animate-spin' : ''} /></button></div>
      {initialBusy && !discovery.tracks.length ? <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton aspect-square" />)}</div> : discovery.tracks.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">{discovery.tracks.slice(0, 8).map(track => <TrackCard key={track.id} track={track} onPlay={() => onPlay(track, discovery.tracks)} onOpen={() => onOpen(track, discovery.tracks)} onArtist={onArtist} active={current?.id === track.id} playing={playing} busy={Boolean(preparing[track.id])} />)}</div> : <div className="clay-panel empty-state"><Headphones className="text-muted" size={30} /><h3 className="text-base font-bold">{t('Mulai dari lagu yang kamu suka')}</h3><p className="muted-copy">{t('Katalog belum tersedia. Cari judul atau nama artis untuk memulai.')}</p><button type="button" onClick={() => onSearch('lagu Indonesia')} className="clay-button">{t('Jelajahi musik Indonesia')}</button></div>}

    </section>
  </div>
}

function MoodCard({ name, description, image, query, onSearch, light = false }) {
  const reduced = useReducedMotion()
  return <motion.button type="button" data-light={light} onClick={() => onSearch(query)} whileTap={reduced ? undefined : { scale: motionTokens.scale.press }} transition={springs.gentle} className="genre-card !min-h-[156px]"><img src={image} alt="" loading="lazy" /><span className="text-[15px] font-extrabold tracking-tight">{name}</span><span className="mt-1 text-[10px] opacity-85">{description}</span></motion.button>
}

function Genre({ name, query, onSearch }) {
  return <button type="button" onClick={() => onSearch(query)} className="min-h-11 shrink-0 rounded-[14px] border border-line bg-surface/50 px-4 text-xs font-semibold text-muted hover:border-accent/40 hover:text-accent">{name}</button>
}

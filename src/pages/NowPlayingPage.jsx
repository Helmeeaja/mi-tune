import { useTranslation } from "../lib/i18n.jsx";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, Download, ListPlus, Plus, Volume2, VolumeX, Check, FileText, ArrowLeft, LoaderCircle, Search, Disc3, Focus } from 'lucide-react';
import Cover from '../components/Cover.jsx';
import { Cassette, Equalizer } from '../components/MusicMotion.jsx';
import { time } from '../components/TrackRow.jsx';
import { motionTokens, springs } from '../lib/motion.js';
import { centeredScroll, lyricPadding } from '../lib/lyric-scroll.mjs';
import { ArtistNames } from '../components/CatalogCards.jsx';
import { SearchResults } from './SearchPage.jsx';
export default function NowPlayingPage({
  track,
  detailBusy,
  detailError,
  current,
  playing,
  position,
  duration,
  volume,
  muted,
  shuffle,
  repeat,
  busy,
  playbackStatus,
  playbackError,
  playbackErrorCode,
  lyrics,
  lyricsBusy,
  lyricsError = '',
  lines,
  activeLine,
  followLyrics = true,
  lyricOffset = 0,
  animations = true,
  onFollowLyrics,
  favorite,
  downloaded,
  onBack,
  onPlay,
  onToggle,
  onSeek,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onMute,
  onVolume,
  onFavorite,
  onDownload,
  onPlaylist,
  onQueue,
  onImport,
  onRefreshLyrics,
  onArtist,
  onAlbum,
  searchArtists = [],
  searchPlaylists = [],
  onPublicPlaylist,
  onUser,
  searchAlbums = [],
  searchWarnings = [],
  searchQuery,
  results,
  searchBusy,
  searchError,
  renderTracks,
  suggestions,
  onFocusSearch
}) {
  const {
    t,
    locale
  } = useTranslation();
  const reduced = useReducedMotion();
  const lyricContainer = useRef(null);
  const lyricPanel = useRef(null);
  const center = useRef(() => {});
  const isCurrent = current?.id === track?.id;
  const livePosition = isCurrent ? position : 0;
  const liveDuration = isCurrent ? duration || track?.duration : track?.duration;
  const [followPaused, setFollowPaused] = useState(false);
  const following = followLyrics && !followPaused;
  useEffect(() => {
    setFollowPaused(false);
  }, [track?.id]);
  center.current = (smooth = true) => {
    const container = lyricContainer.current;
    const active = container?.querySelector('[data-active="true"]');
    if (!active || !isCurrent || !following) return;
    const bounds = container.getBoundingClientRect();
    const line = active.getBoundingClientRect();
    const top = centeredScroll({
      scrollTop: container.scrollTop,
      viewportTop: bounds.top + container.clientTop,
      viewportHeight: container.clientHeight,
      lineTop: line.top,
      lineHeight: line.height,
      maxScroll: container.scrollHeight - container.clientHeight
    });
    container.scrollTo({
      top,
      behavior: smooth && !reduced && animations ? 'smooth' : 'instant'
    });
  };
  useLayoutEffect(() => {
    const container = lyricContainer.current;
    const panel = lyricPanel.current;
    if (!container || !panel) return;
    const dock = document.querySelector('.player-dock');
    const header = document.querySelector('header');
    const footer = panel.querySelector('[data-lyric-footer]');
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headerHeight = header?.getBoundingClientRect().height || 80;
        document.documentElement.style.setProperty('--shell-header-height', `${headerHeight}px`);
        const top = Math.max(headerHeight + 12, container.getBoundingClientRect().top);
        const bottom = dock?.getBoundingClientRect().top || window.innerHeight - 96;
        const mobile = window.matchMedia('(max-width: 1023px)').matches;
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const navigationHeight = document.querySelector('.mobile-nav')?.getBoundingClientRect().height || 68;
        const height = mobile ? Math.max(220, Math.min(440, Math.floor(viewportHeight - headerHeight - navigationHeight - (footer?.offsetHeight || 48) - 40))) : Math.max(140, Math.min(578, Math.floor(bottom - top - (footer?.offsetHeight || 48) - 16)));
        if (container.style.height !== `${height}px`) container.style.height = `${height}px`;
        const list = container.querySelector('[data-lyric-lines]');
        if (list?.children.length) {
          const first = list.firstElementChild;
          const last = list.lastElementChild;
          const padding = lyricPadding(container.clientHeight, first.offsetHeight, last.offsetHeight);
          list.style.paddingTop = `${padding.top}px`;
          list.style.paddingBottom = `${padding.bottom}px`;
        }
        center.current(false);
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (header) observer.observe(header);
    if (dock) observer.observe(dock);
    if (footer) observer.observe(footer);
    const list = container.querySelector('[data-lyric-lines]');
    if (list) observer.observe(list);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [track?.id, lines, lyricsBusy]);
  useEffect(() => {
    center.current();
  }, [activeLine, track?.id, isCurrent, reduced, animations, followLyrics, followPaused]);
  if (detailBusy && !track) return <div className="clay-panel grid gap-8 p-6 lg:grid-cols-2"><div className="skeleton aspect-square" /><div className="space-y-5"><div className="skeleton h-9 w-3/4" /><div className="skeleton h-5 w-1/2" /><div className="skeleton h-64" /></div></div>;
  if (!track) return <div className="clay-panel empty-state"><span className="empty-icon"><Disc3 size={30} /></span><h1 className="page-heading">{t("Lagu ini belum tersedia")}</h1><p role="alert" className="muted-copy">{t(detailError || 'Pilih lagu lain untuk mulai mendengarkan.')}</p><button type="button" onClick={onBack} className="clay-button">{t("Jelajahi musik")}</button></div>;
  return <div data-page="now-playing" className="space-y-7">
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={17} />{t("Jelajahi musik")}</button><span className="flex items-center gap-2 rounded-full bg-sage/65 px-3 py-2 text-[10px] font-bold text-muted"><Equalizer playing={isCurrent && playing} />{isCurrent && playing ? t("Lagi diputar") : t("Pilihanmu")}</span></div>
    <div className="now-playing-layout grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-label={t("Detail dan kontrol lagu")} className="clay-panel now-playing-detail min-w-0 p-5 sm:p-7">
        <div className="now-playing-artwork mx-auto mb-7 w-full max-w-[320px]"><div className="album-frame"><Cover track={track} eager className="aspect-square w-full !rounded-[20px]" /></div></div>
        <div className="mb-6 text-center"><p className="eyebrow mb-2">{track.albumId && onAlbum ? <a href={`/album/${encodeURIComponent(track.albumId)}`} onClick={event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onAlbum({
                id: track.albumId
              });
            }} className="underline-offset-4 hover:underline">{track.album}</a> : track.album || t("Single")}</p><h1 className="text-2xl font-extrabold leading-tight tracking-[-.04em] sm:text-[30px]">{track.title}</h1><p className="mt-2 text-sm text-muted"><ArtistNames track={track} onArtist={onArtist} /></p></div>
        {busy && <p role="status" className="mb-4 flex items-center justify-center gap-2 text-xs text-muted"><LoaderCircle size={15} className="motion-safe:animate-spin" />{t(playbackStatus || 'Memuat lagumu…')}</p>}
        {isCurrent && playbackError && <p role="alert" className="notice mb-5">{t(playbackError)}</p>}
        <div><label className="sr-only" htmlFor="detail-seek">{t("Posisi lagu")}</label><input id="detail-seek" type="range" min="0" max={liveDuration || 1} step="0.1" value={Math.min(livePosition, liveDuration || 1)} disabled={!isCurrent || !duration} onChange={event => onSeek(Number(event.target.value))} className="block h-8 w-full cursor-pointer" /><div className="flex justify-between text-[10px] tabular-nums text-muted"><span>{time(livePosition)}</span><span>{time(liveDuration)}</span></div></div>
        <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
          <button type="button" aria-label={t("Acak antrean di halaman lagu")} aria-pressed={shuffle} disabled={!current} onClick={onShuffle} className={`icon-button ${shuffle ? 'text-accent' : ''}`}><Shuffle size={18} /></button>
          <button type="button" aria-label={t("Lagu sebelumnya di halaman lagu")} disabled={!current} onClick={onPrevious} className="icon-button text-ink"><SkipBack size={22} fill="currentColor" /></button>
          <motion.button type="button" aria-label={t("{value0} di halaman lagu", {
            value0: isCurrent && playing ? t('Jeda musik') : t('Putar musik')
          })} onClick={() => isCurrent && !playbackError ? onToggle() : onPlay(track)} whileTap={reduced ? undefined : {
            scale: motionTokens.scale.press
          }} transition={springs.snappy} className="play-button !size-16 !rounded-[22px]">{busy ? <LoaderCircle size={25} className="motion-safe:animate-spin" /> : isCurrent && playing ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" className="ml-1" />}</motion.button>
          <button type="button" aria-label={t("Lagu berikutnya di halaman lagu")} disabled={!current} onClick={onNext} className="icon-button text-ink"><SkipForward size={22} fill="currentColor" /></button>
          <button type="button" aria-label={t("Ulangi di halaman lagu: {value0}", {
            value0: repeat === 'off' ? t('mati') : repeat === 'one' ? t('satu') : t('semua')
          })} onClick={onRepeat} className={`icon-button ${repeat !== 'off' ? 'text-accent' : ''}`}>{repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}</button>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2"><button type="button" aria-label={t("{value0} lagu ini", {
            value0: favorite ? t('Hapus favorit') : t('Favoritkan')
          })} aria-pressed={favorite} onClick={() => onFavorite(track)} className={`icon-button clay-surface ${favorite ? 'text-accent' : ''}`}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button><button type="button" aria-label={t("Tambahkan lagu ini ke playlist")} onClick={() => onPlaylist(track)} className="icon-button clay-surface"><Plus size={19} /></button><button type="button" aria-label={t("Antrekan lagu ini")} onClick={() => onQueue(track)} className="icon-button clay-surface"><ListPlus size={18} /></button><button type="button" aria-label={downloaded ? t("Lagu ini tersedia offline") : t("Unduh lagu ini")} disabled={downloaded} onClick={() => onDownload(track)} className={`icon-button clay-surface ${downloaded ? 'text-accent' : ''}`}>{downloaded ? <Check size={17} /> : <Download size={17} />}</button></div>
        <div className="mx-auto mt-5 flex max-w-[200px] items-center gap-2"><button type="button" aria-label={muted ? t("Aktifkan suara di halaman lagu") : t("Bisukan di halaman lagu")} onClick={onMute} className="icon-button !size-9">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><input type="range" aria-label={t("Volume di halaman lagu")} min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={event => onVolume(Number(event.target.value))} className="h-8 min-w-0 flex-1" /></div>
        <Cassette playing={isCurrent && playing} className="mx-auto mt-7 hidden sm:block" title={t("Mi Tune · sedang didengar")} />
      </section>
      <aside ref={lyricPanel} aria-label={t("Lirik lagu")} className="clay-panel lyrics-panel min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line p-5 sm:px-6"><div className="min-w-0"><p className="eyebrow mb-1.5 truncate">{track.title}</p><h2 className="section-heading">{t("Lirik")}</h2></div><div className="flex shrink-0 gap-1"><button type="button" aria-label={following ? t("Matikan ikuti lirik") : t("Ikuti lirik yang diputar")} aria-pressed={following} onClick={() => {
              if (followPaused && followLyrics) setFollowPaused(false);else {
                setFollowPaused(false);
                onFollowLyrics();
              }
            }} title={following ? t("Ikuti lirik aktif") : t("Klik untuk mengikuti lagi")} className={`icon-button ${following ? 'bg-surface text-accent' : ''}`}><Focus size={17} /></button><button type="button" aria-label={t("Impor lirik LRC")} onClick={() => onImport(track)} className="icon-button bg-surface/75"><FileText size={17} /></button></div></div>
        <div ref={lyricContainer} data-lenis-prevent tabIndex={0} aria-label={t("Teks lirik")} onWheelCapture={event => {
          if (event.deltaY) setFollowPaused(true);
        }} onTouchStart={() => setFollowPaused(true)} onPointerDownCapture={event => {
          if (event.target === event.currentTarget) setFollowPaused(true);
        }} onKeyDown={event => {
          if (event.target === event.currentTarget && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
            setFollowPaused(true);
            event.stopPropagation();
          }
        }} className="scroll-area lyrics-viewport relative overflow-y-auto px-2 sm:px-3">
          {lyricsBusy ? <div className="flex h-full items-center justify-center gap-3 text-sm text-muted"><LoaderCircle size={19} className="motion-safe:animate-spin" />{t("Mencari lirik…")}</div> : lyrics.instrumental ? <div className="empty-state h-full"><span className="empty-icon"><Disc3 size={29} /></span><h3 className="text-lg font-bold">{t("Cukup nikmati musiknya.")}</h3><p className="muted-copy">{t("Lagu ini instrumental.")}</p></div> : lines.length > 0 ? <div data-lyric-lines>{lines.map((line, index) => <button type="button" key={`${line.time}-${index}`} data-lyric-index={index} data-active={isCurrent && index === activeLine} aria-current={isCurrent && index === activeLine ? 'true' : undefined} aria-label={t("Lompat ke lirik: {value0}", {
              value0: line.text || t('jeda')
            })} disabled={!isCurrent} onClick={() => onSeek(Math.max(0, line.time - lyricOffset))} className="lyric-line disabled:cursor-default">{line.text || t("···")}</button>)}</div> : lyrics.plainLyrics ? <p className="whitespace-pre-wrap px-5 py-8 text-lg font-semibold leading-10 text-muted">{lyrics.plainLyrics}</p> : <div className="empty-state h-full !gap-3 !px-4 !py-6"><span className="empty-icon !size-12"><FileText size={24} /></span><h3 className="text-lg font-bold">{lyricsError ? t("Liriknya belum bisa dimuat.") : t("Liriknya belum ketemu.")}</h3><p className="max-w-xs text-xs leading-6 text-muted">{t(lyricsError || 'Kami belum menemukan lirik yang cocok untuk lagu ini.')}</p><button type="button" onClick={onRefreshLyrics} className="clay-button !min-h-10">{t("Cari lagi")}</button><button type="button" onClick={() => onImport(track)} className="min-h-11 text-xs font-bold text-accent">{t("Punya file LRC? Tambahkan")}</button></div>}
        </div>
        <div data-lyric-footer className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3"><p className="text-[10px] text-muted">{lines.length ? following ? t("Mengikuti musik · ketuk baris untuk lompat") : followPaused && followLyrics ? t("Dijeda saat kamu menggulir") : t("Auto-scroll mati · gulir sesukamu") : lyrics.plainLyrics ? t("Belum tersinkron · tanpa penanda waktu") : t("Hanya lirik yang cocok dengan lagu ini")}</p>{lines.length > 0 && followPaused && followLyrics ? <button type="button" onClick={() => setFollowPaused(false)} className="flex min-h-11 items-center gap-1.5 px-2 text-[11px] font-bold text-accent"><Focus size={13} />{t("Ikuti lagi")}</button> : lyrics.source && <span className="text-[10px] font-bold text-muted">{lyrics.source}</span>}</div>
      </aside>
    </div>
    <section aria-label={t("Jelajahi musik")} className="clay-panel p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 px-2"><div><h2 className="section-heading">{searchQuery ? t("Hasil untuk “{value0}”", {
              value0: searchQuery
            }) : t("Lagu berikutnya?")}</h2><p className="mt-2 text-xs text-muted">{t("Cari musik tanpa menghentikan lagu ini.")}</p></div><button type="button" onClick={onFocusSearch} aria-label={t("Fokus pencarian lagu")} className="icon-button clay-surface"><Search size={17} /></button></div>
      {searchQuery ? <SearchResults results={results} artists={searchArtists} albums={searchAlbums} playlists={searchPlaylists} onPublicPlaylist={onPublicPlaylist} onUser={onUser} warnings={searchWarnings} renderTracks={renderTracks} onArtist={onArtist} onAlbum={onAlbum} busy={searchBusy} error={searchError} /> : renderTracks(suggestions.slice(0, 5))}
    </section>
  </div>;
}

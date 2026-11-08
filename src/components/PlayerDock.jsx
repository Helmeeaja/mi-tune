import { useTranslation } from "../lib/i18n.jsx";
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic, FileText, Heart, ChevronUp, LoaderCircle, Disc3 } from 'lucide-react';
import Cover from './Cover.jsx';
import { time } from './TrackRow.jsx';
import { motionTokens, springs } from '../lib/motion.js';
import { isPodcastEpisode } from '../lib/podcasts.mjs';
export default function PlayerDock({
  track,
  playing,
  position,
  duration,
  volume,
  muted,
  shuffle,
  repeat,
  busy,
  status,
  favorite,
  onDetail,
  onPlay,
  onSeek,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onMute,
  onVolume,
  onFavorite,
  onQueue,
  onTranscript = onDetail,
  standalone = false
}) {
  const {
    t,
    locale
  } = useTranslation();
  const reduced = useReducedMotion();
  const episode = isPodcastEpisode(track);
  return <section aria-label={t(episode ? 'Pemutar podcast' : 'Pemutar musik')} className={`player-dock left-3 right-3 px-3 py-2.5 sm:px-4 lg:bottom-4 lg:right-5 ${standalone ? 'bottom-[calc(12px_+_env(safe-area-inset-bottom))] lg:left-5' : 'bottom-[calc(76px_+_env(safe-area-inset-bottom))] lg:left-[244px]'}`}>
    <div className="flex items-center gap-3 lg:grid lg:grid-cols-[minmax(150px,1fr)_minmax(260px,1.2fr)_minmax(120px,.7fr)] lg:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3"><button type="button" aria-label={track ? t("Buka detail {value0}", {
          value0: track.title
        }) : t("Pilih lagu untuk diputar")} disabled={!track} onClick={onDetail} className="shrink-0 rounded-[14px] disabled:cursor-default">{track ? <Cover track={track} className="size-11 !rounded-[12px]" /> : <span className="grid size-11 place-items-center rounded-[14px] bg-sage text-muted"><Disc3 size={21} strokeWidth={1.5} /></span>}</button><button type="button" disabled={!track} onClick={onDetail} className="min-w-0 flex-1 text-left disabled:cursor-default"><span className="block truncate text-xs font-bold">{track?.title || t("Musik yang ingin kamu dengar.")}</span><span className="mt-1 block truncate text-[10px] text-muted">{busy ? t(status || 'Menyiapkan audio…') : track?.artist || t("Pilih satu lagu untuk memulai")}</span></button><button type="button" aria-label={t("Favoritkan lagu sekarang")} aria-pressed={favorite} disabled={!track || episode} onClick={onFavorite} className={`icon-button hidden !size-9 xl:inline-grid ${favorite ? 'text-accent' : ''}`}><Heart size={16} fill={favorite ? 'currentColor' : 'none'} /></button></div>
      <div className="hidden min-w-0 lg:block"><div className="flex items-center justify-center gap-3"><button type="button" aria-label={t("Acak antrean")} aria-pressed={shuffle} onClick={onShuffle} className={`icon-button !size-8 ${shuffle ? 'text-accent' : ''}`}><Shuffle size={15} /></button><button type="button" aria-label={t(episode ? "Episode sebelumnya" : "Lagu sebelumnya")} disabled={!track} onClick={onPrevious} className="icon-button !size-8 text-ink"><SkipBack size={18} fill="currentColor" /></button><motion.button type="button" aria-label={playing ? t("Jeda musik") : t("Putar musik")} disabled={!track} whileTap={reduced ? undefined : {
            scale: motionTokens.scale.press
          }} transition={springs.snappy} onClick={onPlay} className="play-button !size-10 !rounded-[14px]">{busy ? <LoaderCircle size={18} className="motion-safe:animate-spin" /> : playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}</motion.button><button type="button" aria-label={t(episode ? "Episode berikutnya" : "Lagu berikutnya")} disabled={!track} onClick={onNext} className="icon-button !size-8 text-ink"><SkipForward size={18} fill="currentColor" /></button><button type="button" aria-label={t("Ulangi: {value0}", {
            value0: repeat === 'off' ? t('mati') : repeat === 'one' ? t('satu') : t('semua')
          })} onClick={onRepeat} className={`icon-button !size-8 ${repeat !== 'off' ? 'text-accent' : ''}`}>{repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}</button></div><div className="mt-1 flex items-center gap-2"><span className="w-7 text-[9px] tabular-nums text-muted">{time(position)}</span><input type="range" aria-label={t("Posisi pemutaran")} min="0" max={duration || track?.duration || 1} step="0.1" value={Math.min(position, duration || track?.duration || 1)} disabled={!duration} onChange={event => onSeek(Number(event.target.value))} className="h-5 min-w-0 flex-1 cursor-pointer" /><span className="w-7 text-right text-[9px] tabular-nums text-muted">{time(duration || track?.duration)}</span></div></div>
      <div className="hidden items-center justify-end gap-1 lg:flex"><button type="button" aria-label={t(episode ? "Transkrip" : "Buka lirik")} title={t(episode ? "Transkrip" : "Buka lirik dan detail")} disabled={!track} onClick={onTranscript} className="icon-button !size-9"><FileText size={16} /></button><button type="button" aria-label={t("Buka antrean")} title={t("Antrean pemutaran")} onClick={onQueue} className="icon-button !size-9"><ListMusic size={18} /></button><button type="button" aria-label={muted ? t("Aktifkan suara") : t("Bisukan")} onClick={onMute} className="icon-button !size-9">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input type="range" aria-label={t("Volume")} min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={event => onVolume(Number(event.target.value))} className="hidden h-7 w-16 xl:block" /></div>
      <div className="flex shrink-0 items-center gap-1 lg:hidden"><motion.button type="button" aria-label={playing ? t("Jeda musik") : t("Putar musik")} disabled={!track} onClick={onPlay} whileTap={reduced ? undefined : {
          scale: motionTokens.scale.press
        }} className="play-button !size-10 !rounded-[14px]">{busy ? <LoaderCircle size={18} className="motion-safe:animate-spin" /> : playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}</motion.button><button type="button" aria-label={t("Buka antrean")} onClick={onQueue} className="icon-button !size-9"><ChevronUp size={20} /></button></div>
    </div>
    <div aria-hidden="true" className="absolute bottom-0 left-5 right-5 h-[3px] overflow-hidden rounded-full bg-line lg:hidden"><div className="h-full rounded-full bg-accent" style={{
        width: `${Math.min(100, position / (duration || track?.duration || 1) * 100)}%`
      }} /></div>
  </section>;
}

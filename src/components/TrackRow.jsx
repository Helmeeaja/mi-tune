import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Play, Pause, Heart, Download, ListPlus, Plus, Check, LoaderCircle, MoreHorizontal } from 'lucide-react'
import Cover from './Cover.jsx'
import Modal from './Modal.jsx'
import { ArtistNames } from './CatalogCards.jsx'
import { useTranslation } from '../lib/i18n.jsx'
import { motionTokens, springs } from '../lib/motion.js'

export function time(value) {
  if (!Number.isFinite(value)) return '0:00'
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function TrackRow({ track, onPlay, onOpen, onArtist, onFavorite, onDownload, onPlaylist, onQueue, favorite, downloaded, active, playing, busy, downloadBusy, trailing, index }) {
  const reduced = useReducedMotion()
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)

  function action(callback) {
    setMoreOpen(false)
    callback(track)
  }

  return <article data-track-id={track.id} data-track-index={index} data-active={active} className="track-row group relative">
    <a href={`/track/${encodeURIComponent(track.id)}`} aria-label={t('Buka dan putar {title}', { title: track.title })} data-track-open={track.id} className="absolute inset-0 z-[1] rounded-[20px]" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); (onOpen || onPlay)(track) }}><span className="sr-only">{t('Buka dan putar {title}', { title: track.title })}</span></a>
    <div className="pointer-events-none relative"><Cover track={track} className="size-12" />{track.chartRank > 0 && <span data-chart-rank={track.chartRank} className="absolute -bottom-1 -left-1 grid min-w-5 place-items-center rounded-lg bg-ink px-1 text-[10px] font-bold text-white">{track.chartRank}</span>}</div>
    <div className="pointer-events-none min-w-0"><h3 className={`truncate text-sm font-bold ${active ? 'text-accent' : ''}`}>{track.title}</h3><p className="mt-1 truncate text-xs text-muted"><ArtistNames track={track} onArtist={onArtist} /><span className="mx-2 text-muted/55">·</span>{time(track.duration)}</p></div>
    <button type="button" aria-label={t('Opsi untuk {title}', { title: track.title })} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className="track-more icon-button relative z-10 lg:hidden"><MoreHorizontal size={21} /></button>
    <div className="track-actions relative z-10" onClick={event => event.stopPropagation()}>
      <motion.button type="button" aria-label={t(favorite ? 'Hapus favorit {title}' : 'Favoritkan {title}', { title: track.title })} aria-pressed={favorite} title={t(favorite ? 'Hapus favorit' : 'Simpan favorit')} whileTap={reduced ? undefined : { scale: motionTokens.scale.press }} transition={springs.snappy} onClick={() => onFavorite(track)} className={`icon-button ${favorite ? 'text-accent' : ''}`}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></motion.button>
      <button type="button" aria-label={t(downloaded ? 'Tersimpan offline {title}' : 'Unduh {title}', { title: track.title })} title={t(downloaded ? 'Tersimpan offline' : 'Unduh untuk offline')} disabled={downloaded || downloadBusy} onClick={() => onDownload(track)} className={`icon-button ${downloaded ? 'text-accent' : ''}`}>{downloadBusy ? <LoaderCircle size={17} className="motion-safe:animate-spin" /> : downloaded ? <Check size={17} /> : <Download size={17} />}</button>
      <button type="button" aria-label={t('Tambah {title} ke playlist', { title: track.title })} title={t('Tambahkan ke playlist')} onClick={() => onPlaylist(track)} className="icon-button"><Plus size={18} /></button>
      <button type="button" aria-label={t('Antrekan {title}', { title: track.title })} title={t('Tambahkan ke antrean')} onClick={() => onQueue(track)} className="icon-button"><ListPlus size={18} /></button>
      {trailing && <div className="flex items-center border-l border-line pl-1">{trailing}</div>}
    </div>
    <motion.button type="button" aria-label={t(active && playing ? 'Jeda {title}' : 'Putar {title}', { title: track.title })} whileTap={reduced ? undefined : { scale: motionTokens.scale.press }} transition={springs.snappy} onClick={event => { event.stopPropagation(); onPlay(track) }} className={`track-play relative z-10 col-start-3 row-start-1 grid size-11 place-items-center rounded-[15px] disabled:opacity-45 sm:col-start-4 ${active ? 'bg-accent text-[color:var(--color-accent-contrast)]' : 'bg-accent-light/45 text-accent hover:bg-accent-light'}`}>{busy ? <LoaderCircle size={19} className="motion-safe:animate-spin" /> : active && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}</motion.button>
    {moreOpen && <Modal title={track.title} onClose={() => setMoreOpen(false)}><div className="track-menu-actions">
      <div className="track-menu-summary"><Cover track={track} className="size-14 shrink-0" /><p>{track.artist}<span>{time(track.duration)}</span></p></div>
      <button type="button" onClick={() => action(onFavorite)} aria-pressed={favorite}><Heart size={21} fill={favorite ? 'currentColor' : 'none'} /><span>{t(favorite ? 'Hapus favorit' : 'Simpan favorit')}</span></button>
      <button type="button" onClick={() => action(onPlaylist)}><Plus size={21} /><span>{t('Tambahkan ke playlist')}</span></button>
      <button type="button" onClick={() => action(onQueue)}><ListPlus size={21} /><span>{t('Tambahkan ke antrean')}</span></button>
      <button type="button" disabled={downloaded || downloadBusy} onClick={() => action(onDownload)}>{downloadBusy ? <LoaderCircle size={21} className="motion-safe:animate-spin" /> : downloaded ? <Check size={21} /> : <Download size={21} />}<span>{t(downloadBusy ? 'Menyiapkan unduhan…' : downloaded ? 'Tersimpan offline' : 'Unduh untuk offline')}</span></button>
      <button type="button" onClick={() => action(onOpen || onPlay)}><Play size={21} /><span>{t('Buka lirik dan detail')}</span></button>
      {trailing && <div className="track-menu-management"><p>{t('Kelola lagu')}</p><div>{trailing}</div></div>}
    </div></Modal>}
  </article>
}

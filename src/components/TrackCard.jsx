import { motion, useReducedMotion } from 'framer-motion'
import { Play, Pause, LoaderCircle } from 'lucide-react'
import Cover from './Cover.jsx'
import { ArtistNames } from './CatalogCards.jsx'
import { useTranslation } from '../lib/i18n.jsx'
import { motionTokens, springs } from '../lib/motion.js'

export default function TrackCard({ track, onPlay, onOpen, onArtist, active, playing, busy }) {
  const reduced = useReducedMotion()
  const { t } = useTranslation()
  return <article data-track-id={track.id} className="min-w-0">
    <motion.button type="button" aria-label={t(active && playing ? 'Jeda pilihan {title}' : 'Putar pilihan {title}', { title: track.title })} onClick={() => onPlay(track)} whileTap={reduced ? undefined : { scale: motionTokens.scale.press }} transition={springs.gentle} className="clay-surface group relative block w-full p-2.5 text-left disabled:opacity-65">
      <Cover track={track} className="aspect-square w-full !rounded-[16px]" />
      <span className="play-button absolute bottom-5 right-5 size-11 !rounded-[15px]">{busy ? <LoaderCircle size={18} className="motion-safe:animate-spin" /> : active && playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}</span>
    </motion.button>
    <h3 className="mt-3 truncate px-1 text-sm font-bold"><a href={`/track/${encodeURIComponent(track.id)}`} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); (onOpen || onPlay)(track) }} className="hover:text-accent">{track.title}</a></h3><p className="mt-1 truncate px-1 text-xs text-muted"><ArtistNames track={track} onArtist={onArtist} /></p>
  </article>
}

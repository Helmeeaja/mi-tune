import { useEffect, useState } from 'react'
import { Disc3, Mic2 } from 'lucide-react'
import { useTranslation } from '../lib/i18n.jsx'
import { isPodcastEpisode } from '../lib/podcasts.mjs'

export default function Cover({ track, className = '', eager = false }) {
  const [failed, setFailed] = useState(false)
  const { t } = useTranslation()
  const ArtworkIcon = isPodcastEpisode(track) ? Mic2 : Disc3
  useEffect(() => setFailed(false), [track?.id, track?.coverUrl])
  return <div className={`track-art relative shrink-0 overflow-hidden ${className}`}>
    {track?.thumbnail && !failed ? <img src={track.coverUrl || track.thumbnail} alt={t('Sampul {title}', { title: track.title })} width={512} height={512} className="size-full object-cover" loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <div className="grid size-full place-items-center bg-sage text-ink/60"><ArtworkIcon className="size-[42%]" strokeWidth={1.25} aria-hidden="true" /></div>}
  </div>
}

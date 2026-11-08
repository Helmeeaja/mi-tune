import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Play, Pause } from 'lucide-react'
import Cover from './Cover.jsx'
import { springs } from '../lib/motion.js'
import { useTranslation } from '../lib/i18n.jsx'

export function Cassette({ playing = false, className = '', title = 'Mi Tune · A' }) {
  const reference = useRef(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    if (!playing) return
    let inView = true
    const update = () => setVisible(inView && !document.hidden)
    const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update() })
    if (reference.current) observer.observe(reference.current)
    document.addEventListener('visibilitychange', update)
    update()
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [playing])
  return <div ref={reference} aria-hidden="true" data-playing={playing && visible} className={`cassette ${className}`}>
    <div className="cassette-label"><span>{title}</span><span>stereo</span></div>
    <div className="cassette-window"><span className="cassette-reel"><i /><i /><i /></span><span className="cassette-tape" /><span className="cassette-reel"><i /><i /><i /></span></div>
    <div className="cassette-bottom"><span /><span /></div>
  </div>
}

export function Equalizer({ playing = false, className = '' }) {
  return <span aria-hidden="true" data-playing={playing} className={`music-equalizer ${className}`}><i /><i /><i /><i /></span>
}

export function RecordStack({ tracks, current, playing, enabled = true, onPlay }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const reference = useRef(null)
  const [front, setFront] = useState(0)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const cards = tracks.slice(0, 3)
  const count = cards.length

  useEffect(() => {
    setFront(0)
  }, [tracks[0]?.id])

  useEffect(() => {
    let inView = true
    const visibility = () => setVisible(inView && !document.hidden)
    const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; visibility() }, { threshold: 0.15 })
    if (reference.current) observer.observe(reference.current)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => {
    if (!enabled || reduced || !visible || paused || interacting || count < 2) return
    const timer = setInterval(() => setFront(value => (value + 1) % count), 6500)
    return () => clearInterval(timer)
  }, [enabled, reduced, visible, paused, interacting, count])

  const selected = cards[front % (count || 1)]
  return <div ref={reference} className="record-stack" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false) }}>
    <div className="stack-stage">
      {cards.map((track, index) => {
        const slot = (index - (front % count) + count) % count
        const transform = slot === 0 ? { x: -12, y: 0, rotate: -5, scale: 1 } : slot === 1 ? { x: 13, y: -16, rotate: 5, scale: 0.94 } : { x: 31, y: -29, rotate: 11, scale: 0.88 }
        return <motion.div key={track.id} data-stack-slot={slot} initial={false} animate={transform} transition={enabled && !reduced ? springs.gentle : { duration: 0 }} className="album-frame stack-card" style={{ zIndex: count - slot }} aria-hidden={slot !== 0}>
          <Cover track={track} eager={slot === 0} className="aspect-square w-full !rounded-[20px]" />
        </motion.div>
      })}
      {!count && <img src="/artwork/studio.jpg" alt={t('Koleksi piringan hitam')} className="album-frame stack-card object-cover" />}
    </div>
    {selected && <button type="button" onClick={() => onPlay(selected, tracks)} className="clay-panel stack-caption group" aria-label={t(playing && current?.id === selected.id ? 'Jeda pilihan {title}' : 'Putar pilihan {title}', { title: selected.title })}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-light text-accent">{playing && current?.id === selected.id ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</span><span className="min-w-0 flex-1 text-left"><span className="eyebrow !text-[9px]">{t('Pilihan pembuka')}</span><span className="mt-1 block truncate text-xs font-bold">{selected.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted">{selected.artist}</span></span>
    </button>}
    {count > 1 && <div className="stack-switches"><button type="button" onClick={() => setPaused(value => !value)} className="stack-pause" aria-label={t(paused ? 'Lanjutkan pergantian sampul' : 'Jeda pergantian sampul')} aria-pressed={paused}>{paused ? <Play size={11} /> : <Pause size={11} />}</button>{cards.map((track, index) => <button type="button" key={track.id} aria-label={t('Lihat {title}', { title: track.title })} aria-pressed={front === index} onClick={() => { setFront(index); setPaused(true) }} className="stack-dot" />)}</div>}
  </div>
}

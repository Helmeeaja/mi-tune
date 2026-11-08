import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FileText, Upload, LoaderCircle, RefreshCw, Focus } from 'lucide-react'
import { request } from '../lib/api.js'
import { getActiveLyricIndex } from '../lib/lyrics.mjs'
import { parseTranscript } from '../lib/transcript.mjs'
import { centeredScroll, lyricPadding } from '../lib/lyric-scroll.mjs'
import { useTranslation } from '../lib/i18n.jsx'
import { time } from './TrackRow.jsx'

const sourceCache = new Map()

export default function PodcastTranscript({ episode, position, active, onSeek, owner = 'guest', onAuth }) {
  const { t, language } = useTranslation()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [following, setFollowing] = useState(true)
  const container = useRef(null)
  const input = useRef(null)
  const pending = useRef(null)
  const highlighted = useRef(null)
  const seek = useRef(onSeek)
  const key = `mi-tune-podcast-transcript:${owner}:${episode.id}`
  const cues = useMemo(() => data?.cues || [], [data])
  const selected = active ? getActiveLyricIndex(cues, position) : -1

  useLayoutEffect(() => { seek.current = onSeek }, [onSeek])

  useEffect(() => {
    const controller = new AbortController()
    pending.current = controller
    setData(null)
    setError('')
    setFollowing(true)
    setBusy(false)
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved?.episodeId === episode.id && typeof saved.text === 'string' && Array.isArray(saved.cues)) { setData(saved); return }
    } catch {}
    const cacheKey = `${language}:${episode.id}`
    const cached = sourceCache.get(cacheKey)
    if (!refresh && cached && Date.now() - cached.savedAt < (cached.data.available ? 86400000 : 300000)) { setData(cached.data); return }
    setBusy(true)
    request(`/podcasts/episodes/${encodeURIComponent(episode.id)}/transcript?language=${language}${refresh ? '&refresh=1' : ''}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      if (result.episodeId !== episode.id || !Array.isArray(result.cues)) throw new Error('Transkrip dari sumbernya belum bisa dimuat. Kamu bisa impor teks sendiri.')
      sourceCache.delete(cacheKey)
      sourceCache.set(cacheKey, { data: result, savedAt: Date.now() })
      while (sourceCache.size > 4) sourceCache.delete(sourceCache.keys().next().value)
      setData(result)
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [episode.id, key, language, refresh])

  const rows = useMemo(() => cues.map((cue, index) => <button type="button" key={`${cue.time}-${index}`} data-cue={index} disabled={!active} onClick={() => { seek.current?.(cue.time); setFollowing(true) }} aria-label={t('Lompat ke {position}', { position: time(cue.time) })} className={`mb-5 block w-full text-left text-lg font-bold leading-8 transition-opacity sm:text-xl ${active ? 'text-muted opacity-55' : 'text-ink'}`}><span className="mb-1 block text-[10px] font-medium opacity-60">{time(cue.time)}</span>{cue.text}</button>), [cues, active, t])

  useLayoutEffect(() => {
    highlighted.current?.style.removeProperty('color')
    highlighted.current?.style.removeProperty('opacity')
    highlighted.current?.removeAttribute('aria-current')
    const line = selected < 0 ? null : container.current?.querySelector(`[data-cue="${selected}"]`)
    if (line) { line.style.color = 'var(--color-ink)'; line.style.opacity = '1'; line.setAttribute('aria-current', 'true') }
    highlighted.current = line
  }, [selected, cues, active])

  useLayoutEffect(() => {
    const panel = container.current
    if (!panel) return
    const resize = () => {
      const first = panel.querySelector('[data-cue]')
      const last = panel.lastElementChild
      if (!first || !last) return
      const padding = lyricPadding(panel.clientHeight, first.getBoundingClientRect().height, last.getBoundingClientRect().height)
      panel.style.paddingTop = `${padding.top}px`
      panel.style.paddingBottom = `${padding.bottom}px`
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [cues])

  useEffect(() => {
    if (!following || selected < 0 || !container.current) return
    const panel = container.current
    const line = highlighted.current
    if (!line) return
    const view = panel.getBoundingClientRect()
    const box = line.getBoundingClientRect()
    panel.scrollTo({ top: centeredScroll({ scrollTop: panel.scrollTop, viewportTop: view.top, viewportHeight: panel.clientHeight, lineTop: box.top, lineHeight: box.height, maxScroll: panel.scrollHeight - panel.clientHeight }), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [selected, following])

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    pending.current?.abort()
    setBusy(false)
    setError('')
    try {
      if (file.size > 400000) throw new Error('File transkrip maksimal 400 KB.')
      const result = { ...parseTranscript(await file.text(), file.name), episodeId: episode.id }
      localStorage.setItem(key, JSON.stringify(result))
      setData(result)
    } catch (error) { setError(error.message) }
  }

  function updateTranscript() {
    try { localStorage.removeItem(key) } catch {}
    sourceCache.delete(`${language}:${episode.id}`)
    setRefresh(value => value + 1)
  }

  return <section aria-label={t('Transkrip podcast')} className="clay-panel min-w-0 overflow-hidden !rounded-[28px]" data-podcast-transcript={episode.id}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div className="flex items-center gap-3"><FileText size={18} /><h2 className="text-sm font-extrabold">{t('Transkrip')}</h2>{data?.automatic && <span className="rounded-full bg-sage px-2 py-1 text-[9px] font-bold text-muted">{t('Otomatis')}</span>}</div><div className="flex gap-1">{cues.length > 0 && <button type="button" onClick={() => setFollowing(value => !value)} aria-pressed={following} aria-label={t('Ikuti transkrip')} className="icon-button"><Focus size={17} /></button>}<button type="button" className="icon-button" disabled={busy} aria-label={t('Perbarui transkrip')} onClick={updateTranscript}><RefreshCw size={16} className={busy ? 'motion-safe:animate-spin' : ''} /></button><button type="button" className="icon-button" aria-label={t('Impor transkrip')} onClick={() => owner === 'guest' && onAuth ? onAuth() : input.current?.click()}><Upload size={17} /></button><input ref={input} type="file" accept=".txt,.vtt,.srt,.lrc" aria-label={t('File transkrip podcast')} className="hidden" onChange={importFile} /></div></div>
    {busy ? <div role="status" className="flex min-h-64 items-center justify-center gap-3 p-8 text-sm text-muted"><LoaderCircle size={20} className="motion-safe:animate-spin" />{t('Memuat transkrip…')}</div> : cues.length ? <div ref={container} className="scroll-area h-[440px] overflow-y-auto px-5 py-40 sm:px-7" data-lenis-prevent onWheel={() => setFollowing(false)} onTouchStart={() => setFollowing(false)}>{rows}</div> : data?.text ? <div className="scroll-area max-h-[440px] overflow-y-auto whitespace-pre-wrap break-words p-6 text-base leading-8" data-lenis-prevent>{data.text}</div> : <div className="flex min-h-64 flex-col items-start justify-center gap-3 p-6"><FileText size={28} className="text-muted" /><h3 className="text-lg font-extrabold">{t('Transkrip belum tersedia.')}</h3><p className="text-sm leading-7 text-muted">{t('Kalau punya naskahnya, impor TXT, SRT, VTT, atau LRC. Teks bertimestamp bisa mengikuti audio.')}</p><button type="button" onClick={() => owner === 'guest' && onAuth ? onAuth() : input.current?.click()} className="clay-button"><Upload size={16} />{t('Impor transkrip')}</button></div>}
    {error && <p role="status" className="border-t border-line px-5 py-3 text-xs leading-6 text-muted">{t(error)}</p>}
  </section>
}

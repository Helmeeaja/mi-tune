import { useEffect, useState } from 'react'
import { request } from './api.js'
import { readContextCache, saveContextCache, selectContextTracks } from './context-recommendations.mjs'

function cached(key) {
  try { return readContextCache(key, localStorage) } catch { return null }
}

export function useContextRecommendations({ context, greeting, online, active, dataSaver, remember }) {
  const [state, setState] = useState(() => cached(context.key) || { key: context.key, mixes: [], updatedAt: 0, stale: false, busy: false, error: '' })
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!active) return
    const available = cached(context.key)
    if (!online) { setState({ key: context.key, mixes: available?.mixes || [], updatedAt: available?.updatedAt || 0, stale: true, busy: false, error: '' }); return }
    const controller = new AbortController()
    const start = (greeting.index || 0) % context.queries.length
    const ordered = [...context.queries.slice(start), ...context.queries.slice(0, start)].slice(0, dataSaver ? 1 : 2)
    setState({ key: context.key, mixes: available?.mixes || [], updatedAt: available?.updatedAt || 0, stale: Boolean(available), busy: true, error: '' })
    Promise.allSettled(ordered.map(async query => {
      const data = await request(`/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      return { query, tracks: selectContextTracks(data, greeting.index) }
    })).then(results => {
      if (controller.signal.aborted) return
      const mixes = results.filter(result => result.status === 'fulfilled' && result.value.tracks.length).map(result => result.value)
      for (const mix of mixes) remember(mix.tracks)
      const next = mixes.length ? { key: context.key, mixes, updatedAt: Date.now(), stale: false, busy: false, error: '' } : { key: context.key, mixes: available?.mixes || [], updatedAt: available?.updatedAt || 0, stale: true, busy: false, error: 'Pilihan sesuai suasana belum dapat dimuat. Coba lagi sebentar.' }
      setState(next)
      if (mixes.length) { try { saveContextCache(next, localStorage) } catch { } }
    })
    return () => controller.abort()
  }, [context.key, context.stamp, greeting.index, online, active, dataSaver, refresh, remember])
  const current = state.key === context.key ? state : { key: context.key, mixes: [], updatedAt: 0, stale: false, busy: online && active, error: '' }
  return { ...current, tracks: current.mixes[0]?.tracks || [], refresh: () => setRefresh(value => value + 1) }
}

import { useEffect } from 'react'
import 'lenis/dist/lenis.css'

export default function SmoothScroll({ enabled = true }) {
  useEffect(() => {
    const pointer = matchMedia('(pointer: fine)')
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let lenis
    let frame = 0
    let version = 0
    let closed = false

    function stopFrame() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }

    function tick(time) {
      frame = 0
      lenis?.raf(time)
      if (lenis?.isScrolling === 'smooth') frame = requestAnimationFrame(tick)
    }

    function wake() {
      if (lenis && !frame && !document.hidden && !document.querySelector('dialog[open]')) frame = requestAnimationFrame(tick)
    }

    function synchronize() {
      if (document.hidden || document.querySelector('dialog[open]')) { lenis?.stop(); stopFrame() }
      else lenis?.start()
    }

    async function updateSettings() {
      const current = ++version
      stopFrame()
      lenis?.destroy()
      lenis = undefined
      delete document.documentElement.dataset.scrollExperience
      if (!enabled || reduced.matches || !pointer.matches) return
      try {
        const { default: Lenis } = await import('lenis')
        if (closed || current !== version) return
        lenis = new Lenis({
          autoRaf: false,
          duration: 0.85,
          smoothWheel: true,
          syncTouch: false,
          easing: value => 1 - Math.pow(1 - value, 3),
          prevent: node => Boolean(node.closest('[data-lenis-prevent],dialog'))
        })
        document.documentElement.dataset.scrollExperience = 'smooth'
        synchronize()
      } catch {}
    }

    const reset = () => { lenis?.resize(); lenis?.scrollTo(0, { immediate: true }); stopFrame() }
    updateSettings()
    pointer.addEventListener('change', updateSettings)
    reduced.addEventListener('change', updateSettings)
    window.addEventListener('wheel', wake, { passive: true })
    window.addEventListener('mi-tune:navigate', reset)
    document.addEventListener('visibilitychange', synchronize)
    window.addEventListener('mi-tune:dialog', synchronize)
    return () => {
      closed = true
      version += 1
      stopFrame()
      lenis?.destroy()
      pointer.removeEventListener('change', updateSettings)
      reduced.removeEventListener('change', updateSettings)
      window.removeEventListener('wheel', wake)
      window.removeEventListener('mi-tune:navigate', reset)
      window.removeEventListener('mi-tune:dialog', synchronize)
      document.removeEventListener('visibilitychange', synchronize)
      delete document.documentElement.dataset.scrollExperience
    }
  }, [enabled])

  return null
}

import { useEffect, useRef, useState } from 'react'
import { getListeningContext, chooseGreeting } from './atmosphere.mjs'

function currentAtmosphere() {
  const context = getListeningContext(new Date())
  return { context, greeting: chooseGreeting(context) }
}

export function useAtmosphere() {
  const [atmosphere, setAtmosphere] = useState(currentAtmosphere)
  const hiddenAt = useRef(null)
  useEffect(() => {
    let timer
    const update = (reopened = false) => {
      const context = getListeningContext(new Date())
      setAtmosphere(previous => context.stamp === previous.context.stamp && !reopened ? previous : { context, greeting: chooseGreeting(context) })
    }
    const tick = () => {
      if (!document.hidden) update()
      const now = new Date()
      timer = setTimeout(tick, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 20)
    }
    const visible = () => {
      if (document.hidden) hiddenAt.current = Date.now()
      else {
        const reopened = hiddenAt.current !== null && Date.now() - hiddenAt.current >= 30 * 60 * 1000
        hiddenAt.current = null
        update(reopened)
      }
    }
    const focus = () => { if (!document.hidden) update() }
    tick()
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', focus)
    window.addEventListener('pageshow', focus)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus) }
  }, [])
  return atmosphere
}

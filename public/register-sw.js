window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  window.miTuneInstallPrompt = event
  window.dispatchEvent(new Event('mi-tune:install-ready'))
})
window.addEventListener('appinstalled', () => {
  window.miTuneInstallPrompt = null
  window.dispatchEvent(new Event('mi-tune:installed'))
})
window.addEventListener('load', async () => {
  const development = [...document.scripts].some(script => script.src.includes('/@vite/client'))
  if (development || !window.isSecureContext || !('serviceWorker' in navigator)) return
  const controlled = Boolean(navigator.serviceWorker.controller)
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    function announceUpdate() {
      window.miTuneUpdateReady = true
      window.dispatchEvent(new Event('mi-tune:update-ready'))
    }
    if (registration.waiting && controlled) announceUpdate()
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && controlled) announceUpdate()
      })
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {})
    })
  } catch (error) {
    window.dispatchEvent(new CustomEvent('mi-tune:offline-error', { detail: error.message }))
  }
})

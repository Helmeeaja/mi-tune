window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  window.miTuneInstallPrompt = event
  window.dispatchEvent(new Event('mi-tune:install-ready'))
})
window.addEventListener('appinstalled', () => {
  window.miTuneInstallPrompt = null
  window.dispatchEvent(new Event('mi-tune:installed'))
})
window.addEventListener('load', () => {
  const development = [...document.scripts].some(script => script.src.includes('/@vite/client'))
  if (!development && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(error => {
      window.dispatchEvent(new CustomEvent('mi-tune:offline-error', { detail: error.message }))
    })
  }
})

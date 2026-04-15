import { logWarn } from '../lib/observability'

const registerServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  try {
    const base = import.meta.env.BASE_URL
    await navigator.serviceWorker.register(`${base}sw.js`, {
      scope: base,
      updateViaCache: 'none',
    })
  } catch (error) {
    logWarn('pwa.registration.failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}

window.addEventListener('load', () => {
  void registerServiceWorker()
})

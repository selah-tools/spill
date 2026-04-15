import { logWarn } from '../lib/observability'

let onUpdateReady: (() => void) | null = null

export const setSwUpdateHandler = (handler: () => void): void => {
  onUpdateReady = handler
}

const registerServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  try {
    const base = import.meta.env.BASE_URL
    const registration = await navigator.serviceWorker.register(
      `${base}sw.js`,
      {
        scope: base,
        updateViaCache: 'none',
      },
    )

    // Check for updates on focus (user returning to the tab)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void registration.update()
      }
    })

    // Listen for a new service worker waiting to activate
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // New version installed while existing SW is active — notify the app
          onUpdateReady?.()
        }
      })
    })
  } catch (error) {
    logWarn('pwa.registration.failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}

/** Apply the pending service worker update immediately. */
export const applySwUpdate = (): void => {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  })
}

// When the SW takes over after skipWaiting, reload for the latest shell
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload if we actually swapped controllers (not first install)
    if (navigator.serviceWorker.controller) {
      window.location.reload()
    }
  })
}

window.addEventListener('load', () => {
  void registerServiceWorker()
})

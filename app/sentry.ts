import {
  init as sentryInit,
  setUser as sentrySetUser,
  captureException as sentryCaptureException,
  setTag as sentrySetTag,
} from '@sentry/browser'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const SENTRY_ENV = import.meta.env.VITE_SENTRY_ENV as string | undefined
const SENTRY_RELEASE = import.meta.env.VITE_SENTRY_RELEASE as string | undefined

let initialized = false

export const initSentry = (): void => {
  if (!SENTRY_DSN || initialized) {
    return
  }

  sentryInit({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV ?? import.meta.env.MODE,
    release: SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url)
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return null
          }
        } catch {
          // proceed with the event
        }
      }
      return event
    },
  })

  initialized = true
}

export const setSentryUser = (context: {
  id?: string
  role?: string
}): void => {
  if (!initialized) return
  sentrySetUser(context.id ? { id: context.id } : null)
  if (context.role) {
    sentrySetTag('user_role', context.role)
  }
}

export const captureException = sentryCaptureException

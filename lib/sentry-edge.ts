const SENTRY_DSN = process.env.SENTRY_DSN as string | undefined
const SENTRY_ENV = process.env.SENTRY_ENV ?? process.env.VERCEL_ENV
const SENTRY_RELEASE = process.env.SENTRY_RELEASE as string | undefined

type CaptureException = (
  error: unknown,
  hint?: { extra?: Record<string, unknown> },
) => void

let initialized = false
let initPromise: Promise<void> | null = null
let sentryCaptureException: CaptureException | null = null

const canUseBrowserSentry = (): boolean =>
  typeof globalThis.window !== 'undefined' &&
  typeof globalThis.document !== 'undefined'

const ensureSentry = async (): Promise<void> => {
  if (!SENTRY_DSN || initialized || !canUseBrowserSentry()) {
    return
  }

  if (!initPromise) {
    initPromise = import('@sentry/browser')
      .then(({ init, captureException }) => {
        init({
          dsn: SENTRY_DSN,
          environment: SENTRY_ENV,
          release: SENTRY_RELEASE,
          tracesSampleRate: 0.1,
        })

        sentryCaptureException = captureException
        initialized = true
      })
      .catch(() => {
        initPromise = null
      })
  }

  await initPromise
}

export const initSentryEdge = (): void => {
  void ensureSentry()
}

export const captureEdgeException = (
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  if (!initialized || !sentryCaptureException) {
    return
  }

  sentryCaptureException(error, {
    extra: context,
  })
}

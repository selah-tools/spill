export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type JsonLike = Record<string, unknown>

const SENSITIVE_KEY_PATTERN = /authorization|token|secret|password|cookie|key/i

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonLike).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeValue(entry),
      ]),
    )
  }

  if (typeof value === 'string' && value.length > 400) {
    return `${value.slice(0, 397)}...`
  }

  return value
}

const sanitizeContext = (context: JsonLike): JsonLike =>
  (sanitizeValue(context) as JsonLike | null) ?? {}

const writeLog = (
  level: LogLevel,
  message: string,
  context: JsonLike = {},
): void => {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...sanitizeContext(context),
  }

  const serialized = JSON.stringify(entry)

  switch (level) {
    case 'debug':
      console.debug(serialized)
      break
    case 'info':
      console.info(serialized)
      break
    case 'warn':
      console.warn(serialized)
      break
    case 'error':
      console.error(serialized)
      break
  }
}

export const logDebug = (message: string, context?: JsonLike): void =>
  writeLog('debug', message, context)

export const logInfo = (message: string, context?: JsonLike): void =>
  writeLog('info', message, context)

export const logWarn = (message: string, context?: JsonLike): void =>
  writeLog('warn', message, context)

export const logError = (message: string, context?: JsonLike): void =>
  writeLog('error', message, context)

export const metric = (name: string, value = 1, tags: JsonLike = {}): void => {
  logInfo('metric', { metric: { name, value, tags } })
}

export const createRequestId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const requestIdFromHeaders = (headers: Headers): string => {
  const forwarded = headers.get('x-request-id')?.trim()
  return forwarded || createRequestId()
}

export const jsonResponse = (
  body: unknown,
  init: ResponseInit = {},
  requestId?: string,
): Response => {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (requestId) {
    headers.set('X-Request-Id', requestId)
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

export const errorMessage = (
  error: unknown,
  fallback = 'unexpected_error',
): string => (error instanceof Error ? error.message : fallback)

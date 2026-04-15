import { jsonResponse } from './observability'

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always compares full length regardless of where mismatch occurs.
 */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    // Still do a full comparison to avoid leaking length via timing
    let result = 1
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0)
    }
    return result === 0 // always false since length differs, but constant-time
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export const adminUnauthorizedResponse = (requestId: string): Response =>
  jsonResponse({ error: 'unauthorized' }, { status: 401 }, requestId)

export const adminMisconfiguredResponse = (requestId: string): Response =>
  jsonResponse({ error: 'ADMIN_TOKEN must be set' }, { status: 500 }, requestId)

export const verifyAdminRequest = (
  req: Request,
  requestId: string,
): Response | null => {
  const token = process.env.ADMIN_TOKEN?.trim()
  if (!token) {
    return adminMisconfiguredResponse(requestId)
  }

  const authorization = req.headers.get('authorization')?.trim()
  const provided = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : ''

  if (!provided || !timingSafeEqual(provided, token)) {
    return adminUnauthorizedResponse(requestId)
  }

  return null
}

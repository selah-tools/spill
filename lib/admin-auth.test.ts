import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  adminMisconfiguredResponse,
  adminUnauthorizedResponse,
  verifyAdminRequest,
} from './admin-auth'

describe('verifyAdminRequest', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-secret')
  })

  it('returns null when Bearer token matches ADMIN_TOKEN', () => {
    const req = new Request('https://spill.cards/api/test', {
      headers: { Authorization: 'Bearer test-admin-secret' },
    })
    expect(verifyAdminRequest(req, 'req-1')).toBeNull()
  })

  it('returns 401 when Bearer token does not match', async () => {
    const req = new Request('https://spill.cards/api/test', {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    const res = verifyAdminRequest(req, 'req-2')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
    await expect(res!.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('https://spill.cards/api/test')
    const res = verifyAdminRequest(req, 'req-3')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const req = new Request('https://spill.cards/api/test', {
      headers: { Authorization: 'test-admin-secret' },
    })
    const res = verifyAdminRequest(req, 'req-4')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it('returns 500 when ADMIN_TOKEN is not set', async () => {
    vi.stubEnv('ADMIN_TOKEN', '')
    const req = new Request('https://spill.cards/api/test', {
      headers: { Authorization: 'Bearer anything' },
    })
    const res = verifyAdminRequest(req, 'req-5')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(500)
    await expect(res!.json()).resolves.toEqual({
      error: 'ADMIN_TOKEN must be set',
    })
  })

  it('includes X-Request-Id on error responses', () => {
    const req = new Request('https://spill.cards/api/test')
    const res = verifyAdminRequest(req, 'req-header-check')
    expect(res).not.toBeNull()
    expect(res!.headers.get('X-Request-Id')).toBe('req-header-check')
  })

  it('uses constant-time comparison (different length tokens still return 401)', async () => {
    const req = new Request('https://spill.cards/api/test', {
      headers: { Authorization: 'Bearer x' },
    })
    const res = verifyAdminRequest(req, 'req-6')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it('handles whitespace in token and header', () => {
    vi.stubEnv('ADMIN_TOKEN', '  test-admin-secret  ')
    const req = new Request('https://spill.cards/api/test', {
      headers: { Authorization: '  Bearer test-admin-secret  ' },
    })
    expect(verifyAdminRequest(req, 'req-ws')).toBeNull()
  })
})

describe('adminUnauthorizedResponse', () => {
  it('returns 401 with X-Request-Id', async () => {
    const res = adminUnauthorizedResponse('req-u1')
    expect(res.status).toBe(401)
    expect(res.headers.get('X-Request-Id')).toBe('req-u1')
    await expect(res.json()).resolves.toEqual({ error: 'unauthorized' })
  })
})

describe('adminMisconfiguredResponse', () => {
  it('returns 500 with X-Request-Id', async () => {
    const res = adminMisconfiguredResponse('req-m1')
    expect(res.status).toBe(500)
    expect(res.headers.get('X-Request-Id')).toBe('req-m1')
    await expect(res.json()).resolves.toEqual({
      error: 'ADMIN_TOKEN must be set',
    })
  })
})

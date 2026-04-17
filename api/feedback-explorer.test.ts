import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from './feedback-explorer'

const kvStore = new Map<string, unknown>()

const mockKvFetch = () =>
  vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '[]')) as (string | number)[]
    const command = String(body[0]).toUpperCase()

    if (command === 'GET') {
      const value = kvStore.get(String(body[1]))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            result: value != null ? JSON.stringify(value) : null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }

    if (command === 'SCAN') {
      const allKeys = [...kvStore.keys()].filter((key) =>
        key.startsWith('question:'),
      )
      return Promise.resolve(
        new Response(JSON.stringify({ result: ['0', allKeys] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    if (command === 'HGETALL') {
      const value = kvStore.get(String(body[1]))
      return Promise.resolve(
        new Response(JSON.stringify({ result: value ?? {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    if (command === 'LRANGE') {
      const value = kvStore.get(String(body[1]))
      return Promise.resolve(
        new Response(JSON.stringify({ result: value ?? [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    return Promise.resolve(
      new Response(JSON.stringify({ result: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

const makeRequest = (opts: { token?: string; query?: string } = {}) => {
  const url = `https://spill.cards/api/feedback-explorer${opts.query ?? ''}`
  const headers: Record<string, string> = {
    'X-Request-Id': 'req-fe-test',
  }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`

  return new Request(url, { method: 'GET', headers })
}

describe('GET /api/feedback-explorer', () => {
  beforeEach(() => {
    kvStore.clear()
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token')
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-secret')
    vi.stubGlobal('fetch', mockKvFetch())
  })

  it('returns 401 without auth', async () => {
    const res = await handler(makeRequest())
    expect(res.status).toBe(401)
    expect(res.headers.get('X-Request-Id')).toBe('req-fe-test')
  })

  it('returns 401 with wrong token', async () => {
    const res = await handler(makeRequest({ token: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 405 for non-GET methods', async () => {
    const req = new Request('https://spill.cards/api/feedback-explorer', {
      method: 'POST',
      headers: {
        'X-Request-Id': 'req-fe-post',
        Authorization: 'Bearer test-admin-secret',
      },
    })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('returns explorer response with empty KV', async () => {
    const res = await handler(makeRequest({ token: 'test-admin-secret' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Request-Id')).toBe('req-fe-test')

    const json = (await res.json()) as {
      rows: unknown[]
      insights: Record<string, unknown>
      totalFeedbackCids: number
      totalSourceQuestions: number
    }
    expect(json.totalFeedbackCids).toBe(0)
    expect(json.totalSourceQuestions).toBeGreaterThan(0)
    expect(json.rows.length).toBe(json.totalSourceQuestions)
    expect(json.insights).toBeDefined()
    expect(json.insights.topLiked).toBeDefined()
    expect(json.insights.topDisliked).toBeDefined()
    expect(json.insights.commonDownvoteReasons).toBeDefined()
  })

  it('returns feedback data when KV has counters', async () => {
    // Simulate a question counter hash in KV
    kvStore.set('question:fellowship-light-01-abc123', {
      upvotes: '5',
      downvotes: '2',
      views: '20',
      copies: '1',
      shares: '0',
      wildcardDraws: '0',
      questionRequests: '0',
    })

    const res = await handler(makeRequest({ token: 'test-admin-secret' }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      totalFeedbackCids: number
      rows: Array<{
        cid: string
        counters: { upvotes: number; downvotes: number }
        netScore: number
      }>
    }
    expect(json.totalFeedbackCids).toBe(1)

    const feedbackRow = json.rows.find(
      (row) => row.cid === 'fellowship-light-01-abc123',
    )
    expect(feedbackRow).toBeDefined()
    expect(feedbackRow!.counters.upvotes).toBe(5)
    expect(feedbackRow!.counters.downvotes).toBe(2)
    expect(feedbackRow!.netScore).toBe(3)
  })

  it('filters by cid when query param is set', async () => {
    kvStore.set('question:specific-cid', {
      upvotes: '1',
      downvotes: '0',
      views: '3',
      copies: '0',
      shares: '0',
      wildcardDraws: '0',
      questionRequests: '0',
    })

    const res = await handler(
      makeRequest({ token: 'test-admin-secret', query: '?cid=specific-cid' }),
    )
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      rows: Array<{ cid: string }>
    }
    // When filtering by cid, we should get just that row
    const matching = json.rows.filter((row) => row.cid === 'specific-cid')
    expect(matching).toHaveLength(1)
  })

  it('returns a row for an unknown cid filter', async () => {
    const res = await handler(
      makeRequest({
        token: 'test-admin-secret',
        query: '?cid=nonexistent',
      }),
    )
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      rows: Array<{ cid: string; counters: { upvotes: number } }>
    }
    const row = json.rows.find((r) => r.cid === 'nonexistent')
    expect(row).toBeDefined()
    expect(row!.counters.upvotes).toBe(0)
  })

  it('includes insights breakdown fields', async () => {
    const res = await handler(makeRequest({ token: 'test-admin-secret' }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      insights: {
        byAudience: unknown[]
        byDepth: unknown[]
        byCategory: unknown[]
        byMode: unknown[]
        mostEngaged: unknown[]
        mostControversial: unknown[]
      }
    }
    expect(Array.isArray(json.insights.byAudience)).toBe(true)
    expect(Array.isArray(json.insights.byDepth)).toBe(true)
    expect(Array.isArray(json.insights.byCategory)).toBe(true)
    expect(Array.isArray(json.insights.byMode)).toBe(true)
    expect(Array.isArray(json.insights.mostEngaged)).toBe(true)
    expect(Array.isArray(json.insights.mostControversial)).toBe(true)
  })
})

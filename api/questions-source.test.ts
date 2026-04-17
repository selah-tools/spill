import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBundledQuestionSource } from '../app/questions'
import handler from './questions-source'

/** Minimal valid question fixture matching QuestionSourceItem */
const fixtureQuestion = () => ({
  id: 'test-fixture-01',
  audience: ['fellowship'] as const,
  depth: 'light' as const,
  mode: 'prompt' as const,
  category: 'identity' as const,
  text: 'What is your favorite color?',
  tags: [],
  active: true,
})

const kvStore = new Map<string, string>()

const mockKvFetch = () =>
  vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlString = String(url)

    if (urlString.startsWith('https://api.vercel.com/')) {
      if (urlString.includes('/v6/deployments?')) {
        return Promise.resolve(
          new Response(JSON.stringify({ deployments: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ id: 'dpl_new' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    const body = JSON.parse(String(init?.body ?? '[]')) as (string | number)[]
    const command = String(body[0]).toUpperCase()

    if (command === 'GET') {
      const value = kvStore.get(String(body[1]))
      return Promise.resolve(
        new Response(JSON.stringify({ result: value ?? null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    if (command === 'SET') {
      kvStore.set(String(body[1]), String(body[2]))
      return Promise.resolve(
        new Response(JSON.stringify({ result: 'OK' }), {
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

const makeRequest = (
  method: string,
  opts: {
    token?: string
    body?: unknown
    query?: string
    origin?: string
  } = {},
) => {
  const url = `https://spill.cards/api/questions-source${opts.query ?? ''}`
  const headers: Record<string, string> = {
    'X-Request-Id': 'req-qs-test',
  }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  if (opts.body) headers['Content-Type'] = 'application/json'
  if (opts.origin) headers['Origin'] = opts.origin

  return new Request(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

describe('GET /api/questions-source', () => {
  beforeEach(() => {
    kvStore.clear()
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token')
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-secret')
    vi.stubGlobal('fetch', mockKvFetch())
  })

  it('returns bundled fallback when KV is empty', async () => {
    const res = await handler(makeRequest('GET'))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { count: number; total: number }
    const bundled = getBundledQuestionSource()
    const activeCount = bundled.filter((q) => q.active && !q.archivedAt).length

    expect(json.count).toBe(activeCount)
    expect(json.total).toBe(bundled.length)
  })

  it('returns questions from KV when populated', async () => {
    const question = fixtureQuestion()
    const doc = {
      updatedAt: new Date().toISOString(),
      questions: [question],
    }
    kvStore.set('questions:source', JSON.stringify(doc))

    const res = await handler(makeRequest('GET'))
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      count: number
      questions: Array<{ id: string }>
    }
    expect(json.count).toBe(1)
    expect(json.questions[0].id).toBe('test-fixture-01')
  })

  it('includes X-Request-Id header', async () => {
    const res = await handler(makeRequest('GET'))
    expect(res.headers.get('X-Request-Id')).toBe('req-qs-test')
  })

  it('sets cache headers', async () => {
    const res = await handler(makeRequest('GET'))
    expect(res.headers.get('Cache-Control')).toContain('s-maxage')
  })

  it('requires auth for ?all=1 (archived questions)', async () => {
    const res = await handler(makeRequest('GET', { query: '?all=1' }))
    expect(res.status).toBe(401)
  })

  it('returns all questions when ?all=1 with valid auth', async () => {
    const res = await handler(
      makeRequest('GET', { query: '?all=1', token: 'test-admin-secret' }),
    )
    expect(res.status).toBe(200)
  })

  it('falls back to bundled when KV read throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('KV down'))),
    )

    const res = await handler(makeRequest('GET'))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { count: number }
    expect(json.count).toBeGreaterThan(0)
  })
})

describe('PUT /api/questions-source', () => {
  beforeEach(() => {
    kvStore.clear()
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token')
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-secret')
    vi.stubGlobal('fetch', mockKvFetch())
  })

  it('returns 401 without auth token', async () => {
    const res = await handler(
      makeRequest('PUT', { body: { questions: [fixtureQuestion()] } }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong auth token', async () => {
    const res = await handler(
      makeRequest('PUT', {
        token: 'wrong',
        body: { questions: [fixtureQuestion()] },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('persists valid questions to KV', async () => {
    const question = fixtureQuestion()

    const res = await handler(
      makeRequest('PUT', {
        token: 'test-admin-secret',
        body: { questions: [question] },
      }),
    )
    expect(res.status).toBe(200)

    const json = (await res.json()) as {
      ok: boolean
      count: number
      active: number
      deployTriggered: boolean
    }
    expect(json.ok).toBe(true)
    expect(json.count).toBe(1)
    expect(json.active).toBe(1)
    expect(json.deployTriggered).toBe(false)

    // Verify written to KV store
    expect(kvStore.has('questions:source')).toBe(true)
    const stored = JSON.parse(kvStore.get('questions:source')!) as {
      questions: Array<{ id: string }>
    }
    expect(stored.questions[0].id).toBe('test-fixture-01')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://spill.cards/api/questions-source', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer test-admin-secret',
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-qs-test',
      },
      body: 'not-json{{{',
    })

    const res = await handler(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'invalid json' })
  })

  it('returns 400 when questions field is not an array', async () => {
    const res = await handler(
      makeRequest('PUT', {
        token: 'test-admin-secret',
        body: { questions: 'not-array' },
      }),
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: 'questions field must be an array',
    })
  })

  it('returns 500 when KV write fails', async () => {
    // Override fetch to fail on SET
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('Internal Error', { status: 500 })),
      ),
    )

    const res = await handler(
      makeRequest('PUT', {
        token: 'test-admin-secret',
        body: { questions: [fixtureQuestion()] },
      }),
    )
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({
      error: 'failed to persist question source',
    })
  })

  it('triggers a Vercel redeploy from the latest ready production deployment', async () => {
    vi.stubEnv('VERCEL_TOKEN', 'vercel-token')
    vi.stubEnv('VERCEL_PROJECT_ID', 'project-id')
    vi.stubEnv('VERCEL_ORG_ID', 'team-id')

    const fetchMock = vi.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlString = String(url)

        if (urlString === 'https://kv.example.com') {
          const body = JSON.parse(String(init?.body ?? '[]')) as (
            | string
            | number
          )[]
          const command = String(body[0]).toUpperCase()

          if (command === 'SET') {
            kvStore.set(String(body[1]), String(body[2]))
            return Promise.resolve(
              new Response(JSON.stringify({ result: 'OK' }), {
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
        }

        if (
          urlString ===
          'https://api.vercel.com/v6/deployments?projectId=project-id&target=production&state=READY&limit=1&teamId=team-id'
        ) {
          expect(init).toMatchObject({
            method: 'GET',
            headers: { Authorization: 'Bearer vercel-token' },
          })

          return Promise.resolve(
            new Response(
              JSON.stringify({
                deployments: [{ uid: 'dpl_previous', name: 'spill' }],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        if (
          urlString ===
          'https://api.vercel.com/v13/deployments?forceNew=1&teamId=team-id'
        ) {
          expect(init).toMatchObject({
            method: 'POST',
            headers: {
              Authorization: 'Bearer vercel-token',
              'Content-Type': 'application/json',
            },
          })

          expect(JSON.parse(String(init?.body))).toEqual({
            deploymentId: 'dpl_previous',
            meta: { action: 'redeploy' },
            name: 'spill',
            target: 'production',
          })

          return Promise.resolve(
            new Response(JSON.stringify({ id: 'dpl_new' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        throw new Error(`Unexpected fetch URL: ${urlString}`)
      },
    )

    vi.stubGlobal('fetch', fetchMock)

    const res = await handler(
      makeRequest('PUT', {
        token: 'test-admin-secret',
        body: { questions: [fixtureQuestion()] },
      }),
    )
    expect(res.status).toBe(200)

    const json = (await res.json()) as { deployTriggered: boolean }
    expect(json.deployTriggered).toBe(true)
  })

  it('rejects cross-origin PUT requests', async () => {
    const res = await handler(
      makeRequest('PUT', {
        token: 'test-admin-secret',
        body: { questions: [fixtureQuestion()] },
        origin: 'https://evil.com',
      }),
    )
    expect(res.status).toBe(403)
  })

  it('allows same-origin PUT requests', async () => {
    const res = await handler(
      makeRequest('PUT', {
        token: 'test-admin-secret',
        body: { questions: [fixtureQuestion()] },
        origin: 'https://spill.cards',
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe('unsupported methods', () => {
  beforeEach(() => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token')
  })

  it('returns 405 for POST', async () => {
    const res = await handler(makeRequest('POST'))
    expect(res.status).toBe(405)
    expect(res.headers.get('X-Request-Id')).toBe('req-qs-test')
  })

  it('returns 405 for DELETE', async () => {
    const res = await handler(makeRequest('DELETE'))
    expect(res.status).toBe(405)
  })
})

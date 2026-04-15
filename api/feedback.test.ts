import { beforeEach, describe, expect, it, vi } from 'vitest'

import { canonicalId } from '../app/card-slug'
import { promptLibrary } from '../app/prompts'
import handler from './feedback'

const prompt = promptLibrary.find((entry) => entry.active)
if (!prompt) {
  throw new Error('Missing active prompt fixture')
}

const mockKvResponse = () =>
  new Response(JSON.stringify({ result: 1 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'super-secret-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(mockKvResponse())),
    )
  })

  it('skips non-rating events without touching KV', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-test-1',
        },
        body: JSON.stringify({
          cid: canonicalId(prompt),
          eventType: 'prompt_viewed',
          context: prompt.audience,
          depth: prompt.depth,
          mode: prompt.mode,
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Request-Id')).toBe('req-test-1')
    await expect(response.json()).resolves.toEqual({ ok: true, skipped: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('writes rating counters and forwards a request ID upstream', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-test-2',
        },
        body: JSON.stringify({
          cid: canonicalId(prompt),
          eventType: 'prompt_upvoted',
          context: prompt.audience,
          depth: prompt.depth,
          mode: prompt.mode,
          counterDeltas: { upvotes: 1 },
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Request-Id')).toBe('req-test-2')
    await expect(response.json()).resolves.toEqual({ ok: true })

    expect(fetch).toHaveBeenCalledTimes(1)
    const firstCall = vi.mocked(fetch).mock.calls[0]
    expect(firstCall?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer super-secret-token',
        'X-Request-Id': 'req-test-2',
      }),
    })
    expect(String(firstCall?.[1]?.body)).toContain('HINCRBY')
  })

  it('includes reason in the stored event when provided', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-reason-1',
        },
        body: JSON.stringify({
          cid: canonicalId(prompt),
          eventType: 'prompt_downvoted',
          context: prompt.audience,
          depth: prompt.depth,
          mode: prompt.mode,
          reason: 'Too vague',
        }),
      }),
    )

    expect(response.status).toBe(200)

    expect(fetch).toHaveBeenCalledTimes(3)

    const lpushCall = vi.mocked(fetch).mock.calls.find((call) => {
      const body =
        call[1] && typeof call[1] === 'object' && 'body' in call[1]
          ? String(call[1].body)
          : ''
      return body.includes('LPUSH')
    })
    expect(lpushCall).toBeDefined()
    const lpushBody = JSON.parse(String(lpushCall![1]!.body)) as string[]
    expect(lpushBody[0]).toBe('LPUSH')
    expect(lpushBody[1]).toBe(`prompt:${canonicalId(prompt)}:downvoteReasons`)
    expect(lpushBody[2]).toBe('Too vague')
  })

  it('rejects unknown prompts before touching KV', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: 'not-a-real-prompt',
          eventType: 'prompt_viewed',
          context: ['friends'],
          depth: 'light',
          mode: 'prompt',
        }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'unknown prompt' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects unsupported methods', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback'),
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('X-Request-Id')).toBeTruthy()
    await expect(response.json()).resolves.toEqual({
      error: 'method not allowed',
    })
  })
})

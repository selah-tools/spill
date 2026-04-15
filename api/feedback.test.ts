import { beforeEach, describe, expect, it, vi } from 'vitest'

import { canonicalId } from '../app/card-slug'
import { questionLibrary } from '../app/questions'
import handler from './feedback'

const question = questionLibrary.find((entry) => entry.active)
if (!question) {
  throw new Error('Missing active question fixture')
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
          cid: canonicalId(question),
          eventType: 'question_viewed',
          context: question.audience,
          depth: question.depth,
          mode: question.mode,
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
          cid: canonicalId(question),
          eventType: 'question_upvoted',
          context: question.audience,
          depth: question.depth,
          mode: question.mode,
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
          cid: canonicalId(question),
          eventType: 'question_downvoted',
          context: question.audience,
          depth: question.depth,
          mode: question.mode,
          counterDeltas: { downvotes: 1 },
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
    expect(lpushBody[1]).toBe(
      `question:${canonicalId(question)}:downvoteReasons`,
    )
    expect(lpushBody[2]).toBe('Too vague')
  })

  it('rejects rating events without counterDeltas', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-no-deltas',
        },
        body: JSON.stringify({
          cid: canonicalId(question),
          eventType: 'question_downvoted',
          context: question.audience,
          depth: question.depth,
          mode: question.mode,
        }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'counterDeltas required for rating events',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('applies both decrements and increments when switching ratings', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-switch-1',
        },
        body: JSON.stringify({
          cid: canonicalId(question),
          eventType: 'question_downvoted',
          context: question.audience,
          depth: question.depth,
          mode: question.mode,
          counterDeltas: { upvotes: -1, downvotes: 1 },
        }),
      }),
    )

    expect(response.status).toBe(200)

    const calls = vi.mocked(fetch).mock.calls
    expect(calls).toHaveLength(2)

    const bodies = calls.map(
      (call) => JSON.parse(String(call[1]!.body)) as unknown[],
    )
    const upOp = bodies.find((b) => b[2] === 'upvotes')
    const downOp = bodies.find((b) => b[2] === 'downvotes')
    expect(upOp).toEqual([
      'HINCRBY',
      `question:${canonicalId(question)}`,
      'upvotes',
      -1,
    ])
    expect(downOp).toEqual([
      'HINCRBY',
      `question:${canonicalId(question)}`,
      'downvotes',
      1,
    ])
  })

  it('rejects unknown questions before touching KV', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: 'not-a-real-question',
          eventType: 'question_viewed',
          context: ['friends'],
          depth: 'light',
          mode: 'prompt',
        }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'unknown question',
    })
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

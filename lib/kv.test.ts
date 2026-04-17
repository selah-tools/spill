import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  kvCommand,
  kvGetJson,
  kvScanKeys,
  kvSetJson,
  normalizeHashResult,
} from './kv'

const mockKvFetch = (result: unknown) =>
  vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )

describe('kv', () => {
  beforeEach(() => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token')
  })

  describe('kvCommand', () => {
    it('sends command to KV REST API', async () => {
      vi.stubGlobal('fetch', mockKvFetch('OK'))

      const result = await kvCommand('req-1', 'SET', 'key', 'value')
      expect(result).toBe('OK')

      expect(fetch).toHaveBeenCalledWith('https://kv.example.com', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer kv-token',
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-1',
        },
        body: JSON.stringify(['SET', 'key', 'value']),
      })
    })

    it('throws on non-OK response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(new Response('Bad Request', { status: 400 })),
        ),
      )

      await expect(kvCommand('req-2', 'BAD')).rejects.toThrow(
        'KV REST error: 400',
      )
    })

    it('throws when env vars are missing', async () => {
      vi.stubEnv('KV_REST_API_URL', '')
      vi.stubEnv('KV_REST_API_TOKEN', '')

      await expect(kvCommand('req-3', 'GET', 'k')).rejects.toThrow(
        'KV_REST_API_URL and KV_REST_API_TOKEN must be set',
      )
    })
  })

  describe('kvGetJson', () => {
    it('returns parsed JSON when key exists as string', async () => {
      vi.stubGlobal('fetch', mockKvFetch(JSON.stringify({ hello: 'world' })))

      const result = await kvGetJson<{ hello: string }>('req-g1', 'my-key')
      expect(result).toEqual({ hello: 'world' })
    })

    it('returns null when key does not exist', async () => {
      vi.stubGlobal('fetch', mockKvFetch(null))

      const result = await kvGetJson('req-g2', 'missing-key')
      expect(result).toBeNull()
    })

    it('returns object directly when result is already parsed', async () => {
      vi.stubGlobal('fetch', mockKvFetch({ already: 'parsed' }))

      const result = await kvGetJson<{ already: string }>('req-g3', 'obj-key')
      expect(result).toEqual({ already: 'parsed' })
    })
  })

  describe('kvSetJson', () => {
    it('serializes value and sends SET command', async () => {
      vi.stubGlobal('fetch', mockKvFetch('OK'))

      await kvSetJson('req-s1', 'my-key', { data: 42 })

      const body = JSON.parse(
        String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
      ) as unknown[]
      expect(body[0]).toBe('SET')
      expect(body[1]).toBe('my-key')
      expect(JSON.parse(body[2] as string)).toEqual({ data: 42 })
    })
  })

  describe('kvScanKeys', () => {
    it('collects keys across multiple SCAN pages', async () => {
      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          callCount++
          const result =
            callCount === 1 ? ['42', ['key:a', 'key:b']] : ['0', ['key:c']]
          return Promise.resolve(
            new Response(JSON.stringify({ result }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }),
      )

      const keys = await kvScanKeys('req-sc1', 'key:*')
      expect(keys).toEqual(['key:a', 'key:b', 'key:c'])
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('handles object-style scan results', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({ result: { cursor: '0', keys: ['k1'] } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          ),
        ),
      )

      const keys = await kvScanKeys('req-sc2', '*')
      expect(keys).toEqual(['k1'])
    })
  })

  describe('normalizeHashResult', () => {
    it('returns empty record for null', () => {
      expect(normalizeHashResult(null)).toEqual({})
    })

    it('converts object values to strings', () => {
      expect(normalizeHashResult({ a: '1', b: '2' })).toEqual({
        a: '1',
        b: '2',
      })
    })

    it('converts array pairs to key-value record', () => {
      expect(normalizeHashResult(['a', '1', 'b', '2'])).toEqual({
        a: '1',
        b: '2',
      })
    })

    it('handles mixed number/string arrays', () => {
      expect(normalizeHashResult(['upvotes', 5, 'downvotes', 3])).toEqual({
        upvotes: '5',
        downvotes: '3',
      })
    })

    it('skips entries with non-string keys in arrays', () => {
      expect(normalizeHashResult([42, 'val'])).toEqual({})
    })
  })
})

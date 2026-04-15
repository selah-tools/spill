import { describe, expect, it } from 'vitest'

import { deployedPromptMap } from '../app/prompt-map'
import handler from './prompt-map'

describe('GET /api/prompt-map', () => {
  it('returns the full deployed prompt map with cache headers', async () => {
    const response = await handler(
      new Request('https://spill.cards/api/prompt-map'),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain(
      'stale-while-revalidate',
    )
    expect(response.headers.get('X-Request-Id')).toBeTruthy()

    await expect(response.json()).resolves.toMatchObject({
      count: deployedPromptMap.length,
      prompts: expect.any(Array),
    })
  })

  it('returns a single prompt when queried by canonical ID', async () => {
    const entry = deployedPromptMap[0]
    if (!entry) {
      throw new Error('Missing deployed prompt map fixture')
    }

    const response = await handler(
      new Request(`https://spill.cards/api/prompt-map?cid=${entry.cid}`),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ prompt: entry })
  })
})

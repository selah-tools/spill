import { describe, expect, it } from 'vitest'

import { getDeployedQuestionMap } from '../app/question-map'
import handler from './question-map'

describe('GET /api/question-map', () => {
  it('returns the full deployed question map with cache headers', async () => {
    const deployedQuestionMap = getDeployedQuestionMap()
    const response = await handler(
      new Request('https://spill.cards/api/question-map'),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain(
      'stale-while-revalidate',
    )
    expect(response.headers.get('X-Request-Id')).toBeTruthy()

    await expect(response.json()).resolves.toMatchObject({
      count: deployedQuestionMap.length,
      questions: expect.any(Array),
    })
  })

  it('returns a single question when queried by canonical ID', async () => {
    const deployedQuestionMap = getDeployedQuestionMap()
    const entry = deployedQuestionMap[0]
    if (!entry) {
      throw new Error('Missing deployed question map fixture')
    }

    const response = await handler(
      new Request(`https://spill.cards/api/question-map?cid=${entry.cid}`),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ question: entry })
  })
})

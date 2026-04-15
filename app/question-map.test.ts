import { describe, expect, it } from 'vitest'

import { canonicalId } from './card-slug'
import {
  getDeployedQuestionMap,
  getDeployedQuestionMapByCid,
} from './question-map'
import { questionLibrary } from './questions'

describe('deployedQuestionMap', () => {
  it('includes every active question exactly once', () => {
    const deployedQuestionMap = getDeployedQuestionMap()
    const activeQuestionCount = questionLibrary.filter(
      (question) => question.active,
    ).length

    expect(deployedQuestionMap).toHaveLength(activeQuestionCount)
    expect(new Set(deployedQuestionMap.map((entry) => entry.cid)).size).toBe(
      activeQuestionCount,
    )
  })

  it('maps canonical ids back to question text and metadata', () => {
    const deployedQuestionMapByCid = getDeployedQuestionMapByCid()
    const question = questionLibrary.find((entry) => entry.active)
    if (!question) throw new Error('Missing active question fixture')

    const cid = canonicalId(question)
    const entry = deployedQuestionMapByCid[cid]

    expect(entry).toBeDefined()
    expect(entry!.id).toBe(question.id)
    expect(entry!.text).toBe(question.text)
    expect(entry!.mode).toBe(question.mode)
    expect(entry!.depth).toBe(question.depth)
    expect(entry!.category).toBe(question.category)
  })
})

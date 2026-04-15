import { describe, expect, it } from 'vitest'

import { canonicalId } from './card-slug'
import { deployedPromptMap, deployedPromptMapByCid } from './prompt-map'
import { promptLibrary } from './prompts'

describe('deployedPromptMap', () => {
  it('includes every active prompt exactly once', () => {
    const activePromptCount = promptLibrary.filter(
      (prompt) => prompt.active,
    ).length

    expect(deployedPromptMap).toHaveLength(activePromptCount)
    expect(new Set(deployedPromptMap.map((entry) => entry.cid)).size).toBe(
      activePromptCount,
    )
  })

  it('maps canonical ids back to prompt text and metadata', () => {
    const prompt = promptLibrary.find((entry) => entry.active)
    if (!prompt) throw new Error('Missing active prompt fixture')

    const cid = canonicalId(prompt)
    const entry = deployedPromptMapByCid[cid]

    expect(entry).toBeDefined()
    expect(entry.id).toBe(prompt.id)
    expect(entry.text).toBe(prompt.text)
    expect(entry.mode).toBe(prompt.mode)
    expect(entry.depth).toBe(prompt.depth)
    expect(entry.category).toBe(prompt.category)
  })
})

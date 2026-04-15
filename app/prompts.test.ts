import { describe, expect, it } from 'vitest'

import {
  OVERT_DTAG,
  isOvertChristianPrompt,
  isPromptEnabled,
  orderedDeck,
  promptLibrary,
} from './prompts'

const promptById = (id: string) => {
  const prompt = promptLibrary.find((entry) => entry.id === id)
  if (!prompt) throw new Error(`Missing prompt fixture: ${id}`)
  return prompt
}

describe('overt Christian tagging', () => {
  it('adds the overt dtag to directly Christian cards', () => {
    const prompt = promptById('friends-honest-01')

    expect(prompt.tags).toContain(OVERT_DTAG)
    expect(isOvertChristianPrompt(prompt)).toBe(true)
  })

  it('tags cards that use spiritual language as overt', () => {
    const prompt = promptById('small-group-light-02')

    expect(prompt.tags).toContain(OVERT_DTAG)
    expect(isOvertChristianPrompt(prompt)).toBe(true)
  })

  it('tags high-confidence discipleship language as overt', () => {
    const prompt = promptById('small-group-honest-01')

    expect(prompt.tags).toContain(OVERT_DTAG)
    expect(isOvertChristianPrompt(prompt)).toBe(true)
  })

  it('does not tag subtle worldview cards as overt by default', () => {
    const prompt = promptById('friends-light-01')

    expect(prompt.tags).not.toContain(OVERT_DTAG)
    expect(isOvertChristianPrompt(prompt)).toBe(false)
  })
})

describe('global card-pool toggles', () => {
  it('hides wildcards when the wildcard toggle is off', () => {
    const wildcard = promptById('wildcard-02')

    expect(
      isPromptEnabled(wildcard, {
        includeWildcards: false,
        includeOvertChristian: true,
      }),
    ).toBe(false)
  })

  it('hides overt cards when the overtly Christian toggle is off', () => {
    const overt = promptById('friends-honest-01')

    expect(
      isPromptEnabled(overt, {
        includeWildcards: true,
        includeOvertChristian: false,
      }),
    ).toBe(false)
  })

  it('builds a visible deck that respects both toggles together', () => {
    const deck = orderedDeck({
      includeWildcards: false,
      includeOvertChristian: false,
    })

    expect(deck.length).toBeGreaterThan(0)
    expect(deck.every((prompt) => prompt.mode === 'prompt')).toBe(true)
    expect(deck.every((prompt) => !isOvertChristianPrompt(prompt))).toBe(true)
  })
})

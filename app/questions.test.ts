import { describe, expect, it } from 'vitest'

import {
  OVERT_DTAG,
  isOvertChristianQuestion,
  isQuestionEnabled,
  normalizeQuestionSource,
  orderedDeck,
  questionLibrary,
} from './questions'

const questionById = (id: string) => {
  const question = questionLibrary.find((entry) => entry.id === id)
  if (!question) throw new Error(`Missing question fixture: ${id}`)
  return question
}

describe('overt Christian tagging', () => {
  it('adds the overt dtag to directly Christian cards', () => {
    const question = questionById('friends-honest-01')

    expect(question.tags).toContain(OVERT_DTAG)
    expect(isOvertChristianQuestion(question)).toBe(true)
  })

  it('tags cards that use spiritual language as overt', () => {
    const question = questionById('small-group-light-02')

    expect(question.tags).toContain(OVERT_DTAG)
    expect(isOvertChristianQuestion(question)).toBe(true)
  })

  it('tags high-confidence discipleship language as overt', () => {
    const question = questionById('small-group-honest-01')

    expect(question.tags).toContain(OVERT_DTAG)
    expect(isOvertChristianQuestion(question)).toBe(true)
  })

  it('does not tag subtle worldview cards as overt by default', () => {
    const question = questionById('friends-light-01')

    expect(question.tags).not.toContain(OVERT_DTAG)
    expect(isOvertChristianQuestion(question)).toBe(false)
  })
})

describe('normalizeQuestionSource', () => {
  it('trims text and restores canonical audience order', () => {
    const [question] = normalizeQuestionSource([
      {
        id: 'friends-light-99',
        text: '  What felt meaningful this week?  ',
        audience: ['family', 'friends'],
        depth: 'light',
        mode: 'prompt',
        category: 'gratitude',
        tags: ['weekly'],
        active: true,
      },
    ])

    expect(question).toMatchObject({
      text: 'What felt meaningful this week?',
      audience: ['friends', 'family'],
    })
  })
})

describe('global card-pool toggles', () => {
  it('hides wildcards when the wildcard toggle is off', () => {
    const wildcard = questionById('wildcard-02')

    expect(
      isQuestionEnabled(wildcard, {
        includeWildcards: false,
        includeOvertChristian: true,
      }),
    ).toBe(false)
  })

  it('hides overt cards when the overtly Christian toggle is off', () => {
    const overt = questionById('friends-honest-01')

    expect(
      isQuestionEnabled(overt, {
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
    expect(deck.every((question) => question.mode === 'prompt')).toBe(true)
    expect(deck.every((question) => !isOvertChristianQuestion(question))).toBe(
      true,
    )
  })
})

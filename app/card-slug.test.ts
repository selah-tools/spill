import { describe, expect, it } from 'vitest'

import {
  canonicalCardContent,
  canonicalId,
  cardSlugForQuestion,
  fnv1a32,
  parseCardSlugFromPathname,
  questionForCardSlug,
  toBase36Fixed,
} from './card-slug'
import { questionLibrary } from './questions'

describe('fnv1a32', () => {
  it('matches a stable golden value', () => {
    expect(fnv1a32('hello')).toBe(1335831723)
    expect(fnv1a32('')).toBe(2166136261 >>> 0)
  })
})

describe('toBase36Fixed', () => {
  it('pads and truncates to length', () => {
    expect(toBase36Fixed(0, 4)).toBe('0000')
    expect(toBase36Fixed(35, 3)).toBe('00z')
    expect(toBase36Fixed(0xffffffff, 8)).toHaveLength(8)
  })
})

describe('canonicalCardContent', () => {
  it('includes mode and trimmed text', () => {
    expect(canonicalCardContent({ mode: 'prompt', text: '  hi ' })).toBe(
      'prompt\nhi',
    )
  })
})

describe('card slugs', () => {
  it('are unique for every active question', () => {
    const slugs = questionLibrary
      .filter((q) => q.active)
      .map((q) => cardSlugForQuestion(q))
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('round-trips by id', () => {
    for (const q of questionLibrary) {
      if (!q.active) continue
      const slug = cardSlugForQuestion(q)
      expect(slug).toBeDefined()
      expect(questionForCardSlug(slug!)?.id).toBe(q.id)
    }
  })
})

describe('canonicalId', () => {
  it('produces "{slug}-{hash}" for every active question', () => {
    for (const q of questionLibrary) {
      if (!q.active) continue
      const cid = canonicalId(q)
      // Starts with the original ID
      expect(cid.startsWith(q.id + '-')).toBe(true)
      // Ends with a 6-char base36 hash
      const suffix = cid.slice(cid.lastIndexOf('-') + 1)
      expect(suffix).toMatch(/^[0-9a-z]{6}$/)
    }
  })

  it('is unique across the entire library', () => {
    const ids = questionLibrary
      .filter((q) => q.active)
      .map((q) => canonicalId(q))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is deterministic — same input always produces the same ID', () => {
    const q = questionLibrary[0]!
    expect(canonicalId(q)).toBe(canonicalId(q))
  })

  it('changes when text changes', () => {
    const q = questionLibrary[0]!
    const original = canonicalId(q)
    const modified = canonicalId({ ...q, text: q.text + ' edited' })
    expect(modified).not.toBe(original)
  })
})

describe('parseCardSlugFromPathname', () => {
  it('reads slug case-insensitively', () => {
    expect(parseCardSlugFromPathname('/c/AbC12')).toBe('abc12')
    expect(parseCardSlugFromPathname('/app/c/xYz/')).toBe('xyz')
  })

  it('returns null when missing', () => {
    expect(parseCardSlugFromPathname('/')).toBeNull()
    expect(parseCardSlugFromPathname('/about')).toBeNull()
  })
})

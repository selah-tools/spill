import { describe, expect, it } from 'vitest'

import {
  canonicalCardContent,
  canonicalId,
  cardSlugForPrompt,
  fnv1a32,
  parseCardSlugFromPathname,
  promptForCardSlug,
  toBase36Fixed,
} from './card-slug'
import { promptLibrary } from './prompts'

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
  it('are unique for every active prompt', () => {
    const slugs = promptLibrary
      .filter((p) => p.active)
      .map((p) => cardSlugForPrompt(p))
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('round-trips by id', () => {
    for (const p of promptLibrary) {
      if (!p.active) continue
      const slug = cardSlugForPrompt(p)
      expect(slug).toBeDefined()
      expect(promptForCardSlug(slug!)?.id).toBe(p.id)
    }
  })
})

describe('canonicalId', () => {
  it('produces "{slug}-{hash}" for every active prompt', () => {
    for (const p of promptLibrary) {
      if (!p.active) continue
      const cid = canonicalId(p)
      // Starts with the original ID
      expect(cid.startsWith(p.id + '-')).toBe(true)
      // Ends with a 6-char base36 hash
      const suffix = cid.slice(cid.lastIndexOf('-') + 1)
      expect(suffix).toMatch(/^[0-9a-z]{6}$/)
    }
  })

  it('is unique across the entire library', () => {
    const ids = promptLibrary.filter((p) => p.active).map((p) => canonicalId(p))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is deterministic — same input always produces the same ID', () => {
    const p = promptLibrary[0]!
    expect(canonicalId(p)).toBe(canonicalId(p))
  })

  it('changes when text changes', () => {
    const p = promptLibrary[0]!
    const original = canonicalId(p)
    const modified = canonicalId({ ...p, text: p.text + ' edited' })
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

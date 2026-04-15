import { promptLibrary, type Prompt } from './prompts'

/** FNV-1a 32-bit — fast, deterministic, sync (no Web Crypto). */
export function fnv1a32(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Fixed-width base36 (0-9a-z), lowercase. */
export function toBase36Fixed(n: number, length: number): string {
  if (length <= 0) return ''
  let s = (n >>> 0).toString(36)
  while (s.length < length) {
    s = '0' + s
  }
  if (s.length > length) {
    s = s.slice(-length)
  }
  return s
}

/** Canonical string for hashing — mode + normalized prompt text (content-based). */
export function canonicalCardContent(p: Pick<Prompt, 'mode' | 'text'>): string {
  return `${p.mode}\n${p.text.trim()}`
}

function buildSlugMaps(): {
  slugToPrompt: ReadonlyMap<string, Prompt>
  promptIdToSlug: ReadonlyMap<string, string>
} {
  const slugToPrompt = new Map<string, Prompt>()
  const promptIdToSlug = new Map<string, string>()

  for (const p of promptLibrary) {
    if (!p.active) continue
    const body = canonicalCardContent(p)
    let assigned = false

    for (let attempt = 0; attempt < 24 && !assigned; attempt++) {
      const salt = attempt === 0 ? '' : `\0${p.id}\0${attempt}`
      const h = fnv1a32(body + salt)
      const length = Math.min(6 + Math.floor(attempt / 4), 12)
      const slug = toBase36Fixed(h, length)
      const existing = slugToPrompt.get(slug)
      if (!existing) {
        slugToPrompt.set(slug, p)
        promptIdToSlug.set(p.id, slug)
        assigned = true
      } else if (existing.id === p.id) {
        assigned = true
      }
    }

    if (!assigned) {
      throw new Error(
        `card-slug: could not assign unique slug for prompt ${p.id}`,
      )
    }
  }

  return { slugToPrompt, promptIdToSlug }
}

const { slugToPrompt, promptIdToSlug } = buildSlugMaps()

/** Content-hash portion of a canonical ID — 6-char base36 of FNV-1a(mode + text). */
export function contentHashForPrompt(p: Pick<Prompt, 'mode' | 'text'>): string {
  return toBase36Fixed(fnv1a32(canonicalCardContent(p)), 6)
}

/** Composite canonical ID: "{originalId}-{contentHash}".
 *
 * Human-readable English slug + content-bound hash suffix.
 * Same text always produces the same ID. Text changes produce a new ID.
 *
 * Example: `friends-light-01-a3f2k1`
 */
export function canonicalId(p: Pick<Prompt, 'id' | 'mode' | 'text'>): string {
  return `${p.id}-${contentHashForPrompt(p)}`
}

export function promptForCardSlug(slug: string): Prompt | undefined {
  const key = slug.trim().toLowerCase()
  if (!key) return undefined
  return slugToPrompt.get(key)
}

export function cardSlugForPrompt(prompt: Prompt): string | undefined {
  return promptIdToSlug.get(prompt.id)
}

function normalizedAppBase(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base.slice(0, -1) : base
}

/** Path prefix for the SPA home (respects Vite `base`). */
export function appPublicRootPath(): string {
  const nb = normalizedAppBase()
  return nb === '' ? '/' : `${nb}/`
}

export function cardPathForPrompt(prompt: Prompt): string | undefined {
  const slug = cardSlugForPrompt(prompt)
  if (!slug) return undefined
  const prefix = normalizedAppBase()
  return `${prefix === '' ? '' : prefix}/c/${slug}`
}

/** Parse slug from pathname (works with arbitrary Vite base). */
export function parseCardSlugFromPathname(pathname: string): string | null {
  const idx = pathname.indexOf('/c/')
  if (idx < 0) return null
  const rest = pathname.slice(idx + 3).replace(/\/+$/, '')
  const slug = rest.split('/')[0]
  return slug ? slug.toLowerCase() : null
}

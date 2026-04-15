import { questionLibrary, type Question } from './questions'

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

/** Canonical string for hashing — mode + normalized question text (content-based). */
export function canonicalCardContent(
  q: Pick<Question, 'mode' | 'text'>,
): string {
  return `${q.mode}\n${q.text.trim()}`
}

function buildSlugMaps(): {
  slugToQuestion: ReadonlyMap<string, Question>
  questionIdToSlug: ReadonlyMap<string, string>
} {
  const slugToQuestion = new Map<string, Question>()
  const questionIdToSlug = new Map<string, string>()

  for (const q of questionLibrary) {
    if (!q.active) continue
    const body = canonicalCardContent(q)
    let assigned = false

    for (let attempt = 0; attempt < 24 && !assigned; attempt++) {
      const salt = attempt === 0 ? '' : `\0${q.id}\0${attempt}`
      const h = fnv1a32(body + salt)
      const length = Math.min(6 + Math.floor(attempt / 4), 12)
      const slug = toBase36Fixed(h, length)
      const existing = slugToQuestion.get(slug)
      if (!existing) {
        slugToQuestion.set(slug, q)
        questionIdToSlug.set(q.id, slug)
        assigned = true
      } else if (existing.id === q.id) {
        assigned = true
      }
    }

    if (!assigned) {
      throw new Error(
        `card-slug: could not assign unique slug for question ${q.id}`,
      )
    }
  }

  return { slugToQuestion, questionIdToSlug }
}

let slugMaps = buildSlugMaps()

export const rebuildSlugMaps = (): void => {
  slugMaps = buildSlugMaps()
}

/** Content-hash portion of a canonical ID — 6-char base36 of FNV-1a(mode + text). */
export function contentHashForQuestion(
  q: Pick<Question, 'mode' | 'text'>,
): string {
  return toBase36Fixed(fnv1a32(canonicalCardContent(q)), 6)
}

/** Composite canonical ID: "{originalId}-{contentHash}".
 *
 * Human-readable English slug + content-bound hash suffix.
 * Same text always produces the same ID. Text changes produce a new ID.
 *
 * Example: `friends-light-01-a3f2k1`
 */
export function canonicalId(q: Pick<Question, 'id' | 'mode' | 'text'>): string {
  return `${q.id}-${contentHashForQuestion(q)}`
}

export function questionForCardSlug(slug: string): Question | undefined {
  const key = slug.trim().toLowerCase()
  if (!key) return undefined
  return slugMaps.slugToQuestion.get(key)
}

export function cardSlugForQuestion(question: Question): string | undefined {
  return slugMaps.questionIdToSlug.get(question.id)
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

export function cardPathForQuestion(question: Question): string | undefined {
  const slug = cardSlugForQuestion(question)
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

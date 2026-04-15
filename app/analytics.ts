import { createRequestId, logDebug } from '../lib/observability'
import { canonicalId } from './card-slug'
export type { PromptEventType, PromptCounterField } from './feedback-types'
import type {
  FeedbackCounterDeltas,
  FeedbackPayload,
  PromptEventType,
} from './feedback-types'
import type { ContextFilter, Depth, Mode, Prompt } from './prompts'

export type PromptRating = 'up' | 'down'

export type StoredPreferences = {
  context?: ContextFilter
  depth?: Depth
  includeWildcards?: boolean
  includeOvertChristian?: boolean
}

type PromptCounters = {
  views: number
  upvotes: number
  downvotes: number
  copies: number
  shares: number
  wildcardDraws: number
  promptRequests: number
}

export type FeedbackStats = Record<string, PromptCounters>

type PromptRatings = Record<string, PromptRating>

type PromptEvent = {
  promptId: string
  context: ContextFilter
  depth: Depth
  mode: Mode
  eventType: PromptEventType
  createdAt: string
}

const PREFERENCES_KEY = 'spill:preferences:v1'
const FEEDBACK_KEY = 'spill:feedback:v1'
const RATINGS_KEY = 'spill:ratings:v1'
const EVENTS_KEY = 'spill:events:v1'
const SEEN_PROMPTS_KEY = 'spill:seenPrompts:v1'
const MAX_EVENTS = 250
/** Cap stored IDs so localStorage stays bounded (library is ~100 prompts). */
const MAX_SEEN_PROMPTS = 500

const isBrowser = () => typeof window !== 'undefined'

const readJson = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const writeJson = <T>(key: string, value: T): void => {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures in private mode or restricted contexts.
  }
}

const emptyCounters = (): PromptCounters => ({
  views: 0,
  upvotes: 0,
  downvotes: 0,
  copies: 0,
  shares: 0,
  wildcardDraws: 0,
  promptRequests: 0,
})

export const loadPreferences = (): StoredPreferences =>
  readJson(PREFERENCES_KEY, {})

export const savePreferences = (preferences: StoredPreferences): void => {
  writeJson(PREFERENCES_KEY, preferences)
}

export const loadSeenPromptIds = (): string[] =>
  readJson<string[]>(SEEN_PROMPTS_KEY, [])

/** Remember a prompt the user has been shown (persists across visits). Newest first, deduped. */
export const recordPromptSeen = (promptId: string): void => {
  const prev = readJson<string[]>(SEEN_PROMPTS_KEY, [])
  const next = [promptId, ...prev.filter((id) => id !== promptId)]
  if (next.length > MAX_SEEN_PROMPTS) {
    next.length = MAX_SEEN_PROMPTS
  }
  writeJson(SEEN_PROMPTS_KEY, next)
}

export const clearSeenPrompts = (): void => {
  writeJson(SEEN_PROMPTS_KEY, [] as string[])
}

export const getFeedbackStats = (): FeedbackStats => readJson(FEEDBACK_KEY, {})

export const getPromptRating = (promptId: string): PromptRating | null => {
  const ratings = readJson<PromptRatings>(RATINGS_KEY, {})
  return ratings[promptId] ?? null
}

export const setPromptRating = (
  promptId: string,
  rating: PromptRating,
): PromptRating => {
  const ratings = readJson<PromptRatings>(RATINGS_KEY, {})
  const stats = readJson<FeedbackStats>(FEEDBACK_KEY, {})
  const previous = ratings[promptId]
  const counters = stats[promptId] ?? emptyCounters()

  if (previous === rating) {
    return rating
  }

  if (previous === 'up') {
    counters.upvotes = Math.max(0, counters.upvotes - 1)
  }

  if (previous === 'down') {
    counters.downvotes = Math.max(0, counters.downvotes - 1)
  }

  if (rating === 'up') {
    counters.upvotes += 1
  }

  if (rating === 'down') {
    counters.downvotes += 1
  }

  ratings[promptId] = rating
  stats[promptId] = counters

  writeJson(RATINGS_KEY, ratings)
  writeJson(FEEDBACK_KEY, stats)

  return rating
}

const logPromptEvent = (
  prompt: Prompt,
  context: ContextFilter,
  depth: Depth,
  mode: Mode,
  eventType: PromptEventType,
): void => {
  const events = readJson<PromptEvent[]>(EVENTS_KEY, [])
  events.unshift({
    promptId: prompt.id,
    context,
    depth,
    mode,
    eventType,
    createdAt: new Date().toISOString(),
  })
  writeJson(EVENTS_KEY, events.slice(0, MAX_EVENTS))
}

export const trackPromptRating = (
  prompt: Prompt,
  context: ContextFilter,
  depth: Depth,
  mode: Mode,
  rating: PromptRating,
  reason?: string,
): PromptRating => {
  const previous = getPromptRating(prompt.id)
  if (previous === rating) {
    return rating
  }

  const next = setPromptRating(prompt.id, rating)
  const eventType: PromptEventType =
    rating === 'up' ? 'prompt_upvoted' : 'prompt_downvoted'
  const counterDeltas: FeedbackCounterDeltas = {}

  if (previous === 'up') {
    counterDeltas.upvotes = -1
  }

  if (previous === 'down') {
    counterDeltas.downvotes = -1
  }

  if (rating === 'up') {
    counterDeltas.upvotes = (counterDeltas.upvotes ?? 0) + 1
  }

  if (rating === 'down') {
    counterDeltas.downvotes = (counterDeltas.downvotes ?? 0) + 1
  }

  logPromptEvent(prompt, context, depth, mode, eventType)
  postFeedbackPayload({
    cid: canonicalId(prompt),
    eventType,
    context,
    depth,
    mode,
    counterDeltas,
    ...(reason ? { reason } : {}),
  })

  return next
}

export const trackPromptEvent = (
  prompt: Prompt,
  context: ContextFilter,
  depth: Depth,
  mode: Mode,
  eventType: PromptEventType,
): void => {
  const stats = readJson<FeedbackStats>(FEEDBACK_KEY, {})
  const counters = stats[prompt.id] ?? emptyCounters()

  logPromptEvent(prompt, context, depth, mode, eventType)

  switch (eventType) {
    case 'prompt_viewed':
      counters.views += 1
      break
    case 'prompt_copied':
      counters.copies += 1
      break
    case 'prompt_shared':
      counters.shares += 1
      break
    case 'wildcard_opened':
      counters.wildcardDraws += 1
      break
    case 'new_prompt_requested':
      counters.promptRequests += 1
      break
    default:
      break
  }

  stats[prompt.id] = counters

  writeJson(FEEDBACK_KEY, stats)

  // Prod KV only stores thumbs up/down. Everything else stays local-only.
  if (eventType === 'prompt_upvoted' || eventType === 'prompt_downvoted') {
    postFeedbackPayload({
      cid: canonicalId(prompt),
      eventType,
      context,
      depth,
      mode,
    })
  }
}

/** Fire-and-forget POST to the serverless feedback endpoint.
 *
 * Only posts when running on the production origin (spill.cards).
 * Dev / localhost / preview deploys write to localStorage only.
 */
const postFeedbackPayload = (payload: FeedbackPayload): void => {
  if (!isBrowser()) return

  const { hostname } = window.location
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  ) {
    return
  }

  const requestId = createRequestId()
  const debugObservability = import.meta.env.VITE_OBSERVABILITY_DEBUG === 'true'

  try {
    fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((error) => {
      if (debugObservability) {
        logDebug('feedback.post.failed', {
          requestId,
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    })
  } catch (error) {
    if (debugObservability) {
      logDebug('feedback.post.failed', {
        requestId,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }
}

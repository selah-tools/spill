import { createRequestId, logDebug } from '../lib/observability'
import { canonicalId } from './card-slug'
export type { QuestionEventType, QuestionCounterField } from './feedback-types'
import type {
  FeedbackCounterDeltas,
  FeedbackPayload,
  QuestionEventType,
} from './feedback-types'
import type {
  ContextFilter,
  Depth,
  DepthFilter,
  Mode,
  Question,
} from './questions'

export type QuestionRating = 'up' | 'down'

export type StoredPreferences = {
  context?: ContextFilter
  depth?: DepthFilter | Depth
  includeWildcards?: boolean
  includeOvertChristian?: boolean
}

type QuestionCounters = {
  views: number
  upvotes: number
  downvotes: number
  copies: number
  shares: number
  wildcardDraws: number
  questionRequests: number
}

export type FeedbackStats = Record<string, QuestionCounters>

type QuestionRatings = Record<string, QuestionRating>

type QuestionEvent = {
  questionId: string
  context: ContextFilter
  depth: Depth
  mode: Mode
  eventType: QuestionEventType
  createdAt: string
}

const PREFERENCES_KEY = 'spill:preferences:v1'
const FEEDBACK_KEY = 'spill:feedback:v1'
const RATINGS_KEY = 'spill:ratings:v1'
const EVENTS_KEY = 'spill:events:v1'
const HISTORY_KEY = 'spill:history:v1'
const RECENT_IDS_KEY = 'spill:recentIds:v1'
const SEEN_QUESTIONS_KEY = 'spill:seenQuestions:v1'
const MAX_EVENTS = 250
/** Cap stored IDs so localStorage stays bounded (library is ~100 questions). */
const MAX_SEEN_QUESTIONS = 500

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

const emptyCounters = (): QuestionCounters => ({
  views: 0,
  upvotes: 0,
  downvotes: 0,
  copies: 0,
  shares: 0,
  wildcardDraws: 0,
  questionRequests: 0,
})

export const loadPreferences = (): StoredPreferences =>
  readJson(PREFERENCES_KEY, {})

export const savePreferences = (preferences: StoredPreferences): void => {
  writeJson(PREFERENCES_KEY, preferences)
}

export const loadSeenQuestionIds = (): string[] =>
  readJson<string[]>(SEEN_QUESTIONS_KEY, [])

/** Remember a question the user has been shown (persists across visits). Newest first, deduped. */
export const recordQuestionSeen = (questionId: string): void => {
  const prev = readJson<string[]>(SEEN_QUESTIONS_KEY, [])
  const next = [questionId, ...prev.filter((id) => id !== questionId)]
  if (next.length > MAX_SEEN_QUESTIONS) {
    next.length = MAX_SEEN_QUESTIONS
  }
  writeJson(SEEN_QUESTIONS_KEY, next)
}

export const loadHistory = (): string[] => readJson<string[]>(HISTORY_KEY, [])

export const saveHistory = (ids: string[]): void => {
  writeJson(HISTORY_KEY, ids)
}

export const loadRecentQuestionIds = (): string[] =>
  readJson<string[]>(RECENT_IDS_KEY, [])

export const saveRecentQuestionIds = (ids: string[]): void => {
  writeJson(RECENT_IDS_KEY, ids)
}

export const clearSeenQuestions = (): void => {
  writeJson(SEEN_QUESTIONS_KEY, [] as string[])
  writeJson(HISTORY_KEY, [] as string[])
  writeJson(RECENT_IDS_KEY, [] as string[])
}

export const getFeedbackStats = (): FeedbackStats => readJson(FEEDBACK_KEY, {})

export const getQuestionRating = (
  questionId: string,
): QuestionRating | null => {
  const ratings = readJson<QuestionRatings>(RATINGS_KEY, {})
  return ratings[questionId] ?? null
}

export const setQuestionRating = (
  questionId: string,
  rating: QuestionRating,
): QuestionRating => {
  const ratings = readJson<QuestionRatings>(RATINGS_KEY, {})
  const stats = readJson<FeedbackStats>(FEEDBACK_KEY, {})
  const previous = ratings[questionId]
  const counters = stats[questionId] ?? emptyCounters()

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

  ratings[questionId] = rating
  stats[questionId] = counters

  writeJson(RATINGS_KEY, ratings)
  writeJson(FEEDBACK_KEY, stats)

  return rating
}

const logQuestionEvent = (
  question: Question,
  context: ContextFilter,
  depth: Depth,
  mode: Mode,
  eventType: QuestionEventType,
): void => {
  const events = readJson<QuestionEvent[]>(EVENTS_KEY, [])
  events.unshift({
    questionId: question.id,
    context,
    depth,
    mode,
    eventType,
    createdAt: new Date().toISOString(),
  })
  writeJson(EVENTS_KEY, events.slice(0, MAX_EVENTS))
}

export const trackQuestionRating = (
  question: Question,
  context: ContextFilter,
  depth: Depth,
  mode: Mode,
  rating: QuestionRating,
  reason?: string,
): QuestionRating => {
  const previous = getQuestionRating(question.id)
  if (previous === rating) {
    return rating
  }

  const next = setQuestionRating(question.id, rating)
  const eventType: QuestionEventType =
    rating === 'up' ? 'question_upvoted' : 'question_downvoted'
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

  logQuestionEvent(question, context, depth, mode, eventType)
  postFeedbackPayload({
    cid: canonicalId(question),
    eventType,
    context,
    depth,
    mode,
    counterDeltas,
    ...(reason ? { reason } : {}),
  })

  return next
}

export const trackQuestionEvent = (
  question: Question,
  context: ContextFilter,
  depth: Depth,
  mode: Mode,
  eventType: QuestionEventType,
): void => {
  const stats = readJson<FeedbackStats>(FEEDBACK_KEY, {})
  const counters = stats[question.id] ?? emptyCounters()

  logQuestionEvent(question, context, depth, mode, eventType)

  switch (eventType) {
    case 'question_viewed':
      counters.views += 1
      break
    case 'question_copied':
      counters.copies += 1
      break
    case 'question_shared':
      counters.shares += 1
      break
    case 'wildcard_opened':
      counters.wildcardDraws += 1
      break
    case 'new_question_requested':
      counters.questionRequests += 1
      break
    default:
      break
  }

  stats[question.id] = counters

  writeJson(FEEDBACK_KEY, stats)
}

/** Fire-and-forget POST to the serverless feedback endpoint.
 *
 * Only posts when running on the production origin (spill.cards).
 * Dev / localhost / preview deploys write to localStorage only.
 */
const postFeedbackPayload = (payload: FeedbackPayload): void => {
  if (!isBrowser()) return

  const { hostname } = window.location
  const forceFeedback = import.meta.env.VITE_FEEDBACK_DEV === 'true'
  if (
    !forceFeedback &&
    (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app'))
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

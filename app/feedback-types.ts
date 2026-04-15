import type { ContextFilter, Depth, Mode } from './questions'

export type QuestionEventType =
  | 'question_viewed'
  | 'question_upvoted'
  | 'question_downvoted'
  | 'question_copied'
  | 'question_shared'
  | 'wildcard_opened'
  | 'new_question_requested'

export type QuestionCounterField =
  | 'views'
  | 'upvotes'
  | 'downvotes'
  | 'copies'
  | 'shares'
  | 'wildcardDraws'
  | 'questionRequests'

export type FeedbackCounterDeltas = Partial<
  Record<QuestionCounterField, number>
>

export type FeedbackPayload = {
  /** Composite canonical ID: \"{englishSlug}-{contentHash}\" */
  cid: string
  eventType: QuestionEventType
  context: ContextFilter
  depth: Depth
  mode: Mode
  /** Optional explicit counter deltas. Use for rating changes that need -1/+1 adjustments. */
  counterDeltas?: FeedbackCounterDeltas
  /** Optional free-text reason attached to a downvote. */
  reason?: string
}

export const FEEDBACK_COUNTER_FIELDS: QuestionCounterField[] = [
  'upvotes',
  'downvotes',
]

export const eventCounterField = (
  eventType: QuestionEventType,
): QuestionCounterField | null => {
  switch (eventType) {
    case 'question_viewed':
      return 'views'
    case 'question_upvoted':
      return 'upvotes'
    case 'question_downvoted':
      return 'downvotes'
    case 'question_copied':
      return 'copies'
    case 'question_shared':
      return 'shares'
    case 'wildcard_opened':
      return 'wildcardDraws'
    case 'new_question_requested':
      return 'questionRequests'
    default:
      return null
  }
}

export const isRatingEventType = (eventType: QuestionEventType): boolean =>
  eventType === 'question_upvoted' || eventType === 'question_downvoted'

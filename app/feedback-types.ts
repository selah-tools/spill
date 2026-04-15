import type { ContextFilter, Depth, Mode } from './prompts'

export type PromptEventType =
  | 'prompt_viewed'
  | 'prompt_upvoted'
  | 'prompt_downvoted'
  | 'prompt_copied'
  | 'prompt_shared'
  | 'wildcard_opened'
  | 'new_prompt_requested'

export type PromptCounterField =
  | 'views'
  | 'upvotes'
  | 'downvotes'
  | 'copies'
  | 'shares'
  | 'wildcardDraws'
  | 'promptRequests'

export type FeedbackCounterDeltas = Partial<Record<PromptCounterField, number>>

export type FeedbackPayload = {
  /** Composite canonical ID: \"{englishSlug}-{contentHash}\" */
  cid: string
  eventType: PromptEventType
  context: ContextFilter
  depth: Depth
  mode: Mode
  /** Optional explicit counter deltas. Use for rating changes that need -1/+1 adjustments. */
  counterDeltas?: FeedbackCounterDeltas
  /** Optional free-text reason attached to a downvote. */
  reason?: string
}

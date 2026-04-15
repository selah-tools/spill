import { reactive } from '@arrow-js/core'

import {
  getPromptRating,
  loadPreferences,
  recordPromptSeen,
  savePreferences,
  trackPromptRating,
  type PromptRating,
} from './analytics'
import {
  parseStoredContext,
  type ContextFilter,
  type Depth,
  type Mode,
  type Prompt,
} from './prompts'

type AppState = {
  context: ContextFilter
  depth: Depth
  includeWildcards: boolean
  includeOvertChristian: boolean
  mode: Mode
  currentPrompt: Prompt | null
  servedContext: ContextFilter | null
  servedDepth: Depth | null
  recentPromptIds: string[]
  history: string[]
  loading: boolean
  notice: string
  currentRating: PromptRating | null
  aboutModalOpen: boolean
  downvoteModalOpen: boolean
}

const storedPreferences = loadPreferences()

export const state = reactive<AppState>({
  context: parseStoredContext(storedPreferences.context),
  depth: storedPreferences.depth ?? 'light',
  includeWildcards: storedPreferences.includeWildcards ?? false,
  includeOvertChristian: storedPreferences.includeOvertChristian ?? false,
  mode: 'prompt',
  currentPrompt: null,
  servedContext: null,
  servedDepth: null,
  recentPromptIds: [],
  history: [],
  loading: false,
  notice: '',
  currentRating: null,
  aboutModalOpen: false,
  downvoteModalOpen: false,
})

const persistPreferences = (): void => {
  savePreferences({
    context: state.context,
    depth: state.depth,
    includeWildcards: state.includeWildcards,
    includeOvertChristian: state.includeOvertChristian,
  })
}

export const setContext = (context: ContextFilter): void => {
  state.context = context
  persistPreferences()
}

export const setDepth = (depth: Depth): void => {
  state.depth = depth
  persistPreferences()
}

export const setIncludeWildcards = (includeWildcards: boolean): void => {
  state.includeWildcards = includeWildcards
  persistPreferences()
}

export const setIncludeOvertChristian = (
  includeOvertChristian: boolean,
): void => {
  state.includeOvertChristian = includeOvertChristian
  persistPreferences()
}

export const setMode = (mode: Mode): void => {
  state.mode = mode
}

export const setLoading = (loading: boolean): void => {
  state.loading = loading
}

export const setNotice = (notice: string): void => {
  state.notice = notice
}

export const setCurrentPrompt = (prompt: Prompt): void => {
  state.currentPrompt = prompt
  state.servedContext = [...prompt.audience]
  state.servedDepth = prompt.depth
  state.notice = ''
  state.currentRating = getPromptRating(prompt.id)
  recordPromptSeen(prompt.id)
  state.recentPromptIds = [
    prompt.id,
    ...state.recentPromptIds.filter((id) => id !== prompt.id),
  ].slice(0, 5)
  state.history = [
    prompt.id,
    ...state.history.filter((id) => id !== prompt.id),
  ].slice(0, 12)
}

/** Deck navigation: meta matches the card itself (filters ignored). */
export const setCurrentPromptFromDeck = (prompt: Prompt): void => {
  setCurrentPrompt(prompt)
}

/** Home / back navigation — no active card. */
export const clearCurrentPrompt = (): void => {
  state.currentPrompt = null
  state.servedContext = null
  state.servedDepth = null
  state.notice = ''
  state.mode = 'prompt'
  state.currentRating = null
}

export const rateCurrentPrompt = (rating: PromptRating): void => {
  if (!state.currentPrompt) return
  state.currentRating = trackPromptRating(
    state.currentPrompt,
    state.currentPrompt.audience,
    state.currentPrompt.depth,
    state.currentPrompt.mode,
    rating,
  )
}

export const openAboutModal = (): void => {
  state.aboutModalOpen = true
}

export const closeAboutModal = (): void => {
  state.aboutModalOpen = false
}

export const toggleAboutModal = (): void => {
  state.aboutModalOpen = !state.aboutModalOpen
}

export const openDownvoteModal = (): void => {
  state.downvoteModalOpen = true
}

export const closeDownvoteModal = (): void => {
  state.downvoteModalOpen = false
}

/** Submit the downvote with an optional reason, then close the modal. */
export const submitDownvote = (reason?: string): void => {
  if (!state.currentPrompt) {
    state.downvoteModalOpen = false
    return
  }
  state.currentRating = trackPromptRating(
    state.currentPrompt,
    state.currentPrompt.audience,
    state.currentPrompt.depth,
    state.currentPrompt.mode,
    'down',
    reason?.trim() || undefined,
  )
  state.downvoteModalOpen = false
}

import { reactive } from '@arrow-js/core'

import {
  getQuestionRating,
  loadHistory,
  loadPreferences,
  loadRecentQuestionIds,
  recordQuestionSeen,
  saveHistory,
  savePreferences,
  saveRecentQuestionIds,
  trackQuestionRating,
  type QuestionRating,
} from './analytics'
import {
  parseStoredContext,
  parseStoredDepth,
  type ContextFilter,
  type Depth,
  type DepthFilter,
  type Mode,
  type Question,
} from './questions'

type AppState = {
  context: ContextFilter
  depth: DepthFilter
  includeWildcards: boolean
  includeOvertChristian: boolean
  mode: Mode
  currentQuestion: Question | null
  servedContext: ContextFilter | null
  servedDepth: Depth | null
  recentQuestionIds: string[]
  history: string[]
  loading: boolean
  notice: string
  currentRating: QuestionRating | null
  aboutModalOpen: boolean
  downvoteModalOpen: boolean
}

const storedPreferences = loadPreferences()

export const state = reactive<AppState>({
  context: parseStoredContext(storedPreferences.context),
  depth: parseStoredDepth(storedPreferences.depth),
  includeWildcards: storedPreferences.includeWildcards ?? false,
  includeOvertChristian: storedPreferences.includeOvertChristian ?? false,
  mode: 'prompt',
  currentQuestion: null,
  servedContext: null,
  servedDepth: null,
  recentQuestionIds: loadRecentQuestionIds(),
  history: loadHistory(),
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

export const setDepth = (depth: DepthFilter): void => {
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

export const setCurrentQuestion = (question: Question): void => {
  state.currentQuestion = question
  state.servedContext = [...question.audience]
  state.servedDepth = question.depth
  state.notice = ''
  state.currentRating = getQuestionRating(question.id)
  recordQuestionSeen(question.id)
  const recentIds = [
    question.id,
    ...state.recentQuestionIds.filter((id) => id !== question.id),
  ].slice(0, 5)
  state.recentQuestionIds = recentIds
  saveRecentQuestionIds(recentIds)

  const historyIds = [
    question.id,
    ...state.history.filter((id) => id !== question.id),
  ].slice(0, 12)
  state.history = historyIds
  saveHistory(historyIds)
}

/** Clear in-memory and persisted history/recent IDs (used on deck reset). */
export const resetHistory = (): void => {
  state.history = []
  state.recentQuestionIds = []
  saveHistory([])
  saveRecentQuestionIds([])
}

/** Deck navigation: meta matches the card itself (filters ignored). */
export const setCurrentQuestionFromDeck = (question: Question): void => {
  setCurrentQuestion(question)
}

/** Home / back navigation — no active card. */
export const clearCurrentQuestion = (): void => {
  state.currentQuestion = null
  state.servedContext = null
  state.servedDepth = null
  state.notice = ''
  state.mode = 'prompt'
  state.currentRating = null
}

export const rateCurrentQuestion = (rating: QuestionRating): void => {
  if (!state.currentQuestion) return
  state.currentRating = trackQuestionRating(
    state.currentQuestion,
    state.currentQuestion.audience,
    state.currentQuestion.depth,
    state.currentQuestion.mode,
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
  if (!state.currentQuestion) {
    state.downvoteModalOpen = false
    return
  }
  state.currentRating = trackQuestionRating(
    state.currentQuestion,
    state.currentQuestion.audience,
    state.currentQuestion.depth,
    state.currentQuestion.mode,
    'down',
    reason?.trim() || undefined,
  )
  state.downvoteModalOpen = false
}

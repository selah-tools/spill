import {
  isQuestionEnabled,
  questionLibrary,
  questionMap,
  type ContextFilter,
  type DepthFilter,
  type Question,
} from './questions'

type GenerateOptions = {
  context: ContextFilter
  depth: DepthFilter
  includeWildcards: boolean
  includeOvertChristian: boolean
  recentQuestionIds: string[]
  /** Question IDs already shown in the past (local); excluded until pool is exhausted. */
  seenQuestionIds: string[]
  random?: () => number
}

export type PickQuestionResult = {
  question: Question | null
  /** True when every card matching filters was already in `seenQuestionIds`, so repeats are allowed. */
  exhaustedUnseen: boolean
}

/** Uniform random pick from an array. */
const randomPick = <T>(items: T[], random = Math.random): T | null => {
  if (!items.length) return null
  return items[Math.floor(random() * items.length)]!
}

const matchesContext = (question: Question, context: ContextFilter): boolean =>
  context.length > 0 &&
  question.audience.some((audience) => context.includes(audience))

const matchesDepth = (question: Question, depth: DepthFilter): boolean =>
  depth.length > 0 && depth.includes(question.depth)

/** All active questions matching context + depth toggles + enabled card types. */
const filterCandidates = (
  context: ContextFilter,
  depth: DepthFilter,
  includeWildcards: boolean,
  includeOvertChristian: boolean,
): Question[] =>
  questionLibrary.filter(
    (q) =>
      q.active &&
      isQuestionEnabled(q, { includeWildcards, includeOvertChristian }) &&
      matchesDepth(q, depth) &&
      matchesContext(q, context),
  )

export const pickQuestion = ({
  context,
  depth,
  includeWildcards,
  includeOvertChristian,
  recentQuestionIds,
  seenQuestionIds,
  random,
}: GenerateOptions): PickQuestionResult => {
  const rng = random ?? Math.random

  const candidatePool = filterCandidates(
    context,
    depth,
    includeWildcards,
    includeOvertChristian,
  )

  if (!candidatePool.length) {
    return { question: null, exhaustedUnseen: false }
  }

  // Prefer unseen, then prefer not-recently-shown
  const seenSet = new Set(seenQuestionIds)
  const unseenPool = candidatePool.filter((q) => !seenSet.has(q.id))

  let pool: Question[]
  let exhaustedUnseen = false

  if (unseenPool.length > 0) {
    const sessionFresh = unseenPool.filter(
      (q) => !recentQuestionIds.includes(q.id),
    )
    pool = sessionFresh.length > 0 ? sessionFresh : unseenPool
  } else {
    exhaustedUnseen = true
    const sessionFresh = candidatePool.filter(
      (q) => !recentQuestionIds.includes(q.id),
    )
    pool = sessionFresh.length > 0 ? sessionFresh : candidatePool
  }

  return { question: randomPick(pool, rng), exhaustedUnseen }
}

export const getQuestionById = (questionId: string | null): Question | null => {
  if (!questionId) {
    return null
  }

  return questionMap.get(questionId) ?? null
}

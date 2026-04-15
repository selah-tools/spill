export type ScoreValue = 1 | 2 | 3 | 4 | 5

export type ScoreKey =
  | 'overall'
  | 'spillFit'
  | 'depthFit'
  | 'conversationPower'
  | 'theology'

export type CurationStatus = 'unreviewed' | 'keep' | 'revise' | 'cut'

export type QuickSignal = 'fun' | 'uplifting' | 'intense'

export type IssueTag =
  | 'too-generic'
  | 'wrong-depth'
  | 'wrong-audience'
  | 'too-preachy'
  | 'awkward-phrasing'
  | 'too-long'
  | 'theologically-risky'
  | 'not-distinctive'
  | 'great-example'

export type QuestionCuration = {
  questionId: string
  status: CurationStatus
  scores: Record<ScoreKey, ScoreValue | null>
  signals: QuickSignal[]
  issues: IssueTag[]
  notes: string
  updatedAt: string | null
}

export type QuestionCurations = Record<string, QuestionCuration>

export const STORAGE_KEY = 'spill:curations:v4'

export const scoreLabels: Record<ScoreKey, string> = {
  overall: 'Overall quality',
  spillFit: 'Spill fit',
  depthFit: 'Depth accuracy',
  conversationPower: 'Conversation power',
  theology: 'Theological safety',
}

export const statusLabels: Record<CurationStatus, string> = {
  unreviewed: 'Unreviewed',
  keep: 'Good',
  revise: 'Needs revision',
  cut: 'Bad',
}

export const signalOptions: Array<{
  value: QuickSignal
  label: string
  hint: string
}> = [
  {
    value: 'fun',
    label: 'Fun',
    hint: 'Feels playful, joyful, smile-inducing, or easy to answer aloud.',
  },
  {
    value: 'uplifting',
    label: 'Uplifting',
    hint: 'Feels encouraging, hopeful, warm, or spiritually strengthening without being heavy.',
  },
  {
    value: 'intense',
    label: 'Intense',
    hint: 'Feels hard-hitting, weighty, or likely to shift the room into a more serious tone.',
  },
]

export const issueOptions: Array<{
  value: IssueTag
  label: string
  hint: string
}> = [
  {
    value: 'too-generic',
    label: 'Too generic',
    hint: 'Could belong to any question deck, not specifically Spill.',
  },
  {
    value: 'wrong-depth',
    label: 'Wrong depth',
    hint: 'Labeled light/honest/deep incorrectly.',
  },
  {
    value: 'wrong-audience',
    label: 'Wrong audience',
    hint: 'Does not fit the tagged context well.',
  },
  {
    value: 'too-preachy',
    label: 'Too preachy',
    hint: 'Feels sermon-like instead of conversational.',
  },
  {
    value: 'awkward-phrasing',
    label: 'Awkward phrasing',
    hint: 'Needs cleaner, more natural wording.',
  },
  {
    value: 'too-long',
    label: 'Too long',
    hint: 'Question could be tighter and easier to read aloud.',
  },
  {
    value: 'theologically-risky',
    label: 'Theologically risky',
    hint: 'Needs doctrinal caution or stronger editorial review.',
  },
  {
    value: 'not-distinctive',
    label: 'Not distinctive',
    hint: 'Feels flat, repetitive, or easy to replace.',
  },
]

const emptyScores = (): Record<ScoreKey, ScoreValue | null> => ({
  overall: null,
  spillFit: null,
  depthFit: null,
  conversationPower: null,
  theology: null,
})

export const createEmptyCuration = (questionId: string): QuestionCuration => ({
  questionId,
  status: 'unreviewed',
  scores: emptyScores(),
  signals: [],
  issues: [],
  notes: '',
  updatedAt: null,
})

const isBrowser = () => typeof window !== 'undefined'

export const loadCurations = (): QuestionCurations => {
  if (!isBrowser()) {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QuestionCurations) : {}
  } catch {
    return {}
  }
}

export const saveCurations = (curations: QuestionCurations): void => {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(curations))
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export const getCuration = (
  curations: QuestionCurations,
  questionId: string,
): QuestionCuration => {
  const stored = curations[questionId]
  if (!stored) {
    return createEmptyCuration(questionId)
  }

  return {
    ...createEmptyCuration(questionId),
    ...stored,
    scores: {
      ...emptyScores(),
      ...stored.scores,
    },
    signals: Array.isArray(stored.signals)
      ? (stored.signals as unknown[])
          .map((signal) => (signal === 'alive' ? 'uplifting' : signal))
          .filter(
            (signal): signal is QuickSignal =>
              signal === 'fun' ||
              signal === 'uplifting' ||
              signal === 'intense',
          )
      : [],
    issues: Array.isArray(stored.issues) ? stored.issues : [],
    notes: typeof stored.notes === 'string' ? stored.notes : '',
  }
}

export const isReviewed = (curation: QuestionCuration): boolean => {
  if (curation.status !== 'unreviewed') {
    return true
  }

  if (curation.notes.trim()) {
    return true
  }

  if (curation.signals.length) {
    return true
  }

  if (curation.issues.length) {
    return true
  }

  return Object.values(curation.scores).some((value) => value !== null)
}

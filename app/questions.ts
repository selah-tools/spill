import bundledQuestionData from './questions.json'

export type Audience =
  | 'fellowship'
  | 'household'
  | 'dating'
  | 'engaged'
  | 'marriage'
  | 'youth'
export type ContextFilter = Audience[]
export type Depth = 'light' | 'honest' | 'deep'
export type Mode = 'prompt' | 'wildcard'
export type Category =
  | 'identity'
  | 'prayer'
  | 'scripture'
  | 'church'
  | 'mission'
  | 'struggle'
  | 'gratitude'
  | 'relationship'

export type Question = {
  id: string
  audience: Audience[]
  depth: Depth
  mode: Mode
  category: Category
  text: string
  tags: string[]
  active: boolean
}

export type QuestionSourceItem = Question & {
  createdAt?: string | null
  updatedAt?: string | null
  archivedAt?: string | null
}

export type QuestionSourceDocument = {
  updatedAt: string | null
  questions: QuestionSourceItem[]
}

type RawQuestionSourceItem = Omit<Question, 'active'> & {
  active?: boolean
  createdAt?: string | null
  updatedAt?: string | null
  archivedAt?: string | null
}

export type CardPoolFilters = {
  includeWildcards: boolean
  includeOvertChristian: boolean
}

export const OVERT_DTAG = 'dtag:overt'

const overtChristianPattern =
  /\b(?:Jesus|God(?:'s)?|prayer|pray(?:er|ers|ing)?|worship(?:ped|ping)?|Scripture|Bible|gospel|church|faith|spiritual(?:ly)?|discipleship|obedience|calling|sin|Holy Spirit|Spirit|kingdom)\b/i

export const audienceOptions: Array<{
  value: Audience
  label: string
  blurb: string
}> = [
  {
    value: 'fellowship',
    label: 'Fellowship',
    blurb: 'Questions for shared life with brothers and sisters in Christ.',
  },
  {
    value: 'household',
    label: 'Household',
    blurb:
      'Questions for home rhythms, memory, repair, and faith under one roof.',
  },
  {
    value: 'dating',
    label: 'Dating',
    blurb: 'Questions shaped for discernment, clarity, tenderness, and purity.',
  },
  {
    value: 'engaged',
    label: 'Engaged',
    blurb:
      'Preparing for covenant with honesty about roles, finances, faith, and future married life.',
  },
  {
    value: 'marriage',
    label: 'Marriage',
    blurb:
      'Questions for spouses about tenderness, repair, prayer, stewardship, intimacy, and shared faith over time.',
  },
  {
    value: 'youth',
    label: 'Youth',
    blurb:
      'Honest, age-aware questions for students, leaders, and youth nights.',
  },
]

export const allAudienceValues: Audience[] = audienceOptions.map(
  (option) => option.value,
)

const isAudience = (raw: unknown): raw is Audience =>
  typeof raw === 'string' && allAudienceValues.includes(raw as Audience)

export const orderedAudienceSelection = (
  raw: readonly Audience[],
): ContextFilter => {
  const selected = new Set(raw.filter(isAudience))
  return allAudienceValues.filter((value) => selected.has(value))
}

const defaultContext: ContextFilter = ['fellowship']

export const parseStoredContext = (raw: unknown): ContextFilter => {
  if (raw == null || raw === 'all') {
    return [...defaultContext]
  }

  if (isAudience(raw)) {
    return [raw]
  }

  if (Array.isArray(raw)) {
    const parsed = orderedAudienceSelection(raw.filter(isAudience))
    return parsed.length ? parsed : [...defaultContext]
  }

  return [...defaultContext]
}

export const audienceLabelForValue = (audience: Audience): string =>
  audienceOptions.find((option) => option.value === audience)?.label ??
  'Fellowship'

export const audienceLabels = (audiences: Audience[]): string[] =>
  orderedAudienceSelection(audiences).map((audience) =>
    audienceLabelForValue(audience),
  )

export const packSummaryLabel = (audiences: Audience[]): string => {
  const labels = audienceLabels(audiences)

  if (!labels.length) return 'No packs'
  if (labels.length === allAudienceValues.length) return 'All packs'
  if (labels.length <= 2) return labels.join(' + ')

  return `${labels[0]} + ${labels.length - 1} more`
}

export const cardPackMetaLabel = (audiences: Audience[]): string =>
  packSummaryLabel(audiences)

export type DepthFilter = Depth[]

export const depthOptions: Array<{
  value: Depth
  label: string
  blurb: string
}> = [
  {
    value: 'light',
    label: 'Light',
    blurb: 'Open the room without making it feel intense.',
  },
  {
    value: 'honest',
    label: 'Honest',
    blurb: 'Move past the polished answer and into what is actually true.',
  },
  {
    value: 'deep',
    label: 'Deep',
    blurb: 'Slow down and let the conversation carry real weight.',
  },
]

export const allDepthValues: Depth[] = depthOptions.map(
  (option) => option.value,
)

const isDepth = (raw: unknown): raw is Depth =>
  typeof raw === 'string' && allDepthValues.includes(raw as Depth)

export const orderedDepthSelection = (raw: readonly Depth[]): DepthFilter => {
  const selected = new Set(raw.filter(isDepth))
  return allDepthValues.filter((value) => selected.has(value))
}

const defaultDepth: DepthFilter = ['light', 'honest']

export const parseStoredDepth = (raw: unknown): DepthFilter => {
  if (raw == null) {
    return [...defaultDepth]
  }

  if (isDepth(raw)) {
    return [raw]
  }

  if (Array.isArray(raw)) {
    return orderedDepthSelection(raw.filter(isDepth))
  }

  return [...defaultDepth]
}

export const depthSummaryLabel = (depths: Depth[]): string => {
  const labels = orderedDepthSelection(depths).map(
    (depth) =>
      depthOptions.find((option) => option.value === depth)?.label ?? depth,
  )

  if (!labels.length) return 'No depths'
  if (labels.length === allDepthValues.length) return 'All depths'
  if (labels.length <= 2) return labels.join(' + ')

  return `${labels[0]} + ${labels.length - 1} more`
}

export const categoryLabels: Record<Category, string> = {
  identity: 'Identity',
  prayer: 'Prayer',
  scripture: 'Scripture',
  church: 'Church life',
  mission: 'Mission',
  struggle: 'Struggle',
  gratitude: 'Gratitude',
  relationship: 'Relationship',
}

const isMode = (raw: unknown): raw is Mode =>
  raw === 'prompt' || raw === 'wildcard'

const isCategory = (raw: unknown): raw is Category =>
  typeof raw === 'string' && raw in categoryLabels

const normalizeQuestionTags = (
  entry: Pick<Question, 'text' | 'tags'>,
): string[] => {
  const tags = new Set(entry.tags)

  if (overtChristianPattern.test(entry.text)) {
    tags.add(OVERT_DTAG)
  }

  return [...tags]
}

const toQuestionSourceItem = (
  entry: RawQuestionSourceItem,
  index: number,
): QuestionSourceItem => {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Question ${index + 1} must be an object`)
  }

  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  if (!id) {
    throw new Error(`Question ${index + 1} is missing an id`)
  }

  const text = typeof entry.text === 'string' ? entry.text.trim() : ''
  if (!text) {
    throw new Error(`Question ${id} is missing text`)
  }

  if (!Array.isArray(entry.audience) || entry.audience.length === 0) {
    throw new Error(`Question ${id} must include at least one audience`)
  }

  const audience = orderedAudienceSelection(entry.audience.filter(isAudience))
  if (!audience.length) {
    throw new Error(`Question ${id} has no valid audience values`)
  }

  if (!isDepth(entry.depth)) {
    throw new Error(`Question ${id} has an invalid depth`)
  }

  if (!isMode(entry.mode)) {
    throw new Error(`Question ${id} has an invalid mode`)
  }

  if (!isCategory(entry.category)) {
    throw new Error(`Question ${id} has an invalid category`)
  }

  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : []

  const active = entry.active ?? !entry.archivedAt

  return {
    id,
    text,
    audience,
    depth: entry.depth,
    mode: entry.mode,
    category: entry.category,
    tags: normalizeQuestionTags({ text, tags }),
    active,
    createdAt:
      typeof entry.createdAt === 'string'
        ? entry.createdAt
        : (entry.createdAt ?? null),
    updatedAt:
      typeof entry.updatedAt === 'string'
        ? entry.updatedAt
        : (entry.updatedAt ?? null),
    archivedAt:
      typeof entry.archivedAt === 'string'
        ? entry.archivedAt
        : active
          ? null
          : (entry.archivedAt ?? null),
  }
}

export const normalizeQuestionSource = (
  value: unknown,
): QuestionSourceItem[] => {
  if (!Array.isArray(value)) {
    throw new Error('questions must be an array')
  }

  const normalized = value.map((entry, index) =>
    toQuestionSourceItem(entry as RawQuestionSourceItem, index),
  )
  const seenIds = new Set<string>()

  for (const question of normalized) {
    if (seenIds.has(question.id)) {
      throw new Error(`Duplicate question id: ${question.id}`)
    }
    seenIds.add(question.id)
  }

  return normalized
}

const cloneSourceQuestion = (
  question: QuestionSourceItem,
): QuestionSourceItem => ({
  ...question,
  audience: [...question.audience],
  tags: [...question.tags],
})

const cloneQuestion = (question: Question): Question => ({
  ...question,
  audience: [...question.audience],
  tags: [...question.tags],
})

const bundledQuestionSource = normalizeQuestionSource(
  (bundledQuestionData as Array<Omit<Question, 'active'>>).map((entry) => ({
    ...entry,
    active: true,
  })),
)

export const getBundledQuestionSource = (): QuestionSourceItem[] =>
  bundledQuestionSource.map(cloneSourceQuestion)

export const toRuntimeQuestion = (question: QuestionSourceItem): Question => ({
  id: question.id,
  audience: [...question.audience],
  depth: question.depth,
  mode: question.mode,
  category: question.category,
  text: question.text,
  tags: [...question.tags],
  active: question.active,
})

const toRuntimeQuestionLibrary = (
  source: readonly QuestionSourceItem[],
): Question[] => source.map((question) => toRuntimeQuestion(question))

export let questionSource: QuestionSourceItem[] = getBundledQuestionSource()
export let questionLibrary: Question[] =
  toRuntimeQuestionLibrary(questionSource)
export let questionMap = new Map(
  questionLibrary.map((question) => [question.id, question]),
)

const syncQuestionState = (source: QuestionSourceItem[]): Question[] => {
  questionSource = source.map(cloneSourceQuestion)
  questionLibrary = toRuntimeQuestionLibrary(questionSource)
  questionMap = new Map(
    questionLibrary.map((question) => [question.id, question]),
  )
  return questionLibrary
}

export const setQuestionSource = (
  source: readonly QuestionSourceItem[],
): Question[] => syncQuestionState(normalizeQuestionSource(source))

export const getQuestionSource = (): QuestionSourceItem[] =>
  questionSource.map(cloneSourceQuestion)

export const hasQuestionTag = (
  question: Pick<Question, 'tags'>,
  tag: string,
): boolean => question.tags.includes(tag)

export const isOvertChristianQuestion = (
  question: Pick<Question, 'tags'>,
): boolean => hasQuestionTag(question, OVERT_DTAG)

export const isQuestionEnabled = (
  question: Question,
  filters: CardPoolFilters,
): boolean => {
  if (!filters.includeWildcards && question.mode === 'wildcard') {
    return false
  }

  if (!filters.includeOvertChristian && isOvertChristianQuestion(question)) {
    return false
  }

  return true
}

export const orderedDeckForMode = (mode: Mode): Question[] =>
  questionLibrary.filter(
    (question) => question.active && question.mode === mode,
  )

export const orderedDeck = (filters: CardPoolFilters): Question[] =>
  questionLibrary.filter(
    (question) => question.active && isQuestionEnabled(question, filters),
  )

export const questionCount = (): number =>
  questionLibrary.filter(
    (question) => question.active && question.mode === 'prompt',
  ).length

export const wildcardCount = (): number =>
  questionLibrary.filter(
    (question) => question.active && question.mode === 'wildcard',
  ).length

export const totalCardCount = (): number =>
  questionLibrary.filter((question) => question.active).length

export const getActiveQuestionLibrary = (): Question[] =>
  questionLibrary.filter((question) => question.active).map(cloneQuestion)

export const getQuestionByIdFromLibrary = (
  questionId: string | null,
): Question | null => {
  if (!questionId) {
    return null
  }

  return questionMap.get(questionId) ?? null
}

type FetchQuestionSourceOptions = {
  includeArchived?: boolean
  authToken?: string
}

export const fetchQuestionSource = async (
  options: FetchQuestionSourceOptions = {},
): Promise<QuestionSourceItem[]> => {
  if (typeof window === 'undefined') {
    return getQuestionSource()
  }

  const url = new URL('/api/questions-source', window.location.origin)
  if (options.includeArchived) {
    url.searchParams.set('all', '1')
  }

  const headers = new Headers()
  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`)
  }

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    throw new Error(`questions_source_${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    throw new Error('questions_source_invalid_content_type')
  }

  const body = (await response.json()) as { questions?: unknown }
  return normalizeQuestionSource(body.questions ?? [])
}

let runtimeQuestionLoadPromise: Promise<Question[]> | null = null

export const loadRuntimeQuestions = async (
  force = false,
): Promise<Question[]> => {
  if (typeof window === 'undefined') {
    return questionLibrary
  }

  if (!force && runtimeQuestionLoadPromise) {
    return runtimeQuestionLoadPromise
  }

  const load = fetchQuestionSource()
    .then((source) => setQuestionSource(source))
    .catch(() => questionLibrary)
    .finally(() => {
      runtimeQuestionLoadPromise = null
    })

  runtimeQuestionLoadPromise = load
  return load
}

import promptData from './prompts.json'

export type Audience = 'friends' | 'dating' | 'small-group' | 'family' | 'youth'
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

export type Prompt = {
  id: string
  audience: Audience[]
  depth: Depth
  mode: Mode
  category: Category
  text: string
  tags: string[]
  active: boolean
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
    value: 'friends',
    label: 'Friends',
    blurb:
      'Easy to pull up when the room feels casual but you want something real.',
  },
  {
    value: 'dating',
    label: 'Dating',
    blurb:
      'Questions shaped for trust, clarity, tenderness, and mutual discipleship.',
  },
  {
    value: 'small-group',
    label: 'Small group',
    blurb:
      'Leader-friendly questions that help a group open up without forcing it.',
  },
  {
    value: 'family',
    label: 'Family',
    blurb:
      'Gentle questions for home, memory, healing, and faith around the table.',
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

/** Stored packs accept the new array shape plus legacy single-value / `all` selections. */
export const parseStoredContext = (raw: unknown): ContextFilter => {
  if (raw == null || raw === 'all') {
    return [...allAudienceValues]
  }

  if (isAudience(raw)) {
    return [raw]
  }

  if (Array.isArray(raw)) {
    return orderedAudienceSelection(raw.filter(isAudience))
  }

  return [...allAudienceValues]
}

export const audienceLabelForValue = (audience: Audience): string =>
  audienceOptions.find((option) => option.value === audience)?.label ??
  'Friends'

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

const normalizePromptTags = (entry: Omit<Prompt, 'active'>): string[] => {
  const tags = new Set(entry.tags)

  if (overtChristianPattern.test(entry.text)) {
    tags.add(OVERT_DTAG)
  }

  return [...tags]
}

export const hasPromptTag = (
  prompt: Pick<Prompt, 'tags'>,
  tag: string,
): boolean => prompt.tags.includes(tag)

export const isOvertChristianPrompt = (prompt: Pick<Prompt, 'tags'>): boolean =>
  hasPromptTag(prompt, OVERT_DTAG)

export const isPromptEnabled = (
  prompt: Prompt,
  filters: CardPoolFilters,
): boolean => {
  if (!filters.includeWildcards && prompt.mode === 'wildcard') {
    return false
  }

  if (!filters.includeOvertChristian && isOvertChristianPrompt(prompt)) {
    return false
  }

  return true
}

export const promptLibrary: Prompt[] = (
  promptData as Array<Omit<Prompt, 'active'>>
).map((entry) => ({
  ...entry,
  tags: normalizePromptTags(entry),
  active: true,
}))

export const promptMap = new Map(
  promptLibrary.map((prompt) => [prompt.id, prompt]),
)

/** Active cards of this mode in library order. Ignores pack / depth UI filters (for deck navigation). */
export const orderedDeckForMode = (mode: Mode): Prompt[] =>
  promptLibrary.filter((p) => p.active && p.mode === mode)

/** Active cards in library order after applying global content toggles. */
export const orderedDeck = (filters: CardPoolFilters): Prompt[] =>
  promptLibrary.filter((p) => p.active && isPromptEnabled(p, filters))

export const promptCount = promptLibrary.filter(
  (prompt) => prompt.mode === 'prompt',
).length
export const wildcardCount = promptLibrary.filter(
  (prompt) => prompt.mode === 'wildcard',
).length
export const totalCardCount = promptLibrary.length

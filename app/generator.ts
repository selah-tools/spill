import {
  isPromptEnabled,
  promptLibrary,
  promptMap,
  type ContextFilter,
  type Depth,
  type Prompt,
} from './prompts'

type GenerateOptions = {
  context: ContextFilter
  depth: Depth
  includeWildcards: boolean
  includeOvertChristian: boolean
  recentPromptIds: string[]
  /** Prompt IDs already shown in the past (local); excluded until pool is exhausted. */
  seenPromptIds: string[]
  /** Number of cards already drawn this session — drives depth progression arc. */
  sessionCardCount: number
  random?: () => number
}

export type PickPromptResult = {
  prompt: Prompt | null
  /** True when every card matching filters was already in `seenPromptIds`, so repeats are allowed. */
  exhaustedUnseen: boolean
}

// ── Depth progression ──────────────────────────────────────────────────
// Social penetration theory: start light, ramp toward selected depth ceiling.
// Phase is determined by how many cards the user has drawn this session.
// Weights are [light, honest, deep]; values above the selected depth cap
// are redistributed to lighter tiers.

const depthRank: Record<Depth, number> = { light: 0, honest: 1, deep: 2 }

type PhaseWeights = [number, number, number]

const phaseWeights: Record<string, PhaseWeights> = {
  early: [0.75, 0.2, 0.05], // cards 0–3: warm up, build safety
  middle: [0.3, 0.4, 0.3], // cards 4–7: mix values & stories
  late: [0.1, 0.3, 0.6], // cards 8+: invite vulnerability
}

const getPhase = (cardCount: number): PhaseWeights => {
  if (cardCount < 4) return phaseWeights.early
  if (cardCount < 8) return phaseWeights.middle
  return phaseWeights.late
}

/** Clamp weights to depths ≤ maxDepth, redistributing removed mass proportionally. */
const clampWeights = (raw: PhaseWeights, maxDepth: Depth): PhaseWeights => {
  const max = depthRank[maxDepth]
  const clamped = raw.map((w, i) => (i <= max ? w : 0)) as PhaseWeights
  const total = clamped.reduce((a, b) => a + b, 0)
  if (total === 0) return clamped
  return clamped.map((w) => w / total) as PhaseWeights
}

/** Weighted random pick from an array using numeric weights. */
const weightedPick = <T>(
  items: T[],
  getWeight: (item: T) => number,
  random = Math.random,
): T | null => {
  if (!items.length) return null
  const total = items.reduce((s, item) => s + getWeight(item), 0)
  let cursor = random() * total
  for (const item of items) {
    cursor -= getWeight(item)
    if (cursor <= 0) return item
  }
  return items.at(-1) ?? null
}

/** Uniform random pick from an array. */
const randomPick = <T>(items: T[], random = Math.random): T | null => {
  if (!items.length) return null
  return items[Math.floor(random() * items.length)]!
}

const matchesContext = (prompt: Prompt, context: ContextFilter): boolean =>
  context.length > 0 &&
  prompt.audience.some((audience) => context.includes(audience))

/** All active prompts matching context + enabled card types, up to the depth ceiling. */
const filterCandidates = (
  context: ContextFilter,
  maxDepth: Depth,
  includeWildcards: boolean,
  includeOvertChristian: boolean,
): Prompt[] =>
  promptLibrary.filter(
    (p) =>
      p.active &&
      isPromptEnabled(p, { includeWildcards, includeOvertChristian }) &&
      depthRank[p.depth] <= depthRank[maxDepth] &&
      matchesContext(p, context),
  )

/** Fallback: same context + enabled card types but ignore depth (rescue from empty pool). */
const filterFallback = (
  context: ContextFilter,
  includeWildcards: boolean,
  includeOvertChristian: boolean,
): Prompt[] =>
  promptLibrary.filter(
    (p) =>
      p.active &&
      isPromptEnabled(p, { includeWildcards, includeOvertChristian }) &&
      matchesContext(p, context),
  )

export const pickPrompt = ({
  context,
  depth,
  includeWildcards,
  includeOvertChristian,
  recentPromptIds,
  seenPromptIds,
  sessionCardCount,
  random,
}: GenerateOptions): PickPromptResult => {
  const rng = random ?? Math.random

  // 1. Gather candidates up to the depth ceiling
  let candidatePool = filterCandidates(
    context,
    depth,
    includeWildcards,
    includeOvertChristian,
  )

  // If the depth ceiling is too restrictive, fall back to all depths
  if (!candidatePool.length) {
    candidatePool = filterFallback(
      context,
      includeWildcards,
      includeOvertChristian,
    )
  }

  if (!candidatePool.length) {
    return { prompt: null, exhaustedUnseen: false }
  }

  // 2. Prefer unseen, then prefer not-recently-shown
  const seenSet = new Set(seenPromptIds)
  const unseenPool = candidatePool.filter((p) => !seenSet.has(p.id))

  let pool: Prompt[]
  let exhaustedUnseen = false

  if (unseenPool.length > 0) {
    const sessionFresh = unseenPool.filter(
      (p) => !recentPromptIds.includes(p.id),
    )
    pool = sessionFresh.length > 0 ? sessionFresh : unseenPool
  } else {
    exhaustedUnseen = true
    const sessionFresh = candidatePool.filter(
      (p) => !recentPromptIds.includes(p.id),
    )
    pool = sessionFresh.length > 0 ? sessionFresh : candidatePool
  }

  // 3. If depth ceiling is "light" or only one depth tier is represented,
  //    skip progression weighting — just pick uniformly.
  const depthsInPool = new Set(pool.map((p) => p.depth))
  if (depth === 'light' || depthsInPool.size <= 1) {
    return { prompt: randomPick(pool, rng), exhaustedUnseen }
  }

  // 4. Depth progression: weight each card by its depth tier
  const weights = clampWeights(getPhase(sessionCardCount), depth)
  const weightOf = (p: Prompt): number => weights[depthRank[p.depth]] ?? 1

  return {
    prompt: weightedPick(pool, weightOf, rng),
    exhaustedUnseen,
  }
}

export const getPromptById = (promptId: string | null): Prompt | null => {
  if (!promptId) {
    return null
  }

  return promptMap.get(promptId) ?? null
}

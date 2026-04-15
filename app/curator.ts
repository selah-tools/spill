import { component, html, reactive } from '@arrow-js/core'

import {
  getCuration,
  isReviewed,
  issueOptions,
  loadCurations,
  saveCurations,
  scoreLabels,
  signalOptions,
  statusLabels,
  type CurationStatus,
  type IssueTag,
  type QuestionCuration,
  type QuestionCurations,
  type QuickSignal,
  type ScoreKey,
  type ScoreValue,
} from './curation-store'
import {
  audienceOptions,
  categoryLabels,
  depthOptions,
  isOvertChristianQuestion,
  questionLibrary,
  fetchQuestionSource,
  getBundledQuestionSource,
  normalizeQuestionSource,
  type Audience,
  type Category,
  type Depth,
  type Question,
  type QuestionSourceItem,
} from './questions'

import './curator.css'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Missing #app')

// --- Admin token ---

const ADMIN_TOKEN_KEY = 'spill:admin-token'

import { FileDiff, type FileContents } from '@pierre/diffs'

const getAdminToken = (): string =>
  sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? ''

const setAdminToken = (token: string): void => {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  adminState.token = token
}

const promptForToken = (): void => {
  const token = window.prompt('Enter admin token:', getAdminToken())
  if (token != null) setAdminToken(token)
}

const adminHeaders = (): Headers => {
  const h = new Headers({ 'Content-Type': 'application/json' })
  const token = getAdminToken()
  if (token) h.set('Authorization', `Bearer ${token}`)
  return h
}

// --- API response types ---

type FeedbackCounters = {
  upvotes: number
  downvotes: number
  views: number
  copies: number
  shares: number
  wildcardDraws: number
  questionRequests: number
}

type FeedbackRow = {
  cid: string
  question: QuestionSourceItem | null
  counters: FeedbackCounters
  downvoteReasons: string[]
  netScore: number
  totalEngagement: number
  upvoteRate: number
}

type InsightsBreakdown = {
  field: string
  value: string
  upvotes: number
  downvotes: number
  net: number
  count: number
}

type Insights = {
  topLiked: FeedbackRow[]
  topDisliked: FeedbackRow[]
  mostEngaged: FeedbackRow[]
  mostControversial: FeedbackRow[]
  commonDownvoteReasons: Array<{ reason: string; count: number }>
  byAudience: InsightsBreakdown[]
  byDepth: InsightsBreakdown[]
  byCategory: InsightsBreakdown[]
  byMode: InsightsBreakdown[]
}

type ExplorerData = {
  rows: FeedbackRow[]
  insights: Insights
  totalFeedbackCids: number
  totalSourceQuestions: number
}

// --- Reactive state ---

type Tab = 'curate' | 'feedback' | 'insights' | 'source'
type ViewFilter = 'all' | 'unreviewed'
type FeedbackSort = 'net' | 'upvotes' | 'downvotes' | 'engagement'

const adminState = reactive({
  token: getAdminToken(),
})

const state = reactive({
  tab: 'curate' as Tab,
  // Curate
  curations: loadCurations() as QuestionCurations,
  index: 0,
  filter: 'all' as ViewFilter,
  // Feedback
  explorerLoaded: false,
  explorerLoading: false,
  explorerError: '',
  explorerData: null as ExplorerData | null,
  feedbackSort: 'net' as FeedbackSort,
  feedbackSearch: '',
  feedbackAudience: '' as string,
  feedbackDepth: '' as string,
  expandedRow: -1,
  // Insights
  // (reads from explorerData)
  // Source
  sourceLoaded: false,
  sourceLoading: false,
  sourceError: '',
  sourceDraft: [] as QuestionSourceItem[],
  sourcePublished: [] as QuestionSourceItem[],
  sourceProd: [] as QuestionSourceItem[],
  sourcePublishing: false,
  sourcePublishError: '',
  sourcePublishSuccess: false,
  sourceDiffOpen: false,
  sourceJsonMode: false,
  sourceJsonText: '',
  sourceExpandedIdx: -1,
  sourceSearch: '',
  explorerLastUpdated: '' as string,
})

// --- Curate helpers (preserved from original) ---

const cur = (id: string): QuestionCuration => getCuration(state.curations, id)

const save = (
  id: string,
  updater: (c: QuestionCuration) => QuestionCuration,
): void => {
  const next = updater(cur(id))
  state.curations[id] = { ...next, updatedAt: new Date().toISOString() }
  saveCurations(state.curations)
}

const filtered = (): Question[] =>
  questionLibrary.filter((q) => {
    if (state.filter === 'unreviewed' && isReviewed(cur(q.id))) return false
    return true
  })

const question = (): Question | null => filtered()[state.index] ?? null

const clampIndex = (): void => {
  const len = filtered().length
  if (state.index >= len) state.index = Math.max(0, len - 1)
}

const go = (delta: number): void => {
  const len = filtered().length
  if (!len) return
  state.index = Math.min(len - 1, Math.max(0, state.index + delta))
  syncNote()
}

const jumpUnreviewed = (): void => {
  const list = filtered()
  const next = list
    .slice(state.index + 1)
    .findIndex((q) => !isReviewed(cur(q.id)))
  if (next >= 0) {
    state.index = state.index + 1 + next
    syncNote()
    return
  }
  const first = list.findIndex((q) => !isReviewed(cur(q.id)))
  if (first >= 0) {
    state.index = first
    syncNote()
  }
}

const setCurateFilter = (f: ViewFilter): void => {
  state.filter = f
  clampIndex()
  syncNote()
}

const setStatus = (status: CurationStatus): void => {
  const q = question()
  if (q) save(q.id, (c) => ({ ...c, status }))
}

const toggleFav = (): void => {
  const q = question()
  if (!q) return
  const c = cur(q.id)
  const on = c.issues.includes('great-example')
  save(q.id, (c) => ({
    ...c,
    status: !on && c.status === 'unreviewed' ? 'keep' : c.status,
    issues: on
      ? c.issues.filter((i) => i !== 'great-example')
      : [...c.issues, 'great-example'],
  }))
}

const toggleSignal = (signal: QuickSignal): void => {
  const q = question()
  if (!q) return
  save(q.id, (c) => ({
    ...c,
    signals: c.signals.includes(signal)
      ? c.signals.filter((s) => s !== signal)
      : [...c.signals, signal],
  }))
}

const toggleIssue = (tag: IssueTag): void => {
  const q = question()
  if (!q) return
  save(q.id, (c) => ({
    ...c,
    issues: c.issues.includes(tag)
      ? c.issues.filter((i) => i !== tag)
      : [...c.issues, tag],
  }))
}

const setScore = (key: ScoreKey, val: ScoreValue): void => {
  const q = question()
  if (!q) return
  save(q.id, (c) => ({
    ...c,
    scores: { ...c.scores, [key]: c.scores[key] === val ? null : val },
  }))
}

const setNote = (note: string): void => {
  const q = question()
  if (q) save(q.id, (c) => ({ ...c, notes: note }))
}

const syncNote = (): void => {
  requestAnimationFrame(() => {
    const el = root.querySelector<HTMLTextAreaElement>('.note-field')
    const q = question()
    if (el && q) el.value = cur(q.id).notes
  })
}

const curateStats = () => {
  const reviewed = questionLibrary.filter((q) => isReviewed(cur(q.id))).length
  return { reviewed, total: questionLibrary.length }
}

const audienceLabel = (a: Audience) =>
  audienceOptions.find((o) => o.value === a)?.label ?? a
const depthLabel = (d: Depth) =>
  depthOptions.find((o) => o.value === d)?.label ?? d
const isFav = (c: QuestionCuration) => c.issues.includes('great-example')
const hasSig = (id: string, s: QuickSignal) => cur(id).signals.includes(s)
const curId = (): string => question()?.id ?? ''

// --- Feedback helpers ---

const loadExplorer = async (): Promise<void> => {
  if (state.explorerLoading) return
  state.explorerLoading = true
  state.explorerError = ''
  try {
    const res = await fetch('/api/feedback-explorer', {
      headers: adminHeaders(),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        (body as Record<string, string>).error ?? `HTTP ${res.status}`,
      )
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) {
      throw new Error('API unavailable — are you running vercel dev?')
    }
    state.explorerData = (await res.json()) as ExplorerData
    state.explorerLoaded = true
    state.explorerLastUpdated = new Date().toLocaleTimeString()
  } catch (e) {
    state.explorerError =
      e instanceof Error ? e.message : 'Failed to load feedback'
  } finally {
    state.explorerLoading = false
  }
}

const exportFeedback = (): void => {
  if (!state.explorerData) return
  const rows = sortFeedback(filterFeedback(state.explorerData.rows))
  const csv = [
    [
      'cid',
      'question',
      'audience',
      'depth',
      'category',
      'mode',
      'upvotes',
      'downvotes',
      'net',
      'views',
      'copies',
      'shares',
      'engagement',
      'upvote_rate',
      'downvote_reasons',
    ].join(','),
    ...rows.map((r) =>
      [
        r.cid,
        '"' + (r.question?.text ?? '').replace(/"/g, '""') + '"',
        '"' + (r.question?.audience?.join('; ') ?? '') + '"',
        r.question?.depth ?? '',
        r.question?.category ?? '',
        r.question?.mode ?? '',
        r.counters.upvotes,
        r.counters.downvotes,
        r.netScore,
        r.counters.views,
        r.counters.copies,
        r.counters.shares,
        r.totalEngagement,
        r.upvoteRate.toFixed(3),
        '"' + r.downvoteReasons.join('; ').replace(/"/g, '""') + '"',
      ].join(','),
    ),
  ].join('\n')
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(`spill-feedback-${date}.csv`, csv, 'text/csv')
}

const sortFeedback = (rows: FeedbackRow[]): FeedbackRow[] => {
  const sorted = [...rows]
  const key = state.feedbackSort
  sorted.sort((a, b) => {
    switch (key) {
      case 'net':
        return b.netScore - a.netScore
      case 'upvotes':
        return b.counters.upvotes - a.counters.upvotes
      case 'downvotes':
        return b.counters.downvotes - a.counters.downvotes
      case 'engagement':
        return b.totalEngagement - a.totalEngagement
      default:
        return 0
    }
  })
  return sorted
}

const filterFeedback = (rows: FeedbackRow[]): FeedbackRow[] => {
  let result = rows
  if (state.feedbackSearch) {
    const q = state.feedbackSearch.toLowerCase()
    result = result.filter(
      (r) =>
        (r.question?.text ?? '').toLowerCase().includes(q) ||
        r.cid.toLowerCase().includes(q),
    )
  }
  if (state.feedbackAudience) {
    result = result.filter((r) =>
      r.question?.audience.includes(state.feedbackAudience as Audience),
    )
  }
  if (state.feedbackDepth) {
    result = result.filter((r) => r.question?.depth === state.feedbackDepth)
  }
  return result
}

// --- Source helpers ---

const loadSource = async (): Promise<void> => {
  if (state.sourceLoading) return
  state.sourceLoading = true
  state.sourceError = ''
  try {
    let source: QuestionSourceItem[]
    try {
      source = await fetchQuestionSource({
        includeArchived: true,
        authToken: adminState.token,
      })
    } catch {
      source = getBundledQuestionSource()
    }
    state.sourceDraft = source.map((q) => ({
      ...q,
      audience: [...q.audience],
      tags: [...q.tags],
    }))
    state.sourcePublished = source.map((q) => ({
      ...q,
      audience: [...q.audience],
      tags: [...q.tags],
    }))
    state.sourceProd = getBundledQuestionSource().map((q) => ({
      ...q,
      audience: [...q.audience],
      tags: [...q.tags],
    }))
    state.sourceLoaded = true
  } catch (e) {
    state.sourceError = e instanceof Error ? e.message : 'Failed to load source'
  } finally {
    state.sourceLoading = false
  }
}

const addSourceQuestion = (): void => {
  const id = `draft-${Date.now()}`
  state.sourceDraft.push({
    id,
    text: '',
    audience: ['friends'],
    depth: 'light',
    mode: 'prompt',
    category: 'identity',
    tags: [],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    archivedAt: null,
  })
  void scheduleDiffUpdate()
}

const removeDraftQuestion = (index: number): void => {
  state.sourceDraft.splice(index, 1)
  void scheduleDiffUpdate()
}

const archiveSourceQuestion = (index: number): void => {
  const q = state.sourceDraft[index]
  if (!q) return
  state.sourceDraft[index] = {
    ...q,
    active: false,
    archivedAt: new Date().toISOString(),
  }
  void scheduleDiffUpdate()
}

const unarchiveSourceQuestion = (index: number): void => {
  const q = state.sourceDraft[index]
  if (!q) return
  state.sourceDraft[index] = {
    ...q,
    active: true,
    archivedAt: null,
  }
  void scheduleDiffUpdate()
}

const updateDraftField = (
  index: number,
  field: 'text' | 'depth' | 'mode' | 'category' | 'active',
  value: string | boolean,
): void => {
  const q = state.sourceDraft[index]
  if (!q) return
  ;(q as Record<string, unknown>)[field] = value
  void scheduleDiffUpdate()
}

const toggleDraftAudience = (index: number, audience: Audience): void => {
  const q = state.sourceDraft[index]
  if (!q) return
  const has = q.audience.includes(audience)
  q.audience = has
    ? q.audience.filter((a) => a !== audience)
    : [...q.audience, audience]
  if (q.audience.length === 0) q.audience = [audience]
  void scheduleDiffUpdate()
}

const sourceHasChanges = (): boolean => {
  if (state.sourceDraft.length !== state.sourcePublished.length) return true
  return (
    JSON.stringify(state.sourceDraft) !== JSON.stringify(state.sourcePublished)
  )
}

const sourceComparableJson = (items: QuestionSourceItem[]): string =>
  JSON.stringify(
    items
      .map(({ id, text, audience, depth, mode, category, tags, active }) => ({
        id,
        text,
        audience: [...audience].sort(),
        depth,
        mode,
        category,
        tags: [...tags].sort(),
        active,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  )

const differsFromProd = (): boolean =>
  sourceComparableJson(state.sourceDraft) !==
  sourceComparableJson(state.sourceProd)

const publishSource = async (): Promise<void> => {
  state.sourcePublishing = true
  state.sourcePublishError = ''
  state.sourcePublishSuccess = false
  try {
    const normalized = normalizeQuestionSource(state.sourceDraft)
    const res = await fetch('/api/questions-source', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ questions: normalized }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        (body as Record<string, string>).error ?? `HTTP ${res.status}`,
      )
    }
    state.sourceDraft = normalized.map((q) => ({
      ...q,
      audience: [...q.audience],
      tags: [...q.tags],
    }))
    state.sourcePublished = normalized.map((q) => ({
      ...q,
      audience: [...q.audience],
      tags: [...q.tags],
    }))
    state.sourcePublishSuccess = true
    setTimeout(() => {
      state.sourcePublishSuccess = false
    }, 3000)
  } catch (e) {
    state.sourcePublishError = e instanceof Error ? e.message : 'Publish failed'
  } finally {
    state.sourcePublishing = false
  }
}

const resetSourceDraft = (): void => {
  state.sourceDraft = state.sourcePublished.map((q) => ({
    ...q,
    audience: [...q.audience],
    tags: [...q.tags],
  }))
}

let diffInstance: FileDiff | null = null
let diffRafPending = false

const draftToComparableJson = (items: QuestionSourceItem[]): string =>
  JSON.stringify(
    items.map(
      ({ id, text, audience, depth, mode, category, tags, active }) => ({
        id,
        text,
        audience,
        depth,
        mode,
        category,
        tags,
        active,
      }),
    ),
    null,
    2,
  )

const renderSourceDiff = (): void => {
  const container = document.getElementById('source-diff-container')
  if (!container) return

  if (!diffInstance) {
    diffInstance = new FileDiff({
      theme: 'pierre-light',
      diffStyle: 'unified',
    })
  }

  const oldFile: FileContents = {
    name: 'prod',
    contents: draftToComparableJson(state.sourceProd),
    lang: 'json',
  }

  const newFile: FileContents = {
    name: 'draft',
    contents: draftToComparableJson(state.sourceDraft),
    lang: 'json',
  }

  diffInstance.render({
    oldFile,
    newFile,
    containerWrapper: container,
  })
}

const scheduleDiffUpdate = (): void => {
  if (!state.sourceDiffOpen || diffRafPending) return
  diffRafPending = true
  requestAnimationFrame(() => {
    diffRafPending = false
    renderSourceDiff()
  })
}

const toggleSourceDiff = (): void => {
  state.sourceDiffOpen = !state.sourceDiffOpen
  if (state.sourceDiffOpen) {
    requestAnimationFrame(() => renderSourceDiff())
  }
}

const toggleJsonEditor = (): void => {
  state.sourceJsonMode = !state.sourceJsonMode
  if (state.sourceJsonMode) {
    state.sourceJsonText = JSON.stringify(
      state.sourceDraft.map(
        ({ id, text, audience, depth, mode, category, tags, active }) => ({
          id,
          text,
          audience,
          depth,
          mode,
          category,
          tags,
          active,
        }),
      ),
      null,
      2,
    )
  }
}

const applyJsonDraft = (): void => {
  try {
    const parsed = JSON.parse(state.sourceJsonText) as unknown[]
    const normalized = normalizeQuestionSource(parsed)
    state.sourceDraft = normalized
    scheduleDiffUpdate()
  } catch {
    // validation errors shown in UI
  }
}

// --- Tab navigation ---

let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 10_000

const startPolling = (): void => {
  stopPolling()
  pollTimer = setInterval(() => {
    if (state.tab === 'feedback' || state.tab === 'insights') {
      void loadExplorer()
    }
  }, POLL_INTERVAL)
}

const stopPolling = (): void => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const setTab = (tab: Tab): void => {
  state.tab = tab
  if (tab === 'feedback' || tab === 'insights') {
    if (!state.explorerLoaded) void loadExplorer()
    startPolling()
  } else {
    stopPolling()
  }
  if (tab === 'source' && !state.sourceLoaded) void loadSource()
}

// --- Exports (preserved) ---

const downloadFile = (name: string, content: string, mime: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const buildGuidance = (): string => {
  const reviewed = questionLibrary
    .map((q) => ({ q, c: cur(q.id) }))
    .filter(({ c }) => isReviewed(c))
  const best = reviewed
    .filter(
      ({ c }) =>
        isFav(c) ||
        c.status === 'keep' ||
        c.signals.includes('fun') ||
        c.signals.includes('uplifting'),
    )
    .sort((a, b) => {
      const s = (c: QuestionCuration) =>
        (isFav(c) ? 8 : 0) +
        (c.signals.includes('fun') ? 3 : 0) +
        (c.signals.includes('uplifting') ? 2 : 0) -
        (c.signals.includes('intense') ? 2 : 0) +
        (c.scores.overall ?? 0)
      return s(b.c) - s(a.c)
    })
    .slice(0, 14)
  const issues = issueOptions
    .map((i) => ({
      ...i,
      n: reviewed.filter(({ c }) => c.issues.includes(i.value)).length,
    }))
    .filter((i) => i.n > 0)
    .sort((a, b) => b.n - a.n)
  const revCut = reviewed
    .filter(({ c }) => c.status === 'revise' || c.status === 'cut')
    .slice(0, 20)
  const funN = reviewed.filter(({ c }) => c.signals.includes('fun')).length
  const upN = reviewed.filter(({ c }) => c.signals.includes('uplifting')).length
  const intN = reviewed.filter(({ c }) => c.signals.includes('intense')).length
  const favN = reviewed.filter(({ c }) => isFav(c)).length

  return `# Spill Question Generation Guidance
Generated: ${new Date().toISOString()}

## Summary
- Reviewed: ${reviewed.length} / ${questionLibrary.length}
- Fun: ${funN} \xb7 Uplifting: ${upN} \xb7 Intense: ${intN} \xb7 Favorites: ${favN}

## Best Examples
${
  best
    .map(({ q, c }) => {
      const m = [
        isFav(c) ? 'Fav' : '',
        c.signals.includes('fun') ? 'Fun' : '',
        c.signals.includes('uplifting') ? 'Uplift' : '',
        c.signals.includes('intense') ? 'Intense' : '',
      ]
        .filter(Boolean)
        .join(' \xb7 ')
      return `- **${audienceLabel(q.audience[0])} \xb7 ${depthLabel(q.depth)}${m ? ` \xb7 ${m}` : ''}** \u2014 ${q.text}`
    })
    .join('\n') || '(none yet)'
}

## Problems to Avoid
${issues.map((i) => `- **${i.label}** (${i.n}) \u2014 ${i.hint}`).join('\n') || '(none tagged)'}

## Revision / Bad
${revCut.map(({ q, c }) => `- **${statusLabels[c.status]} \xb7 ${audienceLabel(q.audience[0])} \xb7 ${depthLabel(q.depth)}** \u2014 ${q.text}${c.notes ? ` [${c.notes}]` : ''}`).join('\n') || '(none)'}

## Heuristics
- Fun opens the room. Uplifting warms it. Intense deepens it.
- Too many intense cards in a row hurts the room's tone.
- Light questions should be genuinely fun, not just "less deep."
- Avoid sounding like a devotional or therapy exercise.
- Clarity and speakability over cleverness.
`
}

const exportGuidance = () =>
  downloadFile('spill-guidance.md', buildGuidance(), 'text/markdown')
const exportJson = () =>
  downloadFile(
    'spill-curations.json',
    JSON.stringify({ curations: state.curations }, null, 2),
    'application/json',
  )

// --- Keyboard shortcuts (curate tab only) ---

document.addEventListener('keydown', (e) => {
  if (state.tab !== 'curate') return
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    go(1)
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    go(-1)
  }
  if (e.key === 'k') setStatus('keep')
  if (e.key === 'r') setStatus('revise')
  if (e.key === 'x') setStatus('cut')
  if (e.key === 'f') toggleFav()
})

// --- Templates ---

// Curate tab — preserved original curation flow
const CurateTab = component(
  () => html`
    <div class="top">
      <h1 class="title">Spill Curator</h1>
      <span class="progress-text"
        >${() =>
          curateStats().reviewed +
          ' / ' +
          curateStats().total +
          ' reviewed'}</span
      >
    </div>

    <div class="bar">
      <div
        class="bar-fill"
        style="${() =>
          'width:' +
          ((curateStats().reviewed / curateStats().total) * 100 || 0) +
          '%'}"
      ></div>
    </div>

    <div class="filter-row">
      <button
        type="button"
        class="${() =>
          'filter-chip' + (state.filter === 'all' ? ' is-on' : '')}"
        @click="${() => setCurateFilter('all')}"
      >
        All
      </button>
      <button
        type="button"
        class="${() =>
          'filter-chip' + (state.filter === 'unreviewed' ? ' is-on' : '')}"
        @click="${() => setCurateFilter('unreviewed')}"
      >
        Unreviewed
      </button>
      <span class="spacer"></span>
      <button type="button" class="small-btn" @click="${jumpUnreviewed}">
        Skip to next
      </button>
    </div>

    <div class="nav">
      <button type="button" class="nav-btn" @click="${() => go(-1)}">←</button>
      <span class="nav-counter"
        >${() =>
          filtered().length
            ? state.index + 1 + ' / ' + filtered().length
            : '\u2014'}</span
      >
      <button type="button" class="nav-btn" @click="${() => go(1)}">→</button>
    </div>

    ${() => {
      const q = question()
      if (!q)
        return html`<div class="empty">No questions match this filter.</div>`

      return html`
        <article class="card">
          <p class="card-text">${() => question()?.text ?? ''}</p>
          <div class="card-meta">
            <span class="pill"
              >${() =>
                question()?.mode === 'wildcard' ? 'Wildcard' : 'Question'}</span
            >
            ${() =>
              question() && isOvertChristianQuestion(question()!)
                ? html`<span class="pill">Overt</span>`
                : null}
            <span class="pill"
              >${() => depthLabel(question()?.depth ?? 'light')}</span
            >
            <span class="pill"
              >${() => categoryLabels[question()?.category ?? 'identity']}</span
            >
            ${() =>
              (question()?.audience ?? []).map(
                (a) => html`<span class="pill">${audienceLabel(a)}</span>`,
              )}
          </div>
          <p class="card-id">${() => curId()}</p>
        </article>

        <div class="actions">
          <p class="act-label">Decision</p>
          <button
            type="button"
            class="${() =>
              'act-btn is-keep' +
              (cur(curId()).status === 'keep' ? ' is-on' : '')}"
            @click="${() => setStatus('keep')}"
          >
            Good
          </button>
          <button
            type="button"
            class="${() =>
              'act-btn is-revise' +
              (cur(curId()).status === 'revise' ? ' is-on' : '')}"
            @click="${() => setStatus('revise')}"
          >
            Revision
          </button>
          <button
            type="button"
            class="${() =>
              'act-btn is-cut' +
              (cur(curId()).status === 'cut' ? ' is-on' : '')}"
            @click="${() => setStatus('cut')}"
          >
            Bad
          </button>
          <button
            type="button"
            class="${() =>
              'act-btn is-fav' + (isFav(cur(curId())) ? ' is-on' : '')}"
            @click="${toggleFav}"
          >
            ${() =>
              isFav(cur(curId())) ? '\u2605 Favorite' : '\u2606 Favorite'}
          </button>
        </div>

        <div class="actions">
          <p class="act-label">Tone</p>
          ${signalOptions.map(
            (sig) => html`
              <button
                type="button"
                class="${() =>
                  'act-btn is-' +
                  sig.value +
                  (hasSig(curId(), sig.value) ? ' is-on' : '')}"
                @click="${() => toggleSignal(sig.value)}"
              >
                ${() =>
                  hasSig(curId(), sig.value)
                    ? '\u2713 ' + sig.label
                    : sig.label}
              </button>
            `,
          )}
        </div>

        <textarea
          class="note-field"
          placeholder="Quick note (optional)..."
          @input="${(e: Event) =>
            setNote((e.currentTarget as HTMLTextAreaElement).value)}"
        ></textarea>

        <details>
          <summary>Issue tags & advanced scoring</summary>
          <div class="detail-inner">
            <div class="detail-section">
              <p class="detail-label">Issue tags</p>
              <div class="issue-grid">
                ${issueOptions.map(
                  (issue) => html`
                    <button
                      type="button"
                      class="${() =>
                        'issue-btn' +
                        (cur(curId()).issues.includes(issue.value)
                          ? ' is-on'
                          : '')}"
                      @click="${() => toggleIssue(issue.value)}"
                      title="${issue.hint}"
                    >
                      ${issue.label}
                    </button>
                  `,
                )}
              </div>
            </div>
            <div class="detail-section">
              <p class="detail-label">Scoring</p>
              ${(Object.keys(scoreLabels) as ScoreKey[]).map(
                (key) => html`
                  <div class="score-row">
                    <span class="score-name">${scoreLabels[key]}</span>
                    <div class="score-dots">
                      ${[1, 2, 3, 4, 5].map(
                        (v) => html`
                          <button
                            type="button"
                            class="${() =>
                              'score-dot' +
                              (cur(curId()).scores[key] === v ? ' is-on' : '')}"
                            @click="${() => setScore(key, v as ScoreValue)}"
                          >
                            ${v}
                          </button>
                        `,
                      )}
                    </div>
                  </div>
                `,
              )}
            </div>
          </div>
        </details>

        <div class="footer-nav">
          <button type="button" class="small-btn" @click="${() => go(-1)}">
            ← Previous
          </button>
          <button type="button" class="small-btn" @click="${() => go(1)}">
            Next →
          </button>
        </div>
      `
    }}

    <div class="export-row">
      <button
        type="button"
        class="small-btn small-btn--fill"
        @click="${exportGuidance}"
      >
        Export guidance
      </button>
      <button type="button" class="small-btn" @click="${exportJson}">
        Export JSON
      </button>
    </div>

    <p class="kbd-help">
      <kbd>←</kbd><kbd>→</kbd> navigate <kbd>k</kbd> good <kbd>r</kbd> revise
      <kbd>x</kbd> bad <kbd>f</kbd> fav
    </p>
  `,
)

// Feedback tab
const FeedbackTab = component(
  () => html`
    <div class="fb-header">
      <h2 class="section-title">Feedback Explorer</h2>
      <div class="fb-header-right">
        ${() =>
          state.explorerLastUpdated
            ? html`<span class="fb-live-badge">● Live</span>
                <span class="fb-updated"
                  >Updated ${() => state.explorerLastUpdated}</span
                >`
            : null}
        <button
          type="button"
          class="small-btn"
          @click="${() => void loadExplorer()}"
        >
          Refresh
        </button>
        ${() =>
          state.explorerData
            ? html`<button
                type="button"
                class="small-btn"
                @click="${exportFeedback}"
              >
                Export CSV
              </button>`
            : null}
      </div>
    </div>

    ${() => {
      if (state.explorerLoading && !state.explorerData) {
        return html`<div class="empty">Loading feedback data...</div>`
      }
      if (state.explorerError) {
        return html`<div class="empty empty--error">
          ${() => state.explorerError}
        </div>`
      }
      if (!state.explorerData) {
        return html`<div class="empty">No data loaded.</div>`
      }

      const rows = sortFeedback(filterFeedback(state.explorerData.rows))

      return html`
        <div class="fb-controls">
          <input
            type="search"
            class="fb-search"
            placeholder="Search questions..."
            @input="${(e: Event) => {
              state.feedbackSearch = (e.currentTarget as HTMLInputElement).value
            }}"
          />
          <select
            class="fb-select"
            @change="${(e: Event) => {
              state.feedbackAudience = (
                e.currentTarget as HTMLSelectElement
              ).value
            }}"
          >
            <option value="">All audiences</option>
            ${audienceOptions.map(
              (o) => html`<option value="${o.value}">${o.label}</option>`,
            )}
          </select>
          <select
            class="fb-select"
            @change="${(e: Event) => {
              state.feedbackDepth = (e.currentTarget as HTMLSelectElement).value
            }}"
          >
            <option value="">All depths</option>
            ${depthOptions.map(
              (o) => html`<option value="${o.value}">${o.label}</option>`,
            )}
          </select>
          <select
            class="fb-select"
            @change="${(e: Event) => {
              state.feedbackSort = (e.currentTarget as HTMLSelectElement)
                .value as FeedbackSort
            }}"
          >
            <option value="net">Sort: Net score</option>
            <option value="upvotes">Sort: Upvotes</option>
            <option value="downvotes">Sort: Downvotes</option>
            <option value="engagement">Sort: Engagement</option>
          </select>
        </div>

        <p class="fb-count">${() => rows.length + ' questions'}</p>

        <div class="fb-table-wrap">
          <table class="fb-table">
            <thead>
              <tr>
                <th class="fb-th">Question</th>
                <th class="fb-th fb-th--num">▲</th>
                <th class="fb-th fb-th--num">▼</th>
                <th class="fb-th fb-th--num">Net</th>
                <th class="fb-th fb-th--num">Eng</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                (row, idx) => html`
                  <tr
                    class="${() =>
                      'fb-row' +
                      (state.expandedRow === idx ? ' is-expanded' : '')}"
                    @click="${() => {
                      state.expandedRow = state.expandedRow === idx ? -1 : idx
                    }}"
                  >
                    <td class="fb-td fb-td--text">
                      <span class="fb-text-preview">
                        ${() => (row.question?.text ?? row.cid).slice(0, 80)}
                        ${() =>
                          (row.question?.text ?? row.cid).length > 80
                            ? '...'
                            : ''}
                      </span>
                      ${() =>
                        state.expandedRow === idx
                          ? html`
                              <div class="fb-expand">
                                <p class="fb-full-text">
                                  ${() => row.question?.text ?? '(no content)'}
                                </p>
                                <div class="fb-meta">
                                  <span class="pill"
                                    >${() => row.question?.mode ?? '?'}</span
                                  >
                                  <span class="pill"
                                    >${() =>
                                      row.question
                                        ? depthLabel(row.question.depth)
                                        : '?'}</span
                                  >
                                  <span class="pill"
                                    >${() =>
                                      row.question
                                        ? categoryLabels[row.question.category]
                                        : '?'}</span
                                  >
                                  ${() =>
                                    (row.question?.audience ?? []).map(
                                      (a) =>
                                        html`<span class="pill"
                                          >${audienceLabel(a)}</span
                                        >`,
                                    )}
                                </div>
                                <p class="fb-cid">${() => row.cid}</p>
                                ${() =>
                                  row.downvoteReasons.length > 0
                                    ? html`
                                        <div class="fb-reasons">
                                          <p class="fb-reasons-label">
                                            Downvote reasons:
                                          </p>
                                          <ul class="fb-reasons-list">
                                            ${row.downvoteReasons.map(
                                              (r) => html`<li>${() => r}</li>`,
                                            )}
                                          </ul>
                                        </div>
                                      `
                                    : null}
                                <div class="fb-counter-grid">
                                  <span
                                    >Views: ${() => row.counters.views}</span
                                  >
                                  <span
                                    >Copies: ${() => row.counters.copies}</span
                                  >
                                  <span
                                    >Shares: ${() => row.counters.shares}</span
                                  >
                                  <span
                                    >Wildcard draws:
                                    ${() => row.counters.wildcardDraws}</span
                                  >
                                </div>
                              </div>
                            `
                          : null}
                    </td>
                    <td class="fb-td fb-td--num">
                      ${() => row.counters.upvotes}
                    </td>
                    <td class="fb-td fb-td--num">
                      ${() => row.counters.downvotes}
                    </td>
                    <td
                      class="${() =>
                        'fb-td fb-td--num' +
                        (row.netScore > 0
                          ? ' is-pos'
                          : row.netScore < 0
                            ? ' is-neg'
                            : '')}"
                    >
                      ${() => row.netScore}
                    </td>
                    <td class="fb-td fb-td--num">
                      ${() => row.totalEngagement}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      `
    }}
  `,
)

// Insights tab
const InsightsTab = component(
  () => html`
    <h2 class="section-title">Insights</h2>

    ${() => {
      if (state.explorerLoading && !state.explorerData) {
        return html`<div class="empty">Loading...</div>`
      }
      if (!state.explorerData) {
        return html`<div class="empty">
          Load feedback data first (visit the Feedback tab).
        </div>`
      }

      const { insights, rows } = state.explorerData
      const withFeedback = rows.filter((r) => r.totalEngagement > 0).length
      let upvoteRateSum = 0
      for (const r of rows) upvoteRateSum += r.upvoteRate
      const avgUpvoteRate = rows.length > 0 ? upvoteRateSum / rows.length : 0
      const topReason = insights.commonDownvoteReasons[0]

      return html`
        <div class="insight-cards">
          <div class="insight-card">
            <p class="insight-value">${() => String(rows.length)}</p>
            <p class="insight-label">Total questions</p>
          </div>
          <div class="insight-card">
            <p class="insight-value">${() => String(withFeedback)}</p>
            <p class="insight-label">With feedback</p>
          </div>
          <div class="insight-card">
            <p class="insight-value">
              ${() => (avgUpvoteRate * 100).toFixed(1) + '%'}
            </p>
            <p class="insight-label">Avg upvote rate</p>
          </div>
          <div class="insight-card">
            <p class="insight-value">
              ${() => (topReason ? topReason.reason.slice(0, 30) : '\u2014')}
            </p>
            <p class="insight-label">Top downvote reason</p>
          </div>
        </div>

        <div class="insight-section">
          <h3 class="insight-heading">Top liked</h3>
          ${RankedRowList(insights.topLiked.slice(0, 5))}
        </div>

        <div class="insight-section">
          <h3 class="insight-heading">Most disliked</h3>
          ${RankedRowList(insights.topDisliked.slice(0, 5))}
        </div>

        <div class="insight-section">
          <h3 class="insight-heading">Most engaged</h3>
          ${RankedRowList(insights.mostEngaged.slice(0, 5))}
        </div>

        <div class="insight-section">
          <h3 class="insight-heading">Most controversial</h3>
          ${RankedRowList(insights.mostControversial.slice(0, 5))}
        </div>

        ${insights.commonDownvoteReasons.length > 0
          ? html`
              <div class="insight-section">
                <h3 class="insight-heading">Common downvote reasons</h3>
                <ul class="insight-list">
                  ${insights.commonDownvoteReasons.map(
                    (r) =>
                      html`<li>
                        ${() => r.reason}
                        <span class="insight-count">(${() => r.count})</span>
                      </li>`,
                  )}
                </ul>
              </div>
            `
          : null}
        ${BreakdownTable('By audience', insights.byAudience, (v) =>
          audienceLabel(v as Audience),
        )}
        ${BreakdownTable('By depth', insights.byDepth, (v) =>
          depthLabel(v as Depth),
        )}
        ${BreakdownTable(
          'By category',
          insights.byCategory,
          (v) => categoryLabels[v as Category] ?? v,
        )}
        ${BreakdownTable('By mode', insights.byMode, (v) => v)}
      `
    }}
  `,
)

const RankedRowList = (rows: FeedbackRow[]) => html`
  <ol class="insight-list">
    ${rows.map(
      (row) => html`
        <li>
          <span class="insight-rank-text"
            >${() => row.question?.text?.slice(0, 90) ?? row.cid}</span
          >
          <span class="insight-rank-meta">
            ▲ ${() => row.counters.upvotes} ▼ ${() => row.counters.downvotes}
            (net ${() => row.netScore})
          </span>
        </li>
      `,
    )}
  </ol>
`

const BreakdownTable = (
  title: string,
  data: InsightsBreakdown[],
  labelFn: (value: string) => string,
) => html`
  <div class="insight-section">
    <h3 class="insight-heading">${() => title}</h3>
    <table class="fb-table">
      <thead>
        <tr>
          <th class="fb-th">Value</th>
          <th class="fb-th fb-th--num">Count</th>
          <th class="fb-th fb-th--num">▲</th>
          <th class="fb-th fb-th--num">▼</th>
          <th class="fb-th fb-th--num">Net</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(
          (row) => html`
            <tr>
              <td class="fb-td">${() => labelFn(row.value)}</td>
              <td class="fb-td fb-td--num">${() => row.count}</td>
              <td class="fb-td fb-td--num">${() => row.upvotes}</td>
              <td class="fb-td fb-td--num">${() => row.downvotes}</td>
              <td
                class="${() =>
                  'fb-td fb-td--num' +
                  (row.net > 0 ? ' is-pos' : row.net < 0 ? ' is-neg' : '')}"
              >
                ${() => row.net}
              </td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  </div>
`

// Source tab
const SourceTab = component(
  () => html`
    <div class="src-header">
      <h2 class="section-title">Question Source</h2>
      <div class="src-actions">
        ${() =>
          !state.sourceJsonMode
            ? html`<button
                type="button"
                class="small-btn"
                @click="${() => addSourceQuestion()}"
              >
                + Add
              </button>`
            : null}
        ${() =>
          sourceHasChanges()
            ? html`<button
                type="button"
                class="small-btn"
                @click="${resetSourceDraft}"
              >
                Reset
              </button>`
            : null}
        ${() =>
          sourceHasChanges()
            ? html`<button
                type="button"
                class="${() =>
                  'small-btn' + (state.sourceDiffOpen ? ' is-on' : '')}"
                @click="${toggleSourceDiff}"
              >
                ${() => (state.sourceDiffOpen ? 'Hide diff' : 'Diff')}
              </button>`
            : null}
        <button
          type="button"
          class="${() => 'small-btn' + (state.sourceJsonMode ? ' is-on' : '')}"
          @click="${toggleJsonEditor}"
        >
          ${() => (state.sourceJsonMode ? 'Form' : 'JSON')}
        </button>
        <button
          type="button"
          class="${() =>
            'small-btn small-btn--fill' +
            (state.sourcePublishing || !sourceHasChanges()
              ? ' is-disabled'
              : '')}"
          @click="${() => void publishSource()}"
        >
          ${() => (state.sourcePublishing ? 'Publishing\u2026' : 'Publish')}
        </button>
      </div>
    </div>

    ${() => {
      if (state.sourceLoading && !state.sourceLoaded) {
        return html`<div class="empty">Loading source...</div>`
      }
      if (state.sourceError) {
        return html`<div class="empty empty--error">
          ${() => state.sourceError}
        </div>`
      }
      if (state.sourcePublishSuccess) {
        return html`<div class="empty empty--success">
          Published. Deploy triggered — changes go live in ~60s.
        </div>`
      }
      if (state.sourcePublishError) {
        return html`<div class="empty empty--error">
          ${() => state.sourcePublishError}
        </div>`
      }

      const active = state.sourceDraft.filter((q) => q.active && !q.archivedAt)
      const archived = state.sourceDraft.filter((q) => q.archivedAt)
      const diffOpen = state.sourceDiffOpen && sourceHasChanges()

      return html`
        <div class="src-toolbar">
          <span class="src-count">
            ${() => active.length} active · ${() => archived.length} archived
          </span>
          ${() =>
            sourceHasChanges()
              ? html`<span class="src-status src-status--changed"
                  >Unsaved</span
                >`
              : html`<span class="src-status">Clean</span>`}
          ${() =>
            differsFromProd()
              ? html`<span class="src-prod-flag">Differs from prod</span>`
              : html`<span class="src-prod-flag src-prod-flag--match"
                  >Matches prod</span
                >`}
          <span class="spacer"></span>
          <input
            type="search"
            class="src-search"
            placeholder="Filter questions…"
            @input="${(e: Event) => {
              state.sourceSearch = (e.currentTarget as HTMLInputElement).value
            }}"
          />
        </div>

        <div class="${() => 'src-layout' + (diffOpen ? ' has-diff' : '')}">
          <div class="src-editor">
            ${() =>
              state.sourceJsonMode
                ? html`
                    <textarea
                      class="src-json-editor"
                      spellcheck="false"
                      @input="${(e: Event) => {
                        state.sourceJsonText = (
                          e.currentTarget as HTMLTextAreaElement
                        ).value
                      }}"
                    >
${() => state.sourceJsonText}</textarea
                    >
                    <div class="src-json-actions">
                      <button
                        type="button"
                        class="small-btn small-btn--fill"
                        @click="${applyJsonDraft}"
                      >
                        Apply JSON
                      </button>
                    </div>
                  `
                : html`
                    ${() => {
                      const search = state.sourceSearch.toLowerCase()
                      const filtered = search
                        ? active.filter(
                            (q) =>
                              q.text.toLowerCase().includes(search) ||
                              q.id.toLowerCase().includes(search),
                          )
                        : active
                      return filtered.map((q) => {
                        const realIdx = state.sourceDraft.indexOf(q)
                        return SourceRow(realIdx)
                      })
                    }}
                    ${() =>
                      archived.length > 0 && !state.sourceSearch
                        ? html`
                            <details class="src-archived">
                              <summary>
                                Archived (${() => String(archived.length)})
                              </summary>
                              ${() =>
                                archived.map((q) => {
                                  const realIdx = state.sourceDraft.indexOf(q)
                                  return SourceRow(realIdx)
                                })}
                            </details>
                          `
                        : null}
                  `}
          </div>

          ${() =>
            diffOpen
              ? html`
                  <div class="src-diff-panel">
                    <div class="src-diff-panel-header">
                      <span class="src-diff-label">Draft vs Published</span>
                    </div>
                    <div id="source-diff-container" class="src-diff"></div>
                  </div>
                `
              : null}
        </div>
      `
    }}
  `,
)

const toggleSourceRow = (idx: number, e: Event): void => {
  // Don't toggle if clicking inside an interactive element
  const target = e.target as HTMLElement
  if (
    target.closest('button') ||
    target.closest('textarea') ||
    target.closest('select') ||
    target.closest('input')
  )
    return
  state.sourceExpandedIdx = state.sourceExpandedIdx === idx ? -1 : idx
}

const SourceRow = (idx: number) => html`
  <div
    class="${() =>
      'src-row' +
      (state.sourceDraft[idx]?.archivedAt ? ' is-archived' : '') +
      (state.sourceExpandedIdx === idx ? ' is-expanded' : '')}"
    @click="${(e: Event) => toggleSourceRow(idx, e)}"
  >
    <div class="src-row-collapsed">
      <span class="src-row-text"
        >${() => {
          const text = state.sourceDraft[idx]?.text ?? ''
          return text.length > 90
            ? text.slice(0, 90) + '\u2026'
            : text || '(empty)'
        }}</span
      >
      <span class="src-row-inline-meta">
        ${() => depthLabel(state.sourceDraft[idx]?.depth ?? 'light')} ·
        ${() => categoryLabels[state.sourceDraft[idx]?.category ?? 'identity']}
        ·
        ${() =>
          (state.sourceDraft[idx]?.audience ?? [])
            .map((a) => audienceLabel(a))
            .join(', ')}
      </span>
    </div>

    ${() =>
      state.sourceExpandedIdx === idx
        ? html`
            <div class="src-row-detail">
              <div class="src-row-id-line">
                <span class="src-id"
                  >${() => state.sourceDraft[idx]?.id ?? ''}</span
                >
                <div class="src-row-btns">
                  ${() =>
                    state.sourceDraft[idx]?.archivedAt
                      ? html`<button
                          type="button"
                          class="small-btn"
                          @click="${() => unarchiveSourceQuestion(idx)}"
                        >
                          Unarchive
                        </button>`
                      : html`<button
                          type="button"
                          class="small-btn small-btn--warn"
                          @click="${() => archiveSourceQuestion(idx)}"
                        >
                          Archive
                        </button>`}
                  ${() =>
                    state.sourceDraft[idx]?.id?.startsWith('draft-')
                      ? html`<button
                          type="button"
                          class="small-btn small-btn--danger"
                          @click="${() => removeDraftQuestion(idx)}"
                        >
                          Remove
                        </button>`
                      : null}
                </div>
              </div>
              <textarea
                class="src-text"
                rows="2"
                @input="${(e: Event) =>
                  updateDraftField(
                    idx,
                    'text',
                    (e.currentTarget as HTMLTextAreaElement).value,
                  )}"
                placeholder="Question text..."
              >
${() => state.sourceDraft[idx]?.text ?? ''}</textarea
              >
              <div class="src-row-meta">
                <select
                  class="fb-select"
                  @change="${(e: Event) =>
                    updateDraftField(
                      idx,
                      'depth',
                      (e.currentTarget as HTMLSelectElement).value,
                    )}"
                >
                  ${depthOptions.map(
                    (o) =>
                      html`<option
                        value="${o.value}"
                        .selected="${() =>
                          (state.sourceDraft[idx]?.depth ?? 'light') ===
                          o.value}"
                      >
                        ${o.label}
                      </option>`,
                  )}
                </select>
                <select
                  class="fb-select"
                  @change="${(e: Event) =>
                    updateDraftField(
                      idx,
                      'mode',
                      (e.currentTarget as HTMLSelectElement).value,
                    )}"
                >
                  <option
                    value="prompt"
                    .selected="${() =>
                      (state.sourceDraft[idx]?.mode ?? 'prompt') === 'prompt'}"
                  >
                    Prompt
                  </option>
                  <option
                    value="wildcard"
                    .selected="${() =>
                      state.sourceDraft[idx]?.mode === 'wildcard'}"
                  >
                    Wildcard
                  </option>
                </select>
                <select
                  class="fb-select"
                  @change="${(e: Event) =>
                    updateDraftField(
                      idx,
                      'category',
                      (e.currentTarget as HTMLSelectElement).value,
                    )}"
                >
                  ${(Object.keys(categoryLabels) as Category[]).map(
                    (cat) =>
                      html`<option
                        value="${cat}"
                        .selected="${() =>
                          (state.sourceDraft[idx]?.category ?? 'identity') ===
                          cat}"
                      >
                        ${categoryLabels[cat]}
                      </option>`,
                  )}
                </select>
              </div>
              <div class="src-row-audience">
                ${audienceOptions.map(
                  (o) => html`
                    <button
                      type="button"
                      class="${() =>
                        'filter-chip' +
                        (state.sourceDraft[idx]?.audience.includes(o.value)
                          ? ' is-on'
                          : '')}"
                      @click="${() => toggleDraftAudience(idx, o.value)}"
                    >
                      ${o.label}
                    </button>
                  `,
                )}
              </div>
            </div>
          `
        : null}
  </div>
`

// --- Main render ---

html`
  <div class="curator">
    <div class="tab-bar">
      ${(['curate', 'feedback', 'insights', 'source'] as Tab[]).map(
        (tab) => html`
          <button
            type="button"
            class="${() => 'tab-btn' + (state.tab === tab ? ' is-on' : '')}"
            @click="${() => setTab(tab)}"
          >
            ${tab === 'curate'
              ? 'Curate'
              : tab === 'feedback'
                ? 'Feedback'
                : tab === 'insights'
                  ? 'Insights'
                  : 'Source'}
          </button>
        `,
      )}
      <span class="spacer"></span>
      <button
        type="button"
        class="${() =>
          'small-btn' + (!adminState.token ? ' small-btn--warn' : '')}"
        @click="${promptForToken}"
      >
        ${() => (adminState.token ? '\u2709 Token set' : '\u26A0 Set token')}
      </button>
    </div>

    <div class="tab-content">
      ${() =>
        state.tab === 'curate'
          ? CurateTab()
          : state.tab === 'feedback'
            ? FeedbackTab()
            : state.tab === 'insights'
              ? InsightsTab()
              : SourceTab()}
    </div>
  </div>
`(root)

requestAnimationFrame(syncNote)

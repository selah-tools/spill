import { canonicalId } from '../app/card-slug'
import {
  getBundledQuestionSource,
  normalizeQuestionSource,
  type QuestionSourceItem,
} from '../app/questions'
import { verifyAdminRequest } from '../lib/admin-auth'
import {
  kvCommand,
  kvGetJson,
  kvScanKeys,
  normalizeHashResult,
} from '../lib/kv'
import {
  errorMessage,
  jsonResponse,
  logError,
  logInfo,
  metric,
  requestIdFromHeaders,
} from '../lib/observability'

const SOURCE_KV_KEY = 'questions:source'

type SourceDocument = {
  updatedAt: string | null
  questions: QuestionSourceItem[]
}

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

type ExplorerResponse = {
  rows: FeedbackRow[]
  insights: Insights
  totalFeedbackCids: number
  totalSourceQuestions: number
}

const emptyCounters = (): FeedbackCounters => ({
  upvotes: 0,
  downvotes: 0,
  views: 0,
  copies: 0,
  shares: 0,
  wildcardDraws: 0,
  questionRequests: 0,
})

const parseCounterValue = (raw: string | undefined, fallback = 0): number => {
  if (raw == null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

const toFeedbackRow = (
  cid: string,
  question: QuestionSourceItem | null,
  counters: FeedbackCounters,
  downvoteReasons: string[],
): FeedbackRow => {
  const netScore = counters.upvotes - counters.downvotes
  const totalEngagement =
    counters.upvotes +
    counters.downvotes +
    counters.views +
    counters.copies +
    counters.shares
  const upvoteRate =
    counters.upvotes + counters.downvotes > 0
      ? counters.upvotes / (counters.upvotes + counters.downvotes)
      : 0

  return {
    cid,
    question,
    counters,
    downvoteReasons,
    netScore,
    totalEngagement,
    upvoteRate,
  }
}

const loadSource = async (requestId: string): Promise<QuestionSourceItem[]> => {
  try {
    const doc = await kvGetJson<SourceDocument | null>(requestId, SOURCE_KV_KEY)
    if (doc && Array.isArray(doc.questions)) {
      return normalizeQuestionSource(doc.questions)
    }
  } catch (error) {
    logError('feedback_explorer.source_kv_failed', {
      requestId,
      error: errorMessage(error),
    })
  }

  return getBundledQuestionSource()
}

const loadFeedbackKeys = async (requestId: string): Promise<string[]> => {
  try {
    return await kvScanKeys(requestId, 'question:*')
  } catch (error) {
    logError('feedback_explorer.scan_failed', {
      requestId,
      error: errorMessage(error),
    })
    return []
  }
}

const counterKey = (cid: string) => `question:${cid}`
const downvoteReasonsKey = (cid: string) => `question:${cid}:downvoteReasons`

const HASH_KEYS = [
  'upvotes',
  'downvotes',
  'views',
  'copies',
  'shares',
  'wildcardDraws',
  'questionRequests',
]

const buildInsights = (rows: FeedbackRow[]): Insights => {
  const sorted = [...rows]

  const topLiked = [...sorted]
    .filter((row) => row.counters.upvotes > 0)
    .sort((a, b) => b.counters.upvotes - a.counters.upvotes)
    .slice(0, 10)

  const topDisliked = [...sorted]
    .filter((row) => row.counters.downvotes > 0)
    .sort((a, b) => b.counters.downvotes - a.counters.downvotes)
    .slice(0, 10)

  const mostEngaged = [...sorted]
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10)

  const mostControversial = [...sorted]
    .filter((row) => row.counters.upvotes > 0 && row.counters.downvotes > 0)
    .sort(
      (a, b) =>
        Math.min(b.counters.upvotes, b.counters.downvotes) -
        Math.min(a.counters.upvotes, a.counters.downvotes),
    )
    .slice(0, 10)

  const reasonMap = new Map<string, number>()
  for (const row of rows) {
    for (const reason of row.downvoteReasons) {
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1)
    }
  }
  const commonDownvoteReasons = [...reasonMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([reason, count]) => ({ reason, count }))

  const aggregate = (
    field: 'audience' | 'depth' | 'category' | 'mode',
  ): InsightsBreakdown[] => {
    const map = new Map<string, { up: number; down: number; count: number }>()
    for (const row of rows) {
      if (!row.question) continue
      const values: string[] =
        field === 'audience'
          ? row.question.audience
          : [String(row.question[field])]
      for (const value of values) {
        const existing = map.get(value) ?? { up: 0, down: 0, count: 0 }
        existing.up += row.counters.upvotes
        existing.down += row.counters.downvotes
        existing.count += 1
        map.set(value, existing)
      }
    }
    return [...map.entries()]
      .map(([value, data]) => ({
        field,
        value,
        upvotes: data.up,
        downvotes: data.down,
        net: data.up - data.down,
        count: data.count,
      }))
      .sort((a, b) => b.net - a.net)
  }

  return {
    topLiked,
    topDisliked,
    mostEngaged,
    mostControversial,
    commonDownvoteReasons,
    byAudience: aggregate('audience'),
    byDepth: aggregate('depth'),
    byCategory: aggregate('category'),
    byMode: aggregate('mode'),
  }
}

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = requestIdFromHeaders(req.headers)

  if (req.method !== 'GET') {
    return jsonResponse(
      { error: 'method not allowed' },
      { status: 405 },
      requestId,
    )
  }

  const authError = verifyAdminRequest(req, requestId)
  if (authError) return authError

  const url = new URL(req.url)
  const cidFilter = url.searchParams.get('cid')?.trim() || undefined

  logInfo('feedback_explorer.started', { requestId, cid: cidFilter ?? 'all' })

  const [source, feedbackKeys] = await Promise.all([
    loadSource(requestId),
    cidFilter
      ? Promise.resolve([counterKey(cidFilter)])
      : loadFeedbackKeys(requestId),
  ])

  const sourceByCid = new Map<string, QuestionSourceItem>()
  for (const question of source) {
    sourceByCid.set(canonicalId(question), question)
  }

  const counterKeys = feedbackKeys.filter(
    (key) => key.startsWith('question:') && !key.endsWith(':downvoteReasons'),
  )

  const rows: FeedbackRow[] = []

  if (counterKeys.length > 0) {
    const results = await Promise.allSettled(
      counterKeys.map(async (key) => {
        const cid = key.replace('question:', '')
        const hashResult = normalizeHashResult(
          await kvCommand<ReturnType<typeof normalizeHashResult>>(
            requestId,
            'HGETALL',
            key,
          ),
        )

        const counters: FeedbackCounters = emptyCounters()
        for (const field of HASH_KEYS) {
          counters[field as keyof FeedbackCounters] = parseCounterValue(
            hashResult[field],
          )
        }

        let downvoteReasons: string[] = []
        try {
          downvoteReasons =
            ((await kvCommand<string[] | null>(
              requestId,
              'LRANGE',
              downvoteReasonsKey(cid),
              0,
              -1,
            )) as string[] | null) ?? []
        } catch {
          // downvote reasons are optional
        }

        const question = sourceByCid.get(cid) ?? null
        return toFeedbackRow(cid, question, counters, downvoteReasons)
      }),
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        rows.push(result.value)
      }
    }
  }

  if (cidFilter) {
    const existing = rows.find((row) => row.cid === cidFilter)
    if (!existing) {
      const question = sourceByCid.get(cidFilter) ?? null
      rows.push(toFeedbackRow(cidFilter, question, emptyCounters(), []))
    }
  } else {
    for (const [cid, question] of sourceByCid.entries()) {
      if (!rows.some((row) => row.cid === cid)) {
        rows.push(toFeedbackRow(cid, question, emptyCounters(), []))
      }
    }
  }

  const insights = buildInsights(rows)

  metric('feedback_explorer.read', 1, {
    scope: cidFilter ? 'single' : 'all',
  })

  const response: ExplorerResponse = {
    rows,
    insights,
    totalFeedbackCids: counterKeys.length,
    totalSourceQuestions: source.length,
  }

  return jsonResponse(response, { status: 200 }, requestId)
}

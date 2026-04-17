import {
  getBundledQuestionSource,
  normalizeQuestionSource,
  type QuestionSourceItem,
} from '../app/questions'
import { verifyAdminRequest } from '../lib/admin-auth'
import { kvGetJson, kvSetJson } from '../lib/kv'
import {
  errorMessage,
  jsonResponse,
  logError,
  logInfo,
  metric,
  requestIdFromHeaders,
} from '../lib/observability'

const KV_KEY = 'questions:source'

type SourceDocument = {
  updatedAt: string | null
  questions: QuestionSourceItem[]
}

const toSourceDocument = (questions: QuestionSourceItem[]): SourceDocument => ({
  updatedAt: new Date().toISOString(),
  questions,
})

type VercelDeploymentListResponse = {
  deployments?: Array<{
    uid?: string
    id?: string
    name?: string
  }>
}

const triggerRedeploy = async (requestId: string): Promise<boolean> => {
  const token = process.env.VERCEL_TOKEN?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  const orgId = process.env.VERCEL_ORG_ID?.trim()

  if (!token || !projectId) {
    logInfo('questions_source.redeploy_skipped', {
      requestId,
      reason: 'missing VERCEL_TOKEN or VERCEL_PROJECT_ID',
    })
    return false
  }

  const teamQuery = orgId ? `&teamId=${encodeURIComponent(orgId)}` : ''

  try {
    const latestRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&state=READY&limit=1${teamQuery}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (!latestRes.ok) {
      const body = await latestRes.text()
      logError('questions_source.redeploy_lookup_failed', {
        requestId,
        status: latestRes.status,
        body,
      })
      return false
    }

    const latest =
      ((await latestRes.json()) as VercelDeploymentListResponse)
        .deployments?.[0] ?? null
    const deploymentId = latest?.uid ?? latest?.id ?? null

    if (!deploymentId) {
      logInfo('questions_source.redeploy_skipped', {
        requestId,
        reason: 'no ready production deployment found',
      })
      return false
    }

    const res = await fetch(
      `https://api.vercel.com/v13/deployments?forceNew=1${teamQuery}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deploymentId,
          meta: { action: 'redeploy' },
          name: latest?.name ?? 'spill',
          target: 'production',
        }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      logError('questions_source.redeploy_failed', {
        requestId,
        status: res.status,
        body,
      })
      return false
    }

    logInfo('questions_source.redeploy_triggered', { requestId, deploymentId })
    return true
  } catch (error) {
    logError('questions_source.redeploy_error', {
      requestId,
      error: errorMessage(error),
    })
    return false
  }
}

export const config = {
  runtime: 'edge',
}

const handleGet = async (
  req: Request,
  requestId: string,
): Promise<Response> => {
  const url = new URL(req.url)
  const includeArchived = url.searchParams.get('all') === '1'

  if (includeArchived) {
    const authError = verifyAdminRequest(req, requestId)
    if (authError) return authError
  }

  let source: QuestionSourceItem[] | null = null

  try {
    const doc = await kvGetJson<SourceDocument | null>(requestId, KV_KEY)
    if (doc && Array.isArray(doc.questions)) {
      source = normalizeQuestionSource(doc.questions)
      logInfo('questions_source.kv_hit', { requestId, count: source.length })
    }
  } catch (error) {
    logError('questions_source.kv_read_failed', {
      requestId,
      error: errorMessage(error),
    })
  }

  if (!source) {
    source = getBundledQuestionSource()
    logInfo('questions_source.fallback_bundled', {
      requestId,
      count: source.length,
    })
  }

  const filtered = includeArchived
    ? source
    : source.filter((question) => question.active && !question.archivedAt)

  metric('questions_source.read', 1, {
    scope: includeArchived ? 'all' : 'active',
  })

  return jsonResponse(
    {
      count: filtered.length,
      total: source.length,
      questions: filtered,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
    requestId,
  )
}

const handlePut = async (
  req: Request,
  requestId: string,
): Promise<Response> => {
  const authError = verifyAdminRequest(req, requestId)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 }, requestId)
  }

  const parsed = body as { questions?: unknown }
  if (!Array.isArray(parsed.questions)) {
    return jsonResponse(
      { error: 'questions field must be an array' },
      { status: 400 },
      requestId,
    )
  }

  let normalized: QuestionSourceItem[]
  try {
    normalized = normalizeQuestionSource(parsed.questions)
  } catch (error) {
    return jsonResponse(
      { error: errorMessage(error) },
      { status: 400 },
      requestId,
    )
  }

  const doc = toSourceDocument(normalized)

  try {
    await kvSetJson(requestId, KV_KEY, doc)
  } catch (error) {
    logError('questions_source.kv_write_failed', {
      requestId,
      error: errorMessage(error),
    })
    metric('questions_source.write_failed', 1)
    return jsonResponse(
      { error: 'failed to persist question source' },
      { status: 500 },
      requestId,
    )
  }

  logInfo('questions_source.published', {
    requestId,
    count: normalized.length,
    active: normalized.filter((question) => question.active).length,
    archived: normalized.filter((question) => question.archivedAt).length,
  })
  metric('questions_source.published', 1)

  // Trigger Vercel redeploy so sync-questions.mjs picks up the KV changes
  const deployTriggered = await triggerRedeploy(requestId)

  return jsonResponse(
    {
      ok: true,
      count: normalized.length,
      active: normalized.filter((question) => question.active).length,
      deployTriggered,
    },
    { status: 200 },
    requestId,
  )
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = requestIdFromHeaders(req.headers)

  if (req.method === 'GET') {
    return handleGet(req, requestId)
  }

  // Write methods: reject cross-origin requests
  const origin = req.headers.get('origin')
  if (origin) {
    const reqUrl = new URL(req.url)
    const originUrl = new URL(origin)
    if (originUrl.host !== reqUrl.host) {
      return jsonResponse(
        { error: 'cross-origin requests not allowed' },
        { status: 403 },
        requestId,
      )
    }
  }

  if (req.method === 'PUT') {
    return handlePut(req, requestId)
  }

  return jsonResponse(
    { error: 'method not allowed' },
    { status: 405 },
    requestId,
  )
}

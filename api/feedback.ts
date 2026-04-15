import { canonicalId } from '../app/card-slug'
import type {
  FeedbackCounterDeltas,
  FeedbackPayload,
  PromptCounterField,
  PromptEventType,
} from '../app/feedback-types'
import { promptLibrary } from '../app/prompts'
import {
  errorMessage,
  jsonResponse,
  logError,
  logInfo,
  metric,
  requestIdFromHeaders,
} from '../lib/observability'

const validIds = new Set(
  promptLibrary
    .filter((prompt) => prompt.active)
    .map((prompt) => canonicalId(prompt)),
)

type KVEnv = {
  KV_REST_API_URL: string
  KV_REST_API_TOKEN: string
}

function getKVEnv(): KVEnv {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set')
  }
  return { KV_REST_API_URL: url, KV_REST_API_TOKEN: token }
}

async function kvCommand<T = unknown>(
  requestId: string,
  ...args: (string | number)[]
): Promise<T> {
  const { KV_REST_API_URL, KV_REST_API_TOKEN } = getKVEnv()
  const response = await fetch(KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    throw new Error(
      `KV REST error: ${response.status} ${await response.text()}`,
    )
  }

  const json = (await response.json()) as { result: T }
  return json.result
}

const counterKey = (cid: string) => `prompt:${cid}`
const downvoteReasonsKey = (cid: string) => `prompt:${cid}:downvoteReasons`
const MAX_DOWNVOTE_REASONS = 50
const COUNTER_FIELDS: PromptCounterField[] = ['upvotes', 'downvotes']

const counterField = (
  eventType: PromptEventType,
): PromptCounterField | null => {
  switch (eventType) {
    case 'prompt_upvoted':
      return 'upvotes'
    case 'prompt_downvoted':
      return 'downvotes'
    default:
      return null
  }
}

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = requestIdFromHeaders(req.headers)

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'method not allowed' },
      { status: 405 },
      requestId,
    )
  }

  let payload: FeedbackPayload
  try {
    payload = (await req.json()) as FeedbackPayload
  } catch {
    return jsonResponse({ error: 'invalid json' }, { status: 400 }, requestId)
  }

  const { cid, eventType } = payload

  if (!cid || !eventType) {
    return jsonResponse(
      { error: 'missing cid or eventType' },
      { status: 400 },
      requestId,
    )
  }

  if (!validIds.has(cid)) {
    return jsonResponse({ error: 'unknown prompt' }, { status: 400 }, requestId)
  }

  const field = counterField(eventType)
  if (!field) {
    return jsonResponse({ ok: true, skipped: true }, { status: 200 }, requestId)
  }

  const deltas: Array<[PromptCounterField, number]> = Object.entries(
    (payload.counterDeltas ?? {}) as FeedbackCounterDeltas,
  )
    .filter(([name, value]) => {
      return (
        COUNTER_FIELDS.includes(name as PromptCounterField) &&
        Number.isFinite(value) &&
        value !== 0
      )
    })
    .map(
      ([name, value]) =>
        [name as PromptCounterField, value as number] as [
          PromptCounterField,
          number,
        ],
    )

  const counterOps: Array<[PromptCounterField, number]> = deltas.length
    ? deltas
    : [[field, 1]]

  logInfo('feedback.write.started', {
    requestId,
    cid,
    eventType,
    counterOpCount: counterOps.length,
    storesReason: Boolean(payload.reason?.trim()),
  })
  metric('feedback.write.attempt', 1, { eventType })

  try {
    const writes: Array<Promise<unknown>> = counterOps.map(
      ([counterFieldName, delta]) =>
        kvCommand(
          requestId,
          'HINCRBY',
          counterKey(cid),
          counterFieldName,
          delta,
        ),
    )

    const reason = payload.reason?.trim()
    if (eventType === 'prompt_downvoted' && reason) {
      writes.push(
        kvCommand<number>(
          requestId,
          'LPUSH',
          downvoteReasonsKey(cid),
          reason,
        ).then(() =>
          kvCommand(
            requestId,
            'LTRIM',
            downvoteReasonsKey(cid),
            0,
            MAX_DOWNVOTE_REASONS - 1,
          ),
        ),
      )
    }

    await Promise.all(writes)
  } catch (error) {
    const message = errorMessage(error, 'kv_write_failed')
    logError('feedback.write.failed', {
      requestId,
      cid,
      eventType,
      error: message,
    })
    metric('feedback.write.failed', 1, { eventType })
    return jsonResponse({ error: message }, { status: 500 }, requestId)
  }

  logInfo('feedback.write.succeeded', {
    requestId,
    cid,
    eventType,
    counterOpCount: counterOps.length,
  })
  metric('feedback.write.success', 1, { eventType })
  return jsonResponse({ ok: true }, { status: 200 }, requestId)
}

import { canonicalId } from '../app/card-slug'
import type {
  FeedbackCounterDeltas,
  FeedbackPayload,
  QuestionCounterField,
  QuestionEventType,
} from '../app/feedback-types'
import { questionLibrary } from '../app/questions'
import { kvCommand } from '../lib/kv'
import {
  errorMessage,
  jsonResponse,
  logError,
  logInfo,
  metric,
  requestIdFromHeaders,
} from '../lib/observability'

const validIds = new Set(
  questionLibrary
    .filter((question) => question.active)
    .map((question) => canonicalId(question)),
)

const counterKey = (cid: string) => `question:${cid}`
const downvoteReasonsKey = (cid: string) => `question:${cid}:downvoteReasons`
const MAX_DOWNVOTE_REASONS = 50
const COUNTER_FIELDS: QuestionCounterField[] = ['upvotes', 'downvotes']

const counterField = (
  eventType: QuestionEventType,
): QuestionCounterField | null => {
  switch (eventType) {
    case 'question_upvoted':
      return 'upvotes'
    case 'question_downvoted':
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
    return jsonResponse(
      { error: 'unknown question' },
      { status: 400 },
      requestId,
    )
  }

  const field = counterField(eventType)
  if (!field) {
    return jsonResponse({ ok: true, skipped: true }, { status: 200 }, requestId)
  }

  if (
    !payload.counterDeltas ||
    Object.keys(payload.counterDeltas).length === 0
  ) {
    return jsonResponse(
      { error: 'counterDeltas required for rating events' },
      { status: 400 },
      requestId,
    )
  }

  const counterOps: Array<[QuestionCounterField, number]> = Object.entries(
    payload.counterDeltas as FeedbackCounterDeltas,
  )
    .filter(([name, value]) => {
      return (
        COUNTER_FIELDS.includes(name as QuestionCounterField) &&
        Number.isFinite(value) &&
        value !== 0
      )
    })
    .map(
      ([name, value]) =>
        [name as QuestionCounterField, value as number] as [
          QuestionCounterField,
          number,
        ],
    )

  if (counterOps.length === 0) {
    return jsonResponse(
      { error: 'counterDeltas required for rating events' },
      { status: 400 },
      requestId,
    )
  }

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
    if (eventType === 'question_downvoted' && reason) {
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

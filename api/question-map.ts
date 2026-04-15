import { canonicalId, cardSlugForQuestion } from '../app/card-slug'
import { questionLibrary, type Question } from '../app/questions'
import {
  jsonResponse,
  metric,
  requestIdFromHeaders,
} from '../lib/observability'

type DeployedQuestionMapEntry = {
  cid: string
  id: string
  slug: string | null
  text: string
  audience: Question['audience']
  depth: Question['depth']
  mode: Question['mode']
  category: Question['category']
  tags: Question['tags']
  active: boolean
}

const buildDeployedMap = (): {
  entries: DeployedQuestionMapEntry[]
  byCid: Record<string, DeployedQuestionMapEntry>
} => {
  const entries: DeployedQuestionMapEntry[] = []
  const byCid: Record<string, DeployedQuestionMapEntry> = {}

  for (const question of questionLibrary) {
    if (!question.active) continue
    const cid = canonicalId(question)
    const slug = cardSlugForQuestion(question) ?? null
    const entry: DeployedQuestionMapEntry = {
      cid,
      id: question.id,
      slug,
      text: question.text,
      audience: [...question.audience],
      depth: question.depth,
      mode: question.mode,
      category: question.category,
      tags: [...question.tags],
      active: question.active,
    }
    entries.push(entry)
    byCid[cid] = entry
  }

  return { entries, byCid }
}

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = requestIdFromHeaders(req.headers)
  const url = new URL(req.url)
  const cid = url.searchParams.get('cid')?.trim()

  const { entries, byCid } = buildDeployedMap()

  const body = cid
    ? {
        question: byCid[cid] ?? null,
      }
    : {
        count: entries.length,
        questions: entries,
      }

  metric('question_map.read', 1, { scope: cid ? 'single' : 'all' })

  return jsonResponse(
    body,
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    },
    requestId,
  )
}

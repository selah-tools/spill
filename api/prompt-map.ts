import { deployedPromptMap, deployedPromptMapByCid } from '../app/prompt-map'
import {
  jsonResponse,
  metric,
  requestIdFromHeaders,
} from '../lib/observability'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = requestIdFromHeaders(req.headers)
  const url = new URL(req.url)
  const cid = url.searchParams.get('cid')?.trim()

  const body = cid
    ? {
        prompt: deployedPromptMapByCid[cid] ?? null,
      }
    : {
        count: deployedPromptMap.length,
        prompts: deployedPromptMap,
      }

  metric('prompt_map.read', 1, { scope: cid ? 'single' : 'all' })

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

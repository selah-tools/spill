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

export async function kvCommand<T = unknown>(
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

export async function kvGetJson<T>(
  requestId: string,
  key: string,
): Promise<T | null> {
  const result = await kvCommand<null | string | T>(requestId, 'GET', key)

  if (result == null) {
    return null
  }

  if (typeof result === 'string') {
    return JSON.parse(result) as T
  }

  return result as T
}

export async function kvSetJson(
  requestId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await kvCommand(requestId, 'SET', key, JSON.stringify(value))
}

type ScanResult =
  | [string | number, string[]]
  | { cursor?: string | number; keys?: string[] }

const parseScanResult = (
  result: ScanResult,
): { cursor: string; keys: string[] } => {
  if (Array.isArray(result)) {
    return {
      cursor: String(result[0] ?? '0'),
      keys: Array.isArray(result[1]) ? result[1] : [],
    }
  }

  return {
    cursor: String(result.cursor ?? '0'),
    keys: Array.isArray(result.keys) ? result.keys : [],
  }
}

export async function kvScanKeys(
  requestId: string,
  match: string,
  count = 500,
): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'

  do {
    const result = await kvCommand<ScanResult>(
      requestId,
      'SCAN',
      cursor,
      'MATCH',
      match,
      'COUNT',
      count,
    )
    const parsed = parseScanResult(result)
    cursor = parsed.cursor
    keys.push(...parsed.keys)
  } while (cursor !== '0')

  return keys
}

type HashResult =
  | null
  | Record<string, string>
  | string[]
  | Array<string | number>

export const normalizeHashResult = (
  result: HashResult,
): Record<string, string> => {
  if (!result) {
    return {}
  }

  if (!Array.isArray(result)) {
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [key, String(value)]),
    )
  }

  const normalized: Record<string, string> = {}
  for (let index = 0; index < result.length; index += 2) {
    const key = result[index]
    const value = result[index + 1]
    if (typeof key === 'string' && value != null) {
      normalized[key] = String(value)
    }
  }
  return normalized
}

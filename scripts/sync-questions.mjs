#!/usr/bin/env node

/**
 * Sync questions from Upstash KV to the bundled JSON file.
 *
 * Run standalone or as part of the build pipeline:
 *   node scripts/sync-questions.mjs
 *   pnpm build  (if wired into the build script)
 *
 * Requires KV_REST_API_URL and KV_REST_API_TOKEN env vars.
 * Exits 0 with no changes if the bundled file already matches KV.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const KV_KEY = 'questions:source'
const TARGET = resolve('app', 'questions.json')

const KV_REST_API_URL = process.env.KV_REST_API_URL
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN

const AUDIENCE_ORDER = [
  'fellowship',
  'household',
  'dating',
  'engaged',
  'marriage',
  'youth',
]
const LEGACY_AUDIENCES = new Set(['friends', 'small-group', 'family'])

async function kvGet(key) {
  const res = await fetch(KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['GET', key]),
  })

  if (!res.ok) {
    throw new Error(`KV REST error: ${res.status} ${await res.text()}`)
  }

  const { result } = await res.json()
  if (result == null) return null
  if (typeof result === 'string') return JSON.parse(result)
  return result
}

function normalizeAudience(audience) {
  const selected = Array.isArray(audience)
    ? [...new Set(audience.filter((value) => AUDIENCE_ORDER.includes(value)))]
    : []

  return AUDIENCE_ORDER.filter((value) => selected.includes(value))
}

function hasLegacyAudience(doc) {
  if (!doc || !Array.isArray(doc.questions)) return false

  return doc.questions.some(
    (question) =>
      Array.isArray(question.audience) &&
      question.audience.some((value) => LEGACY_AUDIENCES.has(value)),
  )
}

function normalizeForCompare(doc) {
  if (!doc || !Array.isArray(doc.questions)) return null

  return doc.questions
    .map(({ id, text, audience, depth, mode, category, tags, active }) =>
      JSON.stringify({
        id,
        text,
        audience: normalizeAudience(audience),
        depth,
        mode,
        category,
        tags: Array.isArray(tags) ? [...tags].sort() : [],
        active,
      }),
    )
    .sort()
    .join('\n')
}

function readBundled() {
  if (!existsSync(TARGET)) return null
  return JSON.parse(readFileSync(TARGET, 'utf8'))
}

function normalizeBundledForCompare(items) {
  if (!Array.isArray(items)) return null

  return items
    .map(({ id, text, audience, depth, mode, category, tags }) =>
      JSON.stringify({
        id,
        text,
        audience: normalizeAudience(audience),
        depth,
        mode,
        category,
        tags: Array.isArray(tags) ? [...tags].sort() : [],
        active: true,
      }),
    )
    .sort()
    .join('\n')
}

function writeBundled(questions) {
  // Strip KV-specific fields, keep only what the bundled format needs
  const clean = questions.map(
    ({ id, text, audience, depth, mode, category, tags }) => ({
      id,
      text,
      audience: normalizeAudience(audience),
      depth,
      mode,
      category,
      tags: [...tags].sort(),
    }),
  )

  // Deterministic output: sort by id, consistent key order
  clean.sort((a, b) => a.id.localeCompare(b.id))

  const json = JSON.stringify(clean, null, 2) + '\n'
  writeFileSync(TARGET, json, 'utf8')
  return clean.length
}

async function main() {
  // Graceful skip when env vars are missing (e.g., PR builds from forks)
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.log(
      '⚠ KV_REST_API_URL / KV_REST_API_TOKEN not set — skipping sync, using bundled questions',
    )
    return
  }

  console.log(`⬇ Fetching "${KV_KEY}" from KV...`)
  const doc = await kvGet(KV_KEY)

  if (!doc || !Array.isArray(doc.questions)) {
    console.log('ℹ No questions found in KV — keeping bundled file as-is')
    return
  }

  if (hasLegacyAudience(doc)) {
    console.log(
      '⚠ KV still contains retired audience names (friends / small-group / family) — keeping bundled questions.json as-is',
    )
    return
  }

  const kvNorm = normalizeForCompare(doc)
  const bundled = readBundled()
  const bundledNorm = normalizeBundledForCompare(bundled)

  if (kvNorm === bundledNorm) {
    console.log(
      `✓ Bundled questions already match KV (${doc.questions.length} questions)`,
    )
    return
  }

  const count = writeBundled(doc.questions)
  console.log(`✓ Wrote ${count} questions to ${TARGET}`)
}

main().catch((err) => {
  console.error('✗ sync-questions failed:', err.message)
  process.exit(1)
})

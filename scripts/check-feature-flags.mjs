import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const catalog = JSON.parse(readFileSync('app/feature-flags.json', 'utf8'))

const roots = ['app', 'api', 'lib', 'scripts', 'tests']
const allowedExtensions = new Set(['.ts', '.js', '.mjs'])
const excludedFiles = new Set([
  'app/feature-flags.ts',
  'app/feature-flags.json',
  'scripts/check-feature-flags.mjs',
])
const failures = []
const warnings = []
const STALE_WARNING_DAYS = 30
const DAY_MS = 86_400_000

const readSearchFiles = (directory, bucket) => {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      readSearchFiles(fullPath, bucket)
      continue
    }

    if (!allowedExtensions.has(extname(fullPath))) {
      continue
    }

    if (excludedFiles.has(fullPath)) {
      continue
    }

    bucket.push({
      path: fullPath,
      content: readFileSync(fullPath, 'utf8'),
    })
  }
}

const countUsages = (flagName, files) =>
  files.reduce((count, { content }) => {
    let idx = 0
    let hits = 0
    while ((idx = content.indexOf(flagName, idx)) !== -1) {
      hits++
      idx += flagName.length
    }
    return count + hits
  }, 0)

const searchFiles = []
for (const root of roots) {
  readSearchFiles(root, searchFiles)
}

for (const [flagName, definition] of Object.entries(catalog)) {
  if (!definition.description || !definition.owner || !definition.expiresOn) {
    failures.push(
      `${flagName}: feature flags must declare description, owner, and expiresOn metadata`,
    )
    continue
  }

  const expiry = new Date(definition.expiresOn)
  if (Number.isNaN(expiry.getTime())) {
    failures.push(`${flagName}: expiresOn must be a valid ISO date`)
    continue
  }

  const now = Date.now()

  if (expiry.getTime() < now) {
    failures.push(
      `${flagName}: DEAD — feature flag expired on ${definition.expiresOn} and should be removed or renewed`,
    )
    continue
  }

  const daysUntilExpiry = (expiry.getTime() - now) / DAY_MS
  if (daysUntilExpiry <= STALE_WARNING_DAYS) {
    warnings.push(
      `${flagName}: STALE — expires in ${Math.ceil(daysUntilExpiry)} day(s) (${definition.expiresOn}). Consider removing or renewing.`,
    )
  }

  const usageCount = countUsages(flagName, searchFiles)
  if (usageCount === 0) {
    failures.push(
      `${flagName}: DEAD — no usage found outside app/feature-flags.ts or the feature flag registry`,
    )
  } else if (usageCount === 1) {
    warnings.push(
      `${flagName}: LOW USAGE — only ${usageCount} reference outside the flag registry. Verify this flag is still needed.`,
    )
  }

  if (definition.staleSince) {
    const staleDate = new Date(definition.staleSince)
    if (!Number.isNaN(staleDate.getTime()) && staleDate.getTime() < now) {
      const staleDays = Math.floor((now - staleDate.getTime()) / DAY_MS)
      warnings.push(
        `${flagName}: marked stale since ${definition.staleSince} (${staleDays} days). Remove or renew.`,
      )
    }
  }
}

if (warnings.length > 0) {
  console.warn('Feature flag warnings:\n')
  console.warn(warnings.join('\n'))
}

if (failures.length > 0) {
  console.error('\nFeature flag validation failed:\n')
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Feature flags passed validation.')

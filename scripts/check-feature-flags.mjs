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

  if (expiry.getTime() < Date.now()) {
    failures.push(
      `${flagName}: feature flag expired on ${definition.expiresOn} and should be removed or renewed`,
    )
  }

  const usedOutsideRegistry = searchFiles.some(({ content }) =>
    content.includes(flagName),
  )

  if (!usedOutsideRegistry) {
    failures.push(
      `${flagName}: no usage found outside app/feature-flags.ts or the feature flag registry`,
    )
  }
}

if (failures.length > 0) {
  console.error('Feature flag validation failed:\n')
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Feature flags passed validation.')

import { existsSync, readFileSync } from 'node:fs'

const agents = readFileSync('AGENTS.md', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const packageScripts = packageJson.scripts ?? {}
const failures = []

const commandMatches = new Set(
  [...agents.matchAll(/`pnpm\s+([a-z0-9:-]+)`/gi)].map((match) => match[1]),
)

for (const command of commandMatches) {
  if (!(command in packageScripts)) {
    failures.push(
      `Missing package.json script referenced by AGENTS.md: pnpm ${command}`,
    )
  }
}

const fileMatches = new Set(
  [...agents.matchAll(/`([^`]+\.(?:md|json|ya?ml|ts|mjs|example))`/gi)].map(
    (match) => match[1],
  ),
)

for (const filePath of fileMatches) {
  if (!existsSync(filePath)) {
    failures.push(`Missing file referenced by AGENTS.md: ${filePath}`)
  }
}

if (failures.length > 0) {
  console.error('AGENTS.md validation failed:\n')
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('AGENTS.md references are valid.')

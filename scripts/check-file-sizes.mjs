import { statSync } from 'node:fs'

const budgets = [
  // Marriage pack launch expands the bundled library beyond the previous limit.
  { path: 'app/questions.json', maxBytes: 160_000 },
  { path: 'README.md', maxBytes: 25_000 },
]

const failures = budgets
  .map(({ path, maxBytes }) => {
    const size = statSync(path).size
    return size > maxBytes ? { path, size, maxBytes } : null
  })
  .filter(Boolean)

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `${failure.path} is ${failure.size} bytes, which exceeds the budget of ${failure.maxBytes} bytes.`,
    )
  }
  process.exit(1)
}

console.log('File-size budgets passed.')

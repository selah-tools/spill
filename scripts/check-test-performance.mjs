import { existsSync, readFileSync } from 'node:fs'

const THRESHOLD_MS = 500

const junitPath = 'reports/vitest.junit.xml'
const jsonPath = 'reports/vitest.json'

if (!existsSync(junitPath)) {
  console.log('No junit report found at', junitPath)
  console.log('Run `pnpm test:ci` first to generate timing data.')
  process.exit(0)
}

const junit = readFileSync(junitPath, 'utf8')
const testcaseRe = /<testcase\s+([^>]+)>/gs

const parseAttr = (attrs, name) => {
  const m = attrs.match(new RegExp(`${name}="([^"]+)"`))
  return m ? m[1] : null
}

const tests = []
let match
while ((match = testcaseRe.exec(junit))) {
  const attrs = match[1]
  const name = parseAttr(attrs, 'name')
  const classname = parseAttr(attrs, 'classname')
  const time = parseAttr(attrs, 'time')
  if (!name || !time) continue
  const durationMs = parseFloat(time) * 1000
  tests.push({ name, classname: classname ?? '', durationMs })
}

if (tests.length === 0) {
  console.log('No test cases found in junit report.')
  process.exit(0)
}

const slowTests = tests
  .filter((t) => t.durationMs > THRESHOLD_MS)
  .sort((a, b) => b.durationMs - a.durationMs)

const totalMs = tests.reduce((sum, t) => sum + t.durationMs, 0)

console.log(`Test performance summary`)
console.log(`  Total tests:   ${tests.length}`)
console.log(`  Total time:    ${(totalMs / 1000).toFixed(2)}s`)
console.log(`  Average time:  ${(totalMs / tests.length / 1000).toFixed(3)}s`)

if (slowTests.length > 0) {
  console.log(
    `\nSlow tests (>${THRESHOLD_MS}ms, ${slowTests.length} of ${tests.length}):`,
  )
  for (const t of slowTests) {
    console.log(`  ${t.durationMs.toFixed(0).padStart(6)}ms  ${t.name}`)
  }
}

if (existsSync(jsonPath)) {
  try {
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'))
    const results = json.testResults ?? []
    if (results.length > 0) {
      console.log(`\nPer-file timing:`)
      for (const file of results
        .slice()
        .sort(
          (a, b) => (b.perfStats?.runtime ?? 0) - (a.perfStats?.runtime ?? 0),
        )) {
        const runtime = file.perfStats?.runtime ?? 0
        const name = file.name?.replace(process.cwd() + '/', '') ?? 'unknown'
        console.log(`  ${(runtime / 1000).toFixed(2).padStart(7)}s  ${name}`)
      }
    }
  } catch {
    // json report may be in an unexpected format
  }
}

console.log('\nTest performance check passed.')

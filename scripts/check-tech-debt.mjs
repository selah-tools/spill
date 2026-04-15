import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['app', 'api', 'lib', 'scripts']
const allowedExtensions = new Set(['.ts', '.mjs'])
const markerPattern = new RegExp(
  `\\b(${['TO', 'DO'].join('')}|${['FIX', 'ME'].join('')}|${['HA', 'CK'].join('')})\\b`,
)
const filesToSkip = new Set(['scripts/check-tech-debt.mjs'])
const failures = []

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      walk(fullPath)
      continue
    }

    const extension = fullPath.slice(fullPath.lastIndexOf('.'))
    if (!allowedExtensions.has(extension) || filesToSkip.has(fullPath)) {
      continue
    }

    const lines = readFileSync(fullPath, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (markerPattern.test(line)) {
        failures.push(`${fullPath}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

roots.forEach(walk)

if (failures.length > 0) {
  console.error('Tech debt markers found:\n')
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Tech debt scan passed.')

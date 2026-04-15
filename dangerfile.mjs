import { danger, fail, message, warn } from 'danger'

const changedFiles = [...danger.git.created_files, ...danger.git.modified_files]
const sourceChanged = changedFiles.some(
  (file) => file.startsWith('app/') || file.startsWith('api/'),
)
const testsChanged = changedFiles.some((file) => file.endsWith('.test.ts'))
const docsChanged = changedFiles.some(
  (file) =>
    file === 'README.md' || file === 'AGENTS.md' || file.startsWith('docs/'),
)
const changesetAdded = changedFiles.some(
  (file) => file.startsWith('.changeset/') && file !== '.changeset/README.md',
)

message(`Changed files: ${changedFiles.length}`)

if (!danger.github.pr.body?.trim()) {
  warn('Add a PR description with summary and validation notes.')
}

if (sourceChanged && !testsChanged) {
  warn(
    'Source files changed without test updates. Explain why in the PR if this is intentional.',
  )
}

if (sourceChanged && !changesetAdded) {
  warn('User-visible changes should usually include a Changeset.')
}

if (sourceChanged && !docsChanged) {
  message(
    'No docs changed. That is fine for internal refactors, but call out operational impact if behavior changed.',
  )
}

if (
  changedFiles.includes('app/questions.json') &&
  !changedFiles.some((file) => file === 'app/questions.test.ts')
) {
  fail('Prompt library changes must update or validate prompt tests.')
}

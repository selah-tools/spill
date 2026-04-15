import { html, reactive } from '@arrow-js/core'

import {
  getCuration,
  isReviewed,
  issueOptions,
  loadCurations,
  saveCurations,
  scoreLabels,
  signalOptions,
  statusLabels,
  type CurationStatus,
  type IssueTag,
  type PromptCuration,
  type PromptCurations,
  type QuickSignal,
  type ScoreKey,
  type ScoreValue,
} from './curation-store'
import {
  audienceOptions,
  categoryLabels,
  depthOptions,
  isOvertChristianPrompt,
  promptLibrary,
  type Audience,
  type Depth,
  type Prompt,
} from './prompts'

import './curator.css'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Missing #app')

type ViewFilter = 'all' | 'unreviewed'

const state = reactive({
  curations: loadCurations() as PromptCurations,
  index: 0,
  filter: 'all' as ViewFilter,
})

const cur = (id: string): PromptCuration => getCuration(state.curations, id)

const save = (
  id: string,
  updater: (c: PromptCuration) => PromptCuration,
): void => {
  const next = updater(cur(id))
  state.curations[id] = { ...next, updatedAt: new Date().toISOString() }
  saveCurations(state.curations)
}

const filtered = (): Prompt[] =>
  promptLibrary.filter((p) => {
    if (state.filter === 'unreviewed' && isReviewed(cur(p.id))) return false
    return true
  })

const prompt = (): Prompt | null => filtered()[state.index] ?? null

const clampIndex = (): void => {
  const len = filtered().length
  if (state.index >= len) state.index = Math.max(0, len - 1)
}

const go = (delta: number): void => {
  const len = filtered().length
  if (!len) return
  state.index = Math.min(len - 1, Math.max(0, state.index + delta))
  syncNote()
}

const jumpUnreviewed = (): void => {
  const list = filtered()
  const next = list
    .slice(state.index + 1)
    .findIndex((p) => !isReviewed(cur(p.id)))
  if (next >= 0) {
    state.index = state.index + 1 + next
    syncNote()
    return
  }
  const first = list.findIndex((p) => !isReviewed(cur(p.id)))
  if (first >= 0) {
    state.index = first
    syncNote()
  }
}

const setFilter = (f: ViewFilter): void => {
  state.filter = f
  clampIndex()
  syncNote()
}

const setStatus = (status: CurationStatus): void => {
  const p = prompt()
  if (p) save(p.id, (c) => ({ ...c, status }))
}

const toggleFav = (): void => {
  const p = prompt()
  if (!p) return
  const c = cur(p.id)
  const on = c.issues.includes('great-example')
  save(p.id, (c) => ({
    ...c,
    status: !on && c.status === 'unreviewed' ? 'keep' : c.status,
    issues: on
      ? c.issues.filter((i) => i !== 'great-example')
      : [...c.issues, 'great-example'],
  }))
}

const toggleSignal = (signal: QuickSignal): void => {
  const p = prompt()
  if (!p) return
  save(p.id, (c) => ({
    ...c,
    signals: c.signals.includes(signal)
      ? c.signals.filter((s) => s !== signal)
      : [...c.signals, signal],
  }))
}

const toggleIssue = (tag: IssueTag): void => {
  const p = prompt()
  if (!p) return
  save(p.id, (c) => ({
    ...c,
    issues: c.issues.includes(tag)
      ? c.issues.filter((i) => i !== tag)
      : [...c.issues, tag],
  }))
}

const setScore = (key: ScoreKey, val: ScoreValue): void => {
  const p = prompt()
  if (!p) return
  save(p.id, (c) => ({
    ...c,
    scores: { ...c.scores, [key]: c.scores[key] === val ? null : val },
  }))
}

const setNote = (note: string): void => {
  const p = prompt()
  if (p) save(p.id, (c) => ({ ...c, notes: note }))
}

const syncNote = (): void => {
  requestAnimationFrame(() => {
    const el = root.querySelector<HTMLTextAreaElement>('.note-field')
    const p = prompt()
    if (el && p) el.value = cur(p.id).notes
  })
}

const stats = () => {
  const reviewed = promptLibrary.filter((p) => isReviewed(cur(p.id))).length
  return { reviewed, total: promptLibrary.length }
}

const audienceLabel = (a: Audience) =>
  audienceOptions.find((o) => o.value === a)?.label ?? a
const depthLabel = (d: Depth) =>
  depthOptions.find((o) => o.value === d)?.label ?? d
const isFav = (c: PromptCuration) => c.issues.includes('great-example')
const hasSig = (id: string, s: QuickSignal) => cur(id).signals.includes(s)

const curId = (): string => prompt()?.id ?? ''

const downloadFile = (name: string, content: string, mime: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const buildGuidance = (): string => {
  const reviewed = promptLibrary
    .map((p) => ({ p, c: cur(p.id) }))
    .filter(({ c }) => isReviewed(c))
  const best = reviewed
    .filter(
      ({ c }) =>
        isFav(c) ||
        c.status === 'keep' ||
        c.signals.includes('fun') ||
        c.signals.includes('uplifting'),
    )
    .sort((a, b) => {
      const s = (c: PromptCuration) =>
        (isFav(c) ? 8 : 0) +
        (c.signals.includes('fun') ? 3 : 0) +
        (c.signals.includes('uplifting') ? 2 : 0) -
        (c.signals.includes('intense') ? 2 : 0) +
        (c.scores.overall ?? 0)
      return s(b.c) - s(a.c)
    })
    .slice(0, 14)
  const issues = issueOptions
    .map((i) => ({
      ...i,
      n: reviewed.filter(({ c }) => c.issues.includes(i.value)).length,
    }))
    .filter((i) => i.n > 0)
    .sort((a, b) => b.n - a.n)
  const revCut = reviewed
    .filter(({ c }) => c.status === 'revise' || c.status === 'cut')
    .slice(0, 20)
  const funN = reviewed.filter(({ c }) => c.signals.includes('fun')).length
  const upN = reviewed.filter(({ c }) => c.signals.includes('uplifting')).length
  const intN = reviewed.filter(({ c }) => c.signals.includes('intense')).length
  const favN = reviewed.filter(({ c }) => isFav(c)).length

  return `# Spill Question Generation Guidance\nGenerated: ${new Date().toISOString()}\n\n## Summary\n- Reviewed: ${reviewed.length} / ${promptLibrary.length}\n- Fun: ${funN} · Uplifting: ${upN} · Intense: ${intN} · Favorites: ${favN}\n\n## Best Examples\n${
    best
      .map(({ p, c }) => {
        const m = [
          isFav(c) ? 'Fav' : '',
          c.signals.includes('fun') ? 'Fun' : '',
          c.signals.includes('uplifting') ? 'Uplift' : '',
          c.signals.includes('intense') ? 'Intense' : '',
        ]
          .filter(Boolean)
          .join(' · ')
        return `- **${audienceLabel(p.audience[0])} · ${depthLabel(p.depth)}${m ? ` · ${m}` : ''}** — ${p.text}`
      })
      .join('\n') || '(none yet)'
  }\n\n## Problems to Avoid\n${issues.map((i) => `- **${i.label}** (${i.n}) — ${i.hint}`).join('\n') || '(none tagged)'}\n\n## Revision / Bad\n${revCut.map(({ p, c }) => `- **${statusLabels[c.status]} · ${audienceLabel(p.audience[0])} · ${depthLabel(p.depth)}** — ${p.text}${c.notes ? ` [${c.notes}]` : ''}`).join('\n') || '(none)'}\n\n## Heuristics\n- Fun opens the room. Uplifting warms it. Intense deepens it.\n- Too many intense cards in a row hurts the room's tone.\n- Light questions should be genuinely fun, not just "less deep."\n- Avoid sounding like a devotional or therapy exercise.\n- Clarity and speakability over cleverness.\n`
}

const exportGuidance = () =>
  downloadFile('spill-guidance.md', buildGuidance(), 'text/markdown')
const exportJson = () =>
  downloadFile(
    'spill-curations.json',
    JSON.stringify({ curations: state.curations }, null, 2),
    'application/json',
  )

document.addEventListener('keydown', (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    go(1)
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    go(-1)
  }
  if (e.key === 'k') setStatus('keep')
  if (e.key === 'r') setStatus('revise')
  if (e.key === 'x') setStatus('cut')
  if (e.key === 'f') toggleFav()
})

html`
  <div class="curator">
    <div class="top">
      <h1 class="title">Spill Curator</h1>
      <span class="progress-text"
        >${() => stats().reviewed + ' / ' + stats().total + ' reviewed'}</span
      >
    </div>

    <div class="bar">
      <div
        class="bar-fill"
        style="${() =>
          'width:' + ((stats().reviewed / stats().total) * 100 || 0) + '%'}"
      ></div>
    </div>

    <div class="filter-row">
      <button
        type="button"
        class="${() =>
          'filter-chip' + (state.filter === 'all' ? ' is-on' : '')}"
        @click="${() => setFilter('all')}"
      >
        All
      </button>
      <button
        type="button"
        class="${() =>
          'filter-chip' + (state.filter === 'unreviewed' ? ' is-on' : '')}"
        @click="${() => setFilter('unreviewed')}"
      >
        Unreviewed
      </button>
      <span class="spacer"></span>
      <button type="button" class="small-btn" @click="${jumpUnreviewed}">
        Skip to next
      </button>
    </div>

    <div class="nav">
      <button type="button" class="nav-btn" @click="${() => go(-1)}">←</button>
      <span class="nav-counter"
        >${() =>
          filtered().length
            ? state.index + 1 + ' / ' + filtered().length
            : '—'}</span
      >
      <button type="button" class="nav-btn" @click="${() => go(1)}">→</button>
    </div>

    ${() => {
      const p = prompt()
      if (!p)
        return html`<div class="empty">No questions match this filter.</div>`

      return html`
        <article class="card">
          <p class="card-text">${() => prompt()?.text ?? ''}</p>
          <div class="card-meta">
            <span class="pill"
              >${() =>
                prompt()?.mode === 'wildcard' ? 'Wildcard' : 'Question'}</span
            >
            ${() =>
              prompt() && isOvertChristianPrompt(prompt()!)
                ? html`<span class="pill">Overt</span>`
                : null}
            <span class="pill"
              >${() => depthLabel(prompt()?.depth ?? 'light')}</span
            >
            <span class="pill"
              >${() => categoryLabels[prompt()?.category ?? 'identity']}</span
            >
            ${() =>
              (prompt()?.audience ?? []).map(
                (a) => html`<span class="pill">${audienceLabel(a)}</span>`,
              )}
          </div>
          <p class="card-id">${() => curId()}</p>
        </article>

        <div class="actions">
          <p class="act-label">Decision</p>
          <button
            type="button"
            class="${() =>
              'act-btn is-keep' +
              (cur(curId()).status === 'keep' ? ' is-on' : '')}"
            @click="${() => setStatus('keep')}"
          >
            Good
          </button>
          <button
            type="button"
            class="${() =>
              'act-btn is-revise' +
              (cur(curId()).status === 'revise' ? ' is-on' : '')}"
            @click="${() => setStatus('revise')}"
          >
            Revision
          </button>
          <button
            type="button"
            class="${() =>
              'act-btn is-cut' +
              (cur(curId()).status === 'cut' ? ' is-on' : '')}"
            @click="${() => setStatus('cut')}"
          >
            Bad
          </button>
          <button
            type="button"
            class="${() =>
              'act-btn is-fav' + (isFav(cur(curId())) ? ' is-on' : '')}"
            @click="${toggleFav}"
          >
            ${() => (isFav(cur(curId())) ? '★ Favorite' : '☆ Favorite')}
          </button>
        </div>

        <div class="actions">
          <p class="act-label">Tone</p>
          ${signalOptions.map(
            (sig) => html`
              <button
                type="button"
                class="${() =>
                  'act-btn is-' +
                  sig.value +
                  (hasSig(curId(), sig.value) ? ' is-on' : '')}"
                @click="${() => toggleSignal(sig.value)}"
              >
                ${() =>
                  hasSig(curId(), sig.value) ? '✓ ' + sig.label : sig.label}
              </button>
            `,
          )}
        </div>

        <textarea
          class="note-field"
          placeholder="Quick note (optional)..."
          @input="${(e: Event) =>
            setNote((e.currentTarget as HTMLTextAreaElement).value)}"
        ></textarea>

        <details>
          <summary>Issue tags & advanced scoring</summary>
          <div class="detail-inner">
            <div class="detail-section">
              <p class="detail-label">Issue tags</p>
              <div class="issue-grid">
                ${issueOptions.map(
                  (issue) => html`
                    <button
                      type="button"
                      class="${() =>
                        'issue-btn' +
                        (cur(curId()).issues.includes(issue.value)
                          ? ' is-on'
                          : '')}"
                      @click="${() => toggleIssue(issue.value)}"
                      title="${issue.hint}"
                    >
                      ${issue.label}
                    </button>
                  `,
                )}
              </div>
            </div>
            <div class="detail-section">
              <p class="detail-label">Scoring</p>
              ${(Object.keys(scoreLabels) as ScoreKey[]).map(
                (key) => html`
                  <div class="score-row">
                    <span class="score-name">${scoreLabels[key]}</span>
                    <div class="score-dots">
                      ${[1, 2, 3, 4, 5].map(
                        (v) => html`
                          <button
                            type="button"
                            class="${() =>
                              'score-dot' +
                              (cur(curId()).scores[key] === v ? ' is-on' : '')}"
                            @click="${() => setScore(key, v as ScoreValue)}"
                          >
                            ${v}
                          </button>
                        `,
                      )}
                    </div>
                  </div>
                `,
              )}
            </div>
          </div>
        </details>

        <div class="footer-nav">
          <button type="button" class="small-btn" @click="${() => go(-1)}">
            ← Previous
          </button>
          <button type="button" class="small-btn" @click="${() => go(1)}">
            Next →
          </button>
        </div>
      `
    }}

    <div class="export-row">
      <button
        type="button"
        class="small-btn small-btn--fill"
        @click="${exportGuidance}"
      >
        Export guidance
      </button>
      <button type="button" class="small-btn" @click="${exportJson}">
        Export JSON
      </button>
    </div>

    <p class="kbd-help">
      <kbd>←</kbd><kbd>→</kbd> navigate <kbd>k</kbd> good <kbd>r</kbd> revise
      <kbd>x</kbd> bad <kbd>f</kbd> fav
    </p>
  </div>
`(root)

requestAnimationFrame(syncNote)

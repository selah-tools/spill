import { component, html, reactive } from '@arrow-js/core'

import {
  getQuestionRating,
  trackQuestionRating,
  type QuestionRating,
} from '../analytics'
import { feedbackRateDown, feedbackRateUp } from '../ui-feedback'
import { cardPackMetaLabel, depthOptions, questionLibrary } from '../questions'
import { openDownvoteModal, state } from '../state'

const servedAudienceLabel = () =>
  cardPackMetaLabel(
    state.currentQuestion?.audience ?? state.servedContext ?? state.context,
  )

const servedDepthLabel = () => {
  const d = state.currentQuestion?.depth ?? state.servedDepth
  return d
    ? (depthOptions.find((o) => o.value === d)?.label ?? 'Light')
    : 'Light'
}

const cardNumber = () => {
  if (!state.currentQuestion) return ''
  const idx = questionLibrary.findIndex(
    (q) => q.id === state.currentQuestion?.id,
  )
  return idx >= 0 ? String(idx + 1).padStart(2, '0') : ''
}

/** Packs · Depth — card's own metadata, not the active filters. */
const metaContext = () => {
  const modeLabel =
    state.currentQuestion?.mode === 'wildcard' ? 'Wildcard' : null
  const parts = [modeLabel, servedAudienceLabel(), servedDepthLabel()].filter(
    Boolean,
  )
  return parts.join(' · ')
}

const thumbUpOutline = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M7 10v12" />
  <path
    d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
  />
</svg>`

const thumbUpFilled = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="currentColor"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  paint-order="stroke"
>
  <path d="M7 10v12" />
  <path
    d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
  />
</svg>`

const thumbDownOutline = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M17 14V2" />
  <path
    d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.78 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
  />
</svg>`

const thumbDownFilled = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="currentColor"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  paint-order="stroke"
>
  <path d="M17 14V2" />
  <path
    d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.78 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
  />
</svg>`

export const QuestionCard = component(() => {
  const ui = reactive({ rating: null as QuestionRating | null })

  const syncRating = (): void => {
    ui.rating = state.currentQuestion
      ? getQuestionRating(state.currentQuestion.id)
      : null
  }

  const rate = (rating: QuestionRating): void => {
    if (!state.currentQuestion) return

    if (rating === 'down') {
      feedbackRateDown()
      openDownvoteModal()
      return
    }

    const next = trackQuestionRating(
      state.currentQuestion,
      state.currentQuestion.audience,
      state.currentQuestion.depth,
      state.currentQuestion.mode,
      rating,
    )
    state.currentRating = next
    ui.rating = next
    feedbackRateUp()
  }

  return html`
    <div
      class="${() =>
        'stage' + (state.mode === 'wildcard' ? ' stage--wild' : '')}"
    >
      <article
        class="${() =>
          'card' +
          (state.currentQuestion ? ' is-live' : '') +
          (state.mode === 'wildcard' ? ' is-wild' : '')}"
        aria-live="polite"
      >
        ${() => {
          syncRating()
          return state.currentQuestion
            ? html`<div class="card-frame">
                <div class="card-top">
                  <span class="card-label"
                    >${() =>
                      state.mode === 'wildcard' ? 'Wildcard' : 'Question'}</span
                  >
                  <span class="card-num">#${() => cardNumber()}</span>
                </div>
                <p class="card-prompt">
                  ${() => state.currentQuestion?.text ?? ''}
                </p>
                <div class="card-bottom">
                  <span class="card-meta">${() => metaContext()}</span>
                  <div class="card-actions">
                    <button
                      type="button"
                      class="${() =>
                        'card-action' +
                        (ui.rating === 'up' ? ' is-active' : '')}"
                      @click="${() => rate('up')}"
                      aria-label="Rate up"
                    >
                      ${() =>
                        ui.rating === 'up' ? thumbUpFilled : thumbUpOutline}
                    </button>
                    <button
                      type="button"
                      class="${() =>
                        'card-action' +
                        (ui.rating === 'down' ? ' is-active' : '')}"
                      @click="${() => rate('down')}"
                      aria-label="Rate down"
                    >
                      ${() =>
                        ui.rating === 'down'
                          ? thumbDownFilled
                          : thumbDownOutline}
                    </button>
                  </div>
                </div>
              </div>`
            : html`<div class="card-frame card-frame--empty">
                <div class="card-frame__cluster">
                  <div class="card-frame__icon" aria-hidden="true">
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="3" />
                      <path d="M8 4v16" />
                      <path d="M16 4v16" />
                      <path d="M2 12h20" />
                    </svg>
                  </div>
                  <p class="card-prompt card-prompt--quiet">
                    Draw a card. Spill something real.
                  </p>
                  <p class="card-frame__hint">
                    Pick your packs, then tap below.
                  </p>
                </div>
              </div>`
        }}
      </article>
    </div>
  `
})

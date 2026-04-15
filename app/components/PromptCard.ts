import { component, html, reactive } from '@arrow-js/core'

import {
  getPromptRating,
  trackPromptRating,
  type PromptRating,
} from '../analytics'
import { feedbackRateDown, feedbackRateUp } from '../ui-feedback'
import { cardPackMetaLabel, depthOptions, promptLibrary } from '../prompts'
import { openDownvoteModal, state } from '../state'

const servedAudienceLabel = () =>
  cardPackMetaLabel(
    state.currentPrompt?.audience ?? state.servedContext ?? state.context,
  )

const servedDepthLabel = () =>
  depthOptions.find(
    (o) =>
      o.value ===
      (state.currentPrompt?.depth ?? state.servedDepth ?? state.depth),
  )?.label ?? 'Light'

const cardNumber = () => {
  if (!state.currentPrompt) return ''
  const idx = promptLibrary.findIndex((p) => p.id === state.currentPrompt?.id)
  return idx >= 0 ? String(idx + 1).padStart(2, '0') : ''
}

/** Packs · Depth — card's own metadata, not the active filters. */
const metaContext = () => {
  const modeLabel = state.currentPrompt?.mode === 'wildcard' ? 'Wildcard' : null
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

export const PromptCard = component(() => {
  const ui = reactive({ rating: null as PromptRating | null })

  const syncRating = (): void => {
    ui.rating = state.currentPrompt
      ? getPromptRating(state.currentPrompt.id)
      : null
  }

  const rate = (rating: PromptRating): void => {
    if (!state.currentPrompt) return

    if (rating === 'down') {
      feedbackRateDown()
      openDownvoteModal()
      return
    }

    const next = trackPromptRating(
      state.currentPrompt,
      state.currentPrompt.audience,
      state.currentPrompt.depth,
      state.currentPrompt.mode,
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
          (state.currentPrompt ? ' is-live' : '') +
          (state.mode === 'wildcard' ? ' is-wild' : '')}"
        aria-live="polite"
      >
        ${() => {
          syncRating()
          return state.currentPrompt
            ? html`<div class="card-frame">
                <div class="card-top">
                  <span class="card-label"
                    >${() =>
                      state.mode === 'wildcard' ? 'Wildcard' : 'Question'}</span
                  >
                  <span class="card-num">#${() => cardNumber()}</span>
                </div>
                <p class="card-prompt">
                  ${() => state.currentPrompt?.text ?? ''}
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
                  <p class="card-prompt card-prompt--quiet">
                    Draw a card. Spill something real.
                  </p>
                </div>
              </div>`
        }}
      </article>
    </div>
  `
})

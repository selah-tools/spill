import { component, html, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

import {
  audienceOptions,
  depthOptions,
  isPromptEnabled,
  orderedAudienceSelection,
  promptMap,
  type Audience,
  type Prompt,
} from '../prompts'
import {
  setContext,
  setDepth,
  setIncludeOvertChristian,
  setIncludeWildcards,
  state,
} from '../state'
import {
  feedbackBlocked,
  feedbackDetailsToggle,
  feedbackSelection,
  feedbackWarning,
} from '../ui-feedback'

export const filterUi = reactive({
  modalOpen: false,
  historyOpen: false,
  lastPackWarning: false,
})

const closeFiltersModal = (): void => {
  if (!filterUi.modalOpen) return
  filterUi.modalOpen = false
  filterUi.lastPackWarning = false
  feedbackDetailsToggle(false)
}

const openFiltersModal = (): void => {
  if (filterUi.modalOpen) return
  filterUi.historyOpen = false
  filterUi.modalOpen = true
  feedbackDetailsToggle(true)
  requestAnimationFrame(() => {
    document.getElementById('controls-filters-modal')?.focus()
  })
}

export const toggleFiltersModal = (): void => {
  if (filterUi.modalOpen) closeFiltersModal()
  else openFiltersModal()
}

const closeHistory = (): void => {
  filterUi.historyOpen = false
}

const toggleHistory = (): void => {
  if (filterUi.modalOpen) closeFiltersModal()
  const opening = !filterUi.historyOpen
  filterUi.historyOpen = !filterUi.historyOpen
  if (opening) feedbackDetailsToggle(true)
  else feedbackWarning()
}

const activePoolFilters = () => ({
  includeWildcards: state.includeWildcards,
  includeOvertChristian: state.includeOvertChristian,
})

const historyCards = (): Prompt[] => {
  const currentId = state.currentPrompt?.id
  return state.history
    .filter((id) => id !== currentId)
    .slice(0, 8)
    .map((id) => promptMap.get(id))
    .filter(
      (p): p is Prompt => p != null && isPromptEnabled(p, activePoolFilters()),
    )
}

const togglePack = (pack: Audience): void => {
  const isOn = state.context.includes(pack)

  // Prevent unchecking the last remaining pack
  if (isOn && state.context.length === 1) {
    feedbackBlocked()
    filterUi.lastPackWarning = true
    return
  }

  filterUi.lastPackWarning = false
  const next = orderedAudienceSelection(
    isOn
      ? state.context.filter((value) => value !== pack)
      : [...state.context, pack],
  )

  if (
    next.length === state.context.length &&
    next.every((value, idx) => value === state.context[idx])
  ) {
    return
  }

  feedbackSelection()
  setContext(next)
}

const toggleWildcards = (): void => {
  feedbackSelection()
  setIncludeWildcards(!state.includeWildcards)
}

const toggleOvertChristian = (): void => {
  feedbackSelection()
  setIncludeOvertChristian(!state.includeOvertChristian)
}

const hasPacks = (): boolean => state.context.length > 0

export const FilterBar = component(
  (
    props: Props<{
      onDrawPrompt: () => void
      onSelectCard: (id: string) => void
      onDeckReset: () => void
    }>,
  ) => html`
    <div class="controls-stack">
      <div class="controls">
        <div class="controls__primary">
          ${() =>
            state.currentPrompt
              ? html`<div class="controls__nav">
                  <button
                    type="button"
                    class="${() =>
                      'controls__nav-btn' +
                      (filterUi.historyOpen ? ' is-active' : '')}"
                    @click="${toggleHistory}"
                    aria-label="Card history"
                    aria-expanded="${() => filterUi.historyOpen}"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 256 256"
                      fill="none"
                    >
                      <polyline
                        points="128 80 128 128 168 152"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                      <polyline
                        points="72 104 32 104 32 64"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                      <path
                        d="M67.6,192A88,88,0,1,0,65.77,65.77C54,77.69,44.28,88.93,32,104"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="btn btn--fill"
                    @click="${() => {
                      closeHistory()
                      props.onDrawPrompt()
                    }}"
                  >
                    New card
                  </button>
                </div>`
              : html`<div class="controls__empty-actions">
                  <button
                    type="button"
                    class="btn btn--outline"
                    @click="${() => {
                      closeHistory()
                      toggleFiltersModal()
                    }}"
                    aria-label="Configure packs and filters"
                    aria-expanded="${() => filterUi.modalOpen}"
                    aria-haspopup="dialog"
                    aria-controls="controls-filters-modal"
                  >
                    Configure packs
                  </button>
                  <button
                    type="button"
                    class="${() =>
                      'btn btn--fill' + (!hasPacks() ? ' btn--disabled' : '')}"
                    @click="${props.onDrawPrompt}"
                  >
                    Draw a card
                  </button>
                </div>`}
        </div>

        ${() =>
          filterUi.historyOpen
            ? html`
                <div
                  class="history-popover"
                  @keydown="${(e: Event) => {
                    if ((e as KeyboardEvent).key === 'Escape') {
                      e.preventDefault()
                      closeHistory()
                    }
                  }}"
                >
                  <div
                    class="history-popover__panel"
                    role="listbox"
                    aria-label="Recent cards"
                  >
                    ${() => {
                      const cards = historyCards()
                      return cards.length
                        ? cards.map(
                            (p) =>
                              html`<button
                                type="button"
                                class="history-popover__item"
                                role="option"
                                @click="${() => {
                                  closeHistory()
                                  props.onSelectCard(p.id)
                                }}"
                              >
                                ${p.text}
                              </button>`,
                          )
                        : html`<p class="history-popover__empty">
                            No other visible cards yet.
                          </p>`
                    }}
                  </div>
                </div>
              `
            : null}
      </div>

      ${() =>
        filterUi.modalOpen
          ? html`
              <div
                class="controls-modal"
                role="presentation"
                @keydown="${(e: Event) => {
                  if ((e as KeyboardEvent).key !== 'Escape') return
                  e.preventDefault()
                  closeFiltersModal()
                }}"
              >
                <div
                  class="controls-modal__backdrop"
                  @click="${closeFiltersModal}"
                ></div>
                <div
                  id="controls-filters-modal"
                  class="controls-modal__panel"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="controls-filters-modal-title"
                  tabindex="-1"
                >
                  <div class="controls-modal__head">
                    <h2
                      class="controls-modal__title"
                      id="controls-filters-modal-title"
                    >
                      Filters
                    </h2>
                    <button
                      type="button"
                      class="controls-modal__close"
                      aria-label="Close filters"
                      @click="${closeFiltersModal}"
                    >
                      Done
                    </button>
                  </div>
                  <div class="controls__drawer">
                    <div class="controls__field">
                      <p class="controls__label" id="controls-context-label">
                        Packs
                      </p>
                      <div
                        class="controls__packs"
                        role="group"
                        aria-labelledby="controls-context-label"
                      >
                        ${audienceOptions.map(
                          (option) =>
                            html`<button
                              type="button"
                              class="${() =>
                                'chip chip--pack' +
                                (state.context.includes(option.value)
                                  ? ' is-on'
                                  : '') +
                                (filterUi.lastPackWarning &&
                                state.context.length === 1 &&
                                state.context[0] === option.value
                                  ? ' is-blocked'
                                  : '')}"
                              @click="${() => togglePack(option.value)}"
                              aria-pressed="${() =>
                                state.context.includes(option.value)}"
                              title="${option.blurb}"
                            >
                              ${option.label}
                            </button>`,
                        )}
                      </div>
                      <p
                        class="${() =>
                          'controls__hint' +
                          (filterUi.lastPackWarning
                            ? ' controls__hint--warn'
                            : '')}"
                      >
                        ${() =>
                          filterUi.lastPackWarning
                            ? 'Pick another pack first, then disable this one.'
                            : state.context.length
                              ? 'Enable or disable any pack.'
                              : 'Turn on at least one pack to draw a card.'}
                      </p>
                    </div>

                    <div
                      class="controls__field"
                      aria-labelledby="controls-depth-label"
                    >
                      <p class="controls__label" id="controls-depth-label">
                        How deep?
                      </p>
                      <div class="segmented" role="group" aria-label="Depth">
                        ${depthOptions.map(
                          (option) =>
                            html`<button
                              type="button"
                              class="${() =>
                                'chip chip--segment' +
                                (state.depth === option.value ? ' is-on' : '')}"
                              @click="${() => {
                                if (state.depth === option.value) return
                                feedbackSelection()
                                setDepth(option.value)
                              }}"
                              aria-pressed="${() =>
                                state.depth === option.value}"
                            >
                              ${option.label}
                            </button>`,
                        )}
                      </div>
                    </div>

                    <div class="controls__field">
                      <p class="controls__label" id="controls-content-label">
                        Include
                      </p>
                      <div
                        class="controls__packs"
                        role="group"
                        aria-labelledby="controls-content-label"
                      >
                        <button
                          type="button"
                          class="${() =>
                            'chip chip--pack' +
                            (state.includeWildcards ? ' is-on' : '')}"
                          @click="${toggleWildcards}"
                          aria-pressed="${() => state.includeWildcards}"
                        >
                          Wildcards
                        </button>
                        <button
                          type="button"
                          class="${() =>
                            'chip chip--pack' +
                            (state.includeOvertChristian ? ' is-on' : '')}"
                          @click="${toggleOvertChristian}"
                          aria-pressed="${() => state.includeOvertChristian}"
                        >
                          Faith-forward
                        </button>
                      </div>
                    </div>

                    <div class="controls__reset">
                      <button
                        type="button"
                        class="controls__reset-btn"
                        @click="${() => {
                          feedbackWarning()
                          closeFiltersModal()
                          props.onDeckReset()
                        }}"
                      >
                        Reset seen cards
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `
          : null}
    </div>
  `,
)

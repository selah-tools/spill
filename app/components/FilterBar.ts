import { component, html, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

import {
  audienceOptions,
  depthOptions,
  isQuestionEnabled,
  orderedAudienceSelection,
  orderedDepthSelection,
  questionMap,
  type Audience,
  type Depth,
  type Question,
} from '../questions'
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
  lastDepthWarning: false,
})

const closeFiltersModal = (): void => {
  if (!filterUi.modalOpen) return
  filterUi.modalOpen = false
  filterUi.lastPackWarning = false
  filterUi.lastDepthWarning = false
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

const toggleHistory = (): void => {
  if (filterUi.modalOpen) closeFiltersModal()
  filterUi.historyOpen = !filterUi.historyOpen
}

const activePoolFilters = () => ({
  includeWildcards: state.includeWildcards,
  includeOvertChristian: state.includeOvertChristian,
})

const historyCards = (): Question[] => {
  return state.history
    .slice(0, 8)
    .map((id) => questionMap.get(id))
    .filter(
      (q): q is Question =>
        q != null && isQuestionEnabled(q, activePoolFilters()),
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

const toggleDepth = (depth: Depth): void => {
  const isOn = state.depth.includes(depth)

  if (isOn && state.depth.length === 1) {
    feedbackBlocked()
    filterUi.lastDepthWarning = true
    return
  }

  filterUi.lastDepthWarning = false
  const next = orderedDepthSelection(
    isOn
      ? state.depth.filter((value) => value !== depth)
      : [...state.depth, depth],
  )

  if (
    next.length === state.depth.length &&
    next.every((value, idx) => value === state.depth[idx])
  ) {
    return
  }

  feedbackSelection()
  setDepth(next)
}

const toggleWildcards = (): void => {
  feedbackSelection()
  setIncludeWildcards(!state.includeWildcards)
}

const toggleOvertChristian = (): void => {
  feedbackSelection()
  setIncludeOvertChristian(!state.includeOvertChristian)
}

const updateStripOverflow = (el: HTMLElement): void => {
  const threshold = 2
  el.classList.toggle('has-overflow-start', el.scrollLeft > threshold)
  el.classList.toggle(
    'has-overflow-end',
    el.scrollLeft + el.clientWidth < el.scrollWidth - threshold,
  )
}

const hasPacks = (): boolean => state.context.length > 0

export const FilterBar = component(
  (
    props: Props<{
      onDrawQuestion: () => void
      onSelectCard: (id: string) => void
      onDeckReset: () => void
    }>,
  ) => html`
    <div class="controls-stack">
      <div class="controls">
        <div class="controls__primary">
          ${() =>
            state.currentQuestion
              ? html`<div class="controls__nav">
                  ${() =>
                    historyCards().length > 0
                      ? html`<button
                          type="button"
                          class="${() =>
                            'controls__nav-btn' +
                            (filterUi.historyOpen ? ' is-active' : '')}"
                          @click="${toggleHistory}"
                          aria-label="Card history"
                          aria-expanded="${() => filterUi.historyOpen}"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 256 256"
                            fill="currentColor"
                          >
                            <path
                              d="M136,80v43.47l36.12,21.67a8,8,0,0,1-8.24,13.72l-40-24A8,8,0,0,1,120,128V80a8,8,0,0,1,16,0Zm-8-48A95.44,95.44,0,0,0,60.08,60.15C52.81,67.51,46.35,74.59,40,82V64a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16H49c7.15-8.42,14.27-16.35,22.39-24.57a80,80,0,1,1,1.66,114.75,8,8,0,1,0-11,11.64A96,96,0,1,0,128,32Z"
                            ></path>
                          </svg>
                        </button>`
                      : null}
                  <button
                    type="button"
                    class="btn btn--fill"
                    @click="${() => props.onDrawQuestion()}"
                  >
                    New card
                  </button>
                </div>`
              : html`<div class="controls__empty-actions">
                  <button
                    type="button"
                    class="btn btn--outline"
                    @click="${() => {
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
                    @click="${props.onDrawQuestion}"
                  >
                    Draw a card
                  </button>
                </div>`}
        </div>

        ${() => {
          if (!filterUi.historyOpen || !state.currentQuestion) return null
          if (historyCards().length === 0) return null
          return html`<div
            class="history-strip"
            role="list"
            aria-label="Recent cards"
            @scroll="${(e: Event) =>
              updateStripOverflow(e.currentTarget as HTMLElement)}"
          >
            ${() => {
              const cards = historyCards()
              requestAnimationFrame(() => {
                const el = document.querySelector(
                  '.history-strip',
                ) as HTMLElement | null
                if (!el) return
                el.scrollTo({ left: 0 })
                updateStripOverflow(el)
              })
              return cards.map(
                (q) =>
                  html`<button
                    type="button"
                    class="${() =>
                      'history-strip__card' +
                      (q.id === state.currentQuestion?.id
                        ? ' history-strip__card--current'
                        : '')}"
                    role="listitem"
                    @click="${() => props.onSelectCard(q.id)}"
                  >
                    <span class="history-strip__text">${q.text}</span>
                  </button>`,
              )
            }}
          </div>`
        }}
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

                    <div class="controls__field">
                      <p class="controls__label" id="controls-depth-label">
                        How deep?
                      </p>
                      <div
                        class="controls__packs"
                        role="group"
                        aria-labelledby="controls-depth-label"
                      >
                        ${depthOptions.map(
                          (option) =>
                            html`<button
                              type="button"
                              class="${() =>
                                'chip chip--pack' +
                                (state.depth.includes(option.value)
                                  ? ' is-on'
                                  : '') +
                                (filterUi.lastDepthWarning &&
                                state.depth.length === 1 &&
                                state.depth[0] === option.value
                                  ? ' is-blocked'
                                  : '')}"
                              @click="${() => toggleDepth(option.value)}"
                              aria-pressed="${() =>
                                state.depth.includes(option.value)}"
                              title="${option.blurb}"
                            >
                              ${option.label}
                            </button>`,
                        )}
                      </div>
                      <p
                        class="${() =>
                          'controls__hint' +
                          (filterUi.lastDepthWarning
                            ? ' controls__hint--warn'
                            : '')}"
                      >
                        ${() =>
                          filterUi.lastDepthWarning
                            ? 'Pick another depth first, then disable this one.'
                            : state.depth.length
                              ? 'Enable or disable any depth.'
                              : 'Turn on at least one depth to draw a card.'}
                      </p>
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

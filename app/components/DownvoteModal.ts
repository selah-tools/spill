import { component, html, reactive } from '@arrow-js/core'

import { closeDownvoteModal, state, submitDownvote } from '../state'
import { feedbackDetailsToggle } from '../ui-feedback'

export const DownvoteModal = component(() => {
  const ui = reactive({ reason: '' })

  const close = (): void => {
    ui.reason = ''
    closeDownvoteModal()
    feedbackDetailsToggle(false)
  }

  const submit = (): void => {
    const reason = ui.reason
    ui.reason = ''
    submitDownvote(reason || undefined)
    feedbackDetailsToggle(false)
  }

  const skip = (): void => {
    ui.reason = ''
    submitDownvote()
    feedbackDetailsToggle(false)
  }

  return html`
    ${() =>
      state.downvoteModalOpen
        ? html`
            <div
              class="controls-modal"
              role="presentation"
              @keydown="${(event: Event) => {
                if ((event as KeyboardEvent).key !== 'Escape') return
                event.preventDefault()
                close()
              }}"
            >
              <div class="controls-modal__backdrop" @click="${close}"></div>
              <div
                id="downvote-modal"
                class="controls-modal__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="downvote-modal-title"
                tabindex="-1"
              >
                <div class="controls-modal__head">
                  <h2 class="controls-modal__title" id="downvote-modal-title">
                    Feedback
                  </h2>
                  <button
                    type="button"
                    class="controls-modal__close"
                    aria-label="Close feedback"
                    @click="${close}"
                  >
                    Done
                  </button>
                </div>

                <div class="controls__drawer">
                  <div class="controls__field">
                    <p class="controls__label" id="downvote-reason-label">
                      What could be better?
                    </p>
                    <textarea
                      class="downvote-modal__input"
                      rows="3"
                      maxlength="500"
                      placeholder="Too vague, too personal, not relevant…"
                      aria-labelledby="downvote-reason-label"
                      @input="${(event: Event) => {
                        ui.reason = (event.target as HTMLTextAreaElement).value
                      }}"
                    ></textarea>
                    <p class="controls__hint">
                      Optional — tell us why this question missed the mark.
                    </p>
                  </div>

                  <div class="downvote-modal__actions">
                    <button
                      type="button"
                      class="controls__reset-btn"
                      @click="${skip}"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      class="btn btn--fill downvote-modal__submit"
                      @click="${submit}"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `
        : null}
  `
})

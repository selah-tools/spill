import { component, html, reactive } from '@arrow-js/core'

import { closeAboutModal, state } from '../state'
import { feedbackDetailsToggle } from '../ui-feedback'

export type InstallHandler = (() => Promise<void>) | null

let _installHandler: InstallHandler = null

export const setInstallHandler = (handler: InstallHandler): void => {
  _installHandler = handler
}

const canInstall = reactive({ available: false })

export const setCanInstall = (available: boolean): void => {
  canInstall.available = available
}

export const AboutModal = component(
  () => html`
    ${() =>
      state.aboutModalOpen
        ? html`
            <div
              class="controls-modal"
              role="presentation"
              @keydown="${(e: Event) => {
                if ((e as KeyboardEvent).key !== 'Escape') return
                e.preventDefault()
                closeAboutModal()
                feedbackDetailsToggle(false)
              }}"
            >
              <div
                class="controls-modal__backdrop"
                @click="${() => {
                  closeAboutModal()
                  feedbackDetailsToggle(false)
                }}"
              ></div>
              <div
                id="about-modal"
                class="controls-modal__panel about-modal__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-modal-title"
                tabindex="-1"
              >
                <div class="controls-modal__head">
                  <h2 class="controls-modal__title" id="about-modal-title">
                    About Spill
                  </h2>
                  <button
                    type="button"
                    class="controls-modal__close"
                    aria-label="Close about"
                    @click="${() => {
                      closeAboutModal()
                      feedbackDetailsToggle(false)
                    }}"
                  >
                    Done
                  </button>
                </div>

                <div class="about-modal__content">
                  <div class="about-modal__section">
                    <p class="about-modal__lead">
                      Spill is redefining what it means to really talk with
                      friends.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <p class="about-modal__body">
                      Communication is our most important tool for building
                      relationships. We've all heard "spill the tea"—the
                      instinct to share and be known. But gossip and hot takes
                      rarely build anyone up.
                    </p>
                    <p class="about-modal__body">
                      Spill redirects that same instinct toward honesty that
                      heals, questions that matter, and conversations that leave
                      people more connected to each other and to God.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <h3 class="about-modal__subtitle">
                      The invitation is simple
                    </h3>
                    <p class="about-modal__body">
                      Open the site, choose a context and depth, and draw a card
                      within seconds. No setup, no accounts, no rooms. Just a
                      better question.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <h3 class="about-modal__subtitle">
                      For moments that matter
                    </h3>
                    <ul class="about-modal__list">
                      <li>Friends hanging out and wanting something real</li>
                      <li>
                        Dating or engaged couples seeking faith-shaped
                        discussion
                      </li>
                      <li>Small groups that need a thoughtful starter</li>
                      <li>
                        Families or youth groups wanting safe but meaningful
                        questions
                      </li>
                    </ul>
                  </div>

                  <div class="about-modal__section about-modal__section--final">
                    ${() =>
                      canInstall.available
                        ? html`<button
                            type="button"
                            class="btn btn--fill about-modal__install"
                            @click="${() => void _installHandler?.()}"
                          >
                            Add to Home Screen
                          </button>`
                        : null}
                    <p class="about-modal__epilogue">
                      Draw a card. Spill something real.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          `
        : null}
  `,
)

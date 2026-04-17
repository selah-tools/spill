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
                      Spill is built on a conviction: God designed the Church to
                      live as a spiritual family under Christ.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <p class="about-modal__body">
                      Most conversation tools assume community is casual,
                      shallow, and optional. Spill is for a different vision:
                      relationships marked by everyday shared life,
                      encouragement, repair, sacrifice, and sanctification.
                    </p>
                    <p class="about-modal__body">
                      So Spill is not just trying to make conversations more
                      interesting. It is trying to help households, brothers and
                      sisters in fellowship, dating couples, engaged couples,
                      married couples, and youth talk in ways that make their
                      relationships deeper, stronger, and more meaningfully
                      shaped by Jesus.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <h3 class="about-modal__subtitle">
                      The invitation is simple
                    </h3>
                    <p class="about-modal__body">
                      Open the site, choose a pack and depth, and draw a card
                      within seconds. No setup, no accounts, no rooms. Just a
                      better question for the kind of shared life you're trying
                      to build.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <h3 class="about-modal__subtitle">
                      The packs reflect that vision
                    </h3>
                    <p class="about-modal__body">
                      Fellowship is for shared life with brothers and sisters in
                      Christ. Household is for the daily life of a home. Dating
                      is written for discernment, clarity, tenderness, and
                      purity—never temptation. Engaged is for covenant prep.
                      Marriage is for spouses living covenant in ordinary life.
                      Youth stays honest, safe, and age-aware.
                    </p>
                  </div>

                  <div class="about-modal__section">
                    <h3 class="about-modal__subtitle">
                      For moments that matter
                    </h3>
                    <ul class="about-modal__list">
                      <li>Fellowship nights, meals, and post-church hangs</li>
                      <li>Households wanting warmer and deeper shared life</li>
                      <li>
                        Dating couples seeking clarity without feeding
                        temptation
                      </li>
                      <li>
                        Engaged couples preparing for covenant with honesty
                      </li>
                      <li>
                        Married couples tending friendship, repair, and prayer
                      </li>
                      <li>
                        Youth nights that need honest but age-aware prompts
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

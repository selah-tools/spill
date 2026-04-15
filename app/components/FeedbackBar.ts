import { component, html } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

import { state } from '../state'

export const FeedbackBar = component(
  (props: Props<{ onCopy: () => void; onShare: () => void }>) => html`
    ${() =>
      state.currentPrompt
        ? html`<div class="feedback">
            <button type="button" class="fb-btn" @click="${props.onCopy}">
              Copy
            </button>
            <button type="button" class="fb-btn" @click="${props.onShare}">
              Share
            </button>
          </div>`
        : ''}
  `,
)

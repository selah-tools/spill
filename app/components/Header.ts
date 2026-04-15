import { component, html } from '@arrow-js/core'

export const Header = component(
  () => html`
    <header class="header">
      <a class="wordmark" href="${import.meta.env.BASE_URL}">Spill</a>
      <span class="domain">spill.cards</span>
    </header>
  `,
)

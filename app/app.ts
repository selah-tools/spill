import { html, reactive } from '@arrow-js/core'

import {
  clearSeenPrompts,
  loadSeenPromptIds,
  trackPromptEvent,
} from './analytics'
import { AboutModal } from './components/AboutModal'
import { DownvoteModal } from './components/DownvoteModal'
import { FilterBar, filterUi, toggleFiltersModal } from './components/FilterBar'
import { PromptCard } from './components/PromptCard'
import {
  appPublicRootPath,
  cardPathForPrompt,
  parseCardSlugFromPathname,
  promptForCardSlug,
} from './card-slug'
import { getPromptById, pickPrompt } from './generator'
import {
  cardPackMetaLabel,
  depthOptions,
  isOvertChristianPrompt,
  orderedDeck,
  type Prompt,
} from './prompts'
import {
  clearCurrentPrompt,
  openAboutModal,
  setCurrentPrompt,
  setCurrentPromptFromDeck,
  setLoading,
  setMode,
  setNotice,
  state,
} from './state'
import {
  feedbackDetailsToggle,
  feedbackError,
  feedbackPrimary,
  feedbackSoftSuccess,
  feedbackSuccess,
} from './ui-feedback'

const handleToggleFilters = (): void => {
  feedbackDetailsToggle(!filterUi.modalOpen)
  toggleFiltersModal()
}

import './styles.css'
import './agentation-mount'
import './pwa'

/** Narrow viewports get `html.mobile-native` - native-style shell (safe areas, dock, touch). */
const MOBILE_NATIVE_MQ = '(max-width: 639px)'

const syncMobileNativeClass = (): void => {
  document.documentElement.classList.toggle(
    'mobile-native',
    window.matchMedia(MOBILE_NATIVE_MQ).matches,
  )
}

syncMobileNativeClass()
window
  .matchMedia(MOBILE_NATIVE_MQ)
  .addEventListener('change', syncMobileNativeClass)

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Missing #app root element')

let noticeTimer: number | undefined
const copyUi = reactive({ copied: false })
let copyTimer: number | undefined

const copyIconSvg = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect x="9" y="9" width="13" height="13" rx="2" />
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
</svg>`

const checkIconSvg = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <polyline points="20 6 9 17 4 12" />
</svg>`

const servedAudienceLabel = () =>
  cardPackMetaLabel(
    state.currentPrompt?.audience ?? state.servedContext ?? state.context,
  )

const servedDepthLabel = () =>
  depthOptions.find((o) => o.value === (state.servedDepth ?? state.depth))
    ?.label ?? 'Light'

const activePoolFilters = () => ({
  includeWildcards: state.includeWildcards,
  includeOvertChristian: state.includeOvertChristian,
})

const visibleDeck = () => orderedDeck(activePoolFilters())

const flashNotice = (msg: string): void => {
  setNotice(msg)
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => setNotice(''), 2800)
}

const syncCardUrl = (how: 'push' | 'replace'): void => {
  const p = state.currentPrompt
  if (!p) {
    const home = appPublicRootPath()
    if (parseCardSlugFromPathname(location.pathname)) {
      history.replaceState(null, '', home)
    }
    return
  }
  const path = cardPathForPrompt(p)
  if (!path) return
  if (location.pathname === path || location.pathname === `${path}/`) return
  history[how === 'push' ? 'pushState' : 'replaceState'](null, '', path)
}

const applyCardFromRoute = (): void => {
  const slug = parseCardSlugFromPathname(location.pathname)
  if (!slug) {
    if (state.currentPrompt) {
      clearCurrentPrompt()
    }
    return
  }
  const prompt = promptForCardSlug(slug)
  if (!prompt) {
    flashNotice('That card link is not valid.')
    history.replaceState(null, '', appPublicRootPath())
    clearCurrentPrompt()
    return
  }
  setMode(prompt.mode)
  setCurrentPromptFromDeck(prompt)
  trackPromptEvent(
    prompt,
    prompt.audience,
    prompt.depth,
    prompt.mode,
    'prompt_viewed',
  )
}

window.addEventListener('popstate', () => {
  applyCardFromRoute()
})

const formatShare = (): string => {
  if (!state.currentPrompt) return ''

  const lead = state.currentPrompt.mode === 'wildcard' ? 'Wildcard' : 'Prompt'
  const path = cardPathForPrompt(state.currentPrompt)
  const link =
    path && typeof location !== 'undefined' ? `${location.origin}${path}` : ''
  const tail = link ? `${link}\nspill.cards` : 'spill.cards'
  const meta = [
    isOvertChristianPrompt(state.currentPrompt) ? 'Overt' : '',
    servedAudienceLabel(),
    servedDepthLabel(),
  ]
    .filter(Boolean)
    .join(' · ')

  return `${lead} - ${state.currentPrompt.text}\n\n${meta}\n${tail}`
}

const copyText = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', 'true')
  ta.style.position = 'absolute'
  ta.style.left = '-9999px'
  document.body.append(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

/** Briefly animate the current card out, then run `cb` to swap in the new one. */
const animateCardExit = (cb: () => void): void => {
  const frame = document.querySelector('.card.is-live .card-frame')
  if (!frame || !(frame instanceof HTMLElement)) {
    cb()
    return
  }
  frame.style.transition = `opacity 120ms var(--ease-out), transform 120ms var(--ease-out)`
  frame.style.opacity = '0'
  frame.style.transform = 'translateY(-4px)'
  setTimeout(() => {
    frame.style.transition = ''
    frame.style.opacity = ''
    frame.style.transform = ''
    cb()
  }, 130)
}

const dealCard = (source: 'initial' | 'new'): void => {
  if (!state.context.length) {
    feedbackError()
    flashNotice('Turn on at least one pack.')
    return
  }

  const doDeal = (): void => {
    setLoading(true)

    const { prompt, exhaustedUnseen } = pickPrompt({
      context: state.context,
      depth: state.depth,
      includeWildcards: state.includeWildcards,
      includeOvertChristian: state.includeOvertChristian,
      recentPromptIds: state.recentPromptIds,
      seenPromptIds: loadSeenPromptIds(),
      sessionCardCount: state.history.length,
    })

    setLoading(false)

    if (!prompt) {
      feedbackError()
      flashNotice(
        'Nothing matched. Try another depth or turn on more card types.',
      )
      return
    }

    feedbackPrimary()
    setMode(prompt.mode)
    setCurrentPrompt(prompt)
    syncCardUrl('push')

    if (exhaustedUnseen) {
      flashNotice(
        "You've seen every card for these filters. Showing one again.",
      )
    }

    trackPromptEvent(
      prompt,
      prompt.audience,
      prompt.depth,
      prompt.mode,
      'prompt_viewed',
    )

    if (source === 'new') {
      trackPromptEvent(
        prompt,
        prompt.audience,
        prompt.depth,
        prompt.mode,
        'new_prompt_requested',
      )
    }

    if (prompt.mode === 'wildcard') {
      trackPromptEvent(
        prompt,
        prompt.audience,
        prompt.depth,
        prompt.mode,
        'wildcard_opened',
      )
    }
  }

  // Animate exit only when replacing an existing card
  if (state.currentPrompt) {
    animateCardExit(doDeal)
  } else {
    doDeal()
  }
}

const handleDrawPrompt = (): void => {
  dealCard(state.currentPrompt ? 'new' : 'initial')
}

const trackDeckView = (prompt: Prompt): void => {
  trackPromptEvent(
    prompt,
    prompt.audience,
    prompt.depth,
    prompt.mode,
    'prompt_viewed',
  )
}

const handleSelectCard = (promptId: string): void => {
  const prompt = getPromptById(promptId)
  if (!prompt) return
  feedbackPrimary()
  setMode(prompt.mode)
  setCurrentPromptFromDeck(prompt)
  syncCardUrl('push')
  trackDeckView(prompt)
}

const handleDeckReset = (): void => {
  const ok = window.confirm(
    'Clear your seen cards and jump to the first card in this deck?',
  )
  if (!ok) return

  clearSeenPrompts()
  const deck = visibleDeck()
  const first = deck[0]
  if (!first) {
    feedbackError()
    flashNotice('No cards in this deck.')
    return
  }

  feedbackPrimary()
  setMode(first.mode)
  setCurrentPromptFromDeck(first)
  syncCardUrl('replace')
  trackDeckView(first)
  flashNotice('Deck reset. Shown cards were cleared.')
}

const handleCopy = async (): Promise<void> => {
  if (!state.currentPrompt) return
  await copyText(formatShare())
  trackPromptEvent(
    state.currentPrompt,
    state.currentPrompt.audience,
    state.currentPrompt.depth,
    state.currentPrompt.mode,
    'prompt_copied',
  )
  feedbackSoftSuccess()
}

type NativeShareOutcome = 'shared' | 'aborted' | 'unavailable'

/** Uses the platform Web Share API (native share sheet on iOS/Android, some desktops). */
async function tryNavigatorShare(data: ShareData): Promise<NativeShareOutcome> {
  if (typeof navigator.share !== 'function') return 'unavailable'
  if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
    return 'unavailable'
  }
  try {
    await navigator.share(data)
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'aborted'
    return 'unavailable'
  }
}

const handleShare = async (): Promise<void> => {
  if (!state.currentPrompt) return
  const text = formatShare()
  const path = cardPathForPrompt(state.currentPrompt)
  const url = path ? `${location.origin}${path}` : undefined

  const withLinkField: ShareData = {
    title: 'Spill',
    text,
    ...(url ? { url } : {}),
  }
  const textOnly: ShareData = { title: 'Spill', text }

  let outcome = await tryNavigatorShare(withLinkField)
  if (outcome === 'aborted') return
  if (outcome !== 'shared' && url) {
    outcome = await tryNavigatorShare(textOnly)
    if (outcome === 'aborted') return
  }

  if (outcome === 'shared') {
    trackPromptEvent(
      state.currentPrompt,
      state.currentPrompt.audience,
      state.currentPrompt.depth,
      state.currentPrompt.mode,
      'prompt_shared',
    )
    feedbackSuccess()
    flashNotice('Shared.')
    return
  }

  await copyText(text)
  trackPromptEvent(
    state.currentPrompt,
    state.currentPrompt.audience,
    state.currentPrompt.depth,
    state.currentPrompt.mode,
    'prompt_copied',
  )
  feedbackSoftSuccess()
  flashNotice('Copied instead - native share is not available here.')
}

applyCardFromRoute()

html`
  <div class="page">
    <div
      class="${() =>
        'page__top' + (state.currentPrompt ? ' page__top--compact' : '')}"
    >
      <header class="header">
        <a class="wordmark" href="${import.meta.env.BASE_URL}">Spill</a>
        <div class="header__rating">
          ${() =>
            state.currentPrompt
              ? html`<button
                    type="button"
                    class="${() =>
                      'header__rate header__rate--filter' +
                      (filterUi.modalOpen ? ' is-active' : '')}"
                    @click="${handleToggleFilters}"
                    aria-label="Adjust packs"
                    aria-expanded="${() => filterUi.modalOpen}"
                    aria-haspopup="dialog"
                    aria-controls="controls-filters-modal"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="${() =>
                      'header__rate' + (copyUi.copied ? ' is-copied' : '')}"
                    @click="${() => {
                      handleCopy()
                      copyUi.copied = true
                      if (copyTimer) window.clearTimeout(copyTimer)
                      copyTimer = window.setTimeout(() => {
                        copyUi.copied = false
                      }, 1400)
                    }}"
                    aria-label="Copy question"
                  >
                    ${() => (copyUi.copied ? checkIconSvg : copyIconSvg)}
                  </button>
                  <button
                    type="button"
                    class="header__rate"
                    @click="${handleShare}"
                    aria-label="Share question"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>`
              : null}
          <button
            type="button"
            class="header__rate"
            @click="${openAboutModal}"
            aria-label="About Spill"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 256 256"
            >
              <rect width="256" height="256" fill="none" />
              <circle cx="128" cy="180" r="12" />
              <path
                d="M128,144v-8c17.67,0,32-12.54,32-28s-14.33-28-32-28S96,92.54,96,108v4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <circle
                cx="128"
                cy="128"
                r="96"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
            </svg>
          </button>
        </div>
      </header>
    </div>

    <main class="main">${PromptCard()}</main>

    <div class="app-dock">
      ${FilterBar({
        onDrawPrompt: handleDrawPrompt,
        onSelectCard: handleSelectCard,
        onDeckReset: handleDeckReset,
      })}
      ${AboutModal()} ${DownvoteModal()}
    </div>

    ${() =>
      state.notice
        ? html`<div class="toast" role="status">
            <p class="toast__text">${() => state.notice}</p>
          </div>`
        : null}
  </div>
`(root)

import { html, reactive } from '@arrow-js/core'

import { initSentry } from './sentry'

initSentry()

import {
  clearSeenQuestions,
  loadSeenQuestionIds,
  trackQuestionEvent,
} from './analytics'
import {
  AboutModal,
  setCanInstall as setAboutCanInstall,
  setInstallHandler,
} from './components/AboutModal'
import { DownvoteModal } from './components/DownvoteModal'
import { FilterBar, filterUi, toggleFiltersModal } from './components/FilterBar'
import { QuestionCard } from './components/QuestionCard'
import {
  appPublicRootPath,
  cardPathForQuestion,
  parseCardSlugFromPathname,
  questionForCardSlug,
  rebuildSlugMaps,
} from './card-slug'
import { getQuestionById, pickQuestion } from './generator'
import {
  cardPackMetaLabel,
  depthOptions,
  isOvertChristianQuestion,
  orderedDeck,
  type Question,
} from './questions'
import {
  clearCurrentQuestion,
  openAboutModal,
  resetHistory,
  setCurrentQuestion,
  setCurrentQuestionFromDeck,
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

import { applySwUpdate, setSwUpdateHandler } from './pwa'

/** PWA install prompt — surfaced on supported browsers (Chrome, Edge, Samsung). */
const installState = reactive({
  deferredPrompt: null as BeforeInstallPromptEvent | null,
  dismissed: false,
})

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault()
  installState.deferredPrompt = e as BeforeInstallPromptEvent
  setAboutCanInstall(true)
})

window.addEventListener('appinstalled', () => {
  installState.deferredPrompt = null
  installState.dismissed = false
  setAboutCanInstall(false)
})

/** Trigger the native install prompt when available. */
export const handleInstall = async (): Promise<void> => {
  if (!installState.deferredPrompt) return
  await installState.deferredPrompt.prompt()
  const { outcome } = await installState.deferredPrompt.userChoice
  if (outcome === 'dismissed') {
    installState.dismissed = true
  }
  installState.deferredPrompt = null
}

setInstallHandler(async () => {
  await handleInstall()
})

const updateBanner = reactive({ visible: false })

setSwUpdateHandler(() => {
  updateBanner.visible = true
})

const handleApplyUpdate = (): void => {
  updateBanner.visible = false
  applySwUpdate()
}

import './styles.css'
import './agentation-mount'

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
    state.currentQuestion?.audience ?? state.servedContext ?? state.context,
  )

const servedDepthLabel = () => {
  const d = state.currentQuestion?.depth ?? state.servedDepth
  return d
    ? (depthOptions.find((o) => o.value === d)?.label ?? 'Light')
    : 'Light'
}

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
  const q = state.currentQuestion
  if (!q) {
    const home = appPublicRootPath()
    if (parseCardSlugFromPathname(location.pathname)) {
      history.replaceState(null, '', home)
    }
    return
  }
  const path = cardPathForQuestion(q)
  if (!path) return
  if (location.pathname === path || location.pathname === `${path}/`) return
  history[how === 'push' ? 'pushState' : 'replaceState'](null, '', path)
}

const applyCardFromRoute = (): void => {
  const slug = parseCardSlugFromPathname(location.pathname)
  if (!slug) {
    if (state.currentQuestion) {
      clearCurrentQuestion()
    }
    return
  }
  const question = questionForCardSlug(slug)
  if (!question) {
    flashNotice('That card link is not valid.')
    history.replaceState(null, '', appPublicRootPath())
    clearCurrentQuestion()
    return
  }
  setMode(question.mode)
  setCurrentQuestionFromDeck(question)
  trackQuestionEvent(
    question,
    question.audience,
    question.depth,
    question.mode,
    'question_viewed',
  )
}

window.addEventListener('popstate', () => {
  applyCardFromRoute()
})

const formatShare = (): string => {
  if (!state.currentQuestion) return ''

  const lead =
    state.currentQuestion.mode === 'wildcard' ? 'Wildcard' : 'Question'
  const path = cardPathForQuestion(state.currentQuestion)
  const link =
    path && typeof location !== 'undefined' ? `${location.origin}${path}` : ''
  const tail = link ? `${link}\nspill.cards` : 'spill.cards'
  const meta = [
    isOvertChristianQuestion(state.currentQuestion) ? 'Overt' : '',
    servedAudienceLabel(),
    servedDepthLabel(),
  ]
    .filter(Boolean)
    .join(' · ')

  return `${lead} - ${state.currentQuestion.text}\n\n${meta}\n${tail}`
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

  if (!state.depth.length) {
    feedbackError()
    flashNotice('Turn on at least one depth.')
    return
  }

  const doDeal = (): void => {
    setLoading(true)

    const { question, exhaustedUnseen } = pickQuestion({
      context: state.context,
      depth: state.depth,
      includeWildcards: state.includeWildcards,
      includeOvertChristian: state.includeOvertChristian,
      recentQuestionIds: state.recentQuestionIds,
      seenQuestionIds: loadSeenQuestionIds(),
    })

    setLoading(false)

    if (!question) {
      feedbackError()
      flashNotice(
        'Nothing matched. Try another depth or turn on more card types.',
      )
      return
    }

    feedbackPrimary()
    setMode(question.mode)
    setCurrentQuestion(question)
    syncCardUrl('push')

    if (exhaustedUnseen) {
      flashNotice(
        "You've seen every card for these filters. Showing one again.",
      )
    }

    trackQuestionEvent(
      question,
      question.audience,
      question.depth,
      question.mode,
      'question_viewed',
    )

    if (source === 'new') {
      trackQuestionEvent(
        question,
        question.audience,
        question.depth,
        question.mode,
        'new_question_requested',
      )
    }

    if (question.mode === 'wildcard') {
      trackQuestionEvent(
        question,
        question.audience,
        question.depth,
        question.mode,
        'wildcard_opened',
      )
    }
  }

  // Animate exit only when replacing an existing card
  if (state.currentQuestion) {
    animateCardExit(doDeal)
  } else {
    doDeal()
  }
}

const handleDrawQuestion = (): void => {
  dealCard(state.currentQuestion ? 'new' : 'initial')
}

const trackDeckView = (question: Question): void => {
  trackQuestionEvent(
    question,
    question.audience,
    question.depth,
    question.mode,
    'question_viewed',
  )
}

const handleSelectCard = (questionId: string): void => {
  const question = getQuestionById(questionId)
  if (!question) return
  feedbackPrimary()
  setMode(question.mode)
  setCurrentQuestionFromDeck(question)
  syncCardUrl('push')
  trackDeckView(question)
}

const handleDeckReset = (): void => {
  const ok = window.confirm(
    'Clear your seen cards and jump to the first card in this deck?',
  )
  if (!ok) return

  clearSeenQuestions()
  resetHistory()
  const deck = visibleDeck()
  const first = deck[0]
  if (!first) {
    feedbackError()
    flashNotice('No cards in this deck.')
    return
  }

  feedbackPrimary()
  setMode(first.mode)
  setCurrentQuestionFromDeck(first)
  syncCardUrl('replace')
  trackDeckView(first)
  flashNotice('Deck reset. Shown cards were cleared.')
}

const handleCopy = async (): Promise<void> => {
  if (!state.currentQuestion) return
  await copyText(formatShare())
  trackQuestionEvent(
    state.currentQuestion,
    state.currentQuestion.audience,
    state.currentQuestion.depth,
    state.currentQuestion.mode,
    'question_copied',
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
  if (!state.currentQuestion) return
  const text = formatShare()
  const path = cardPathForQuestion(state.currentQuestion)
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
    trackQuestionEvent(
      state.currentQuestion,
      state.currentQuestion.audience,
      state.currentQuestion.depth,
      state.currentQuestion.mode,
      'question_shared',
    )
    feedbackSuccess()
    flashNotice('Shared.')
    return
  }

  await copyText(text)
  trackQuestionEvent(
    state.currentQuestion,
    state.currentQuestion.audience,
    state.currentQuestion.depth,
    state.currentQuestion.mode,
    'question_copied',
  )
  feedbackSoftSuccess()
  flashNotice('Copied instead - native share is not available here.')
}

rebuildSlugMaps()
applyCardFromRoute()

html`
  <div class="page">
    <div
      class="${() =>
        'page__top' + (state.currentQuestion ? ' page__top--compact' : '')}"
    >
      <header class="header">
        <a class="wordmark" href="${import.meta.env.BASE_URL}">Spill</a>
        <div class="header__rating">
          ${() =>
            state.currentQuestion
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
              <circle
                cx="128"
                cy="180"
                r="8"
                fill="none"
                stroke="currentColor"
                stroke-width="16"
              />
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

    <main class="main">${QuestionCard()}</main>

    <div class="app-dock">
      ${FilterBar({
        onDrawQuestion: handleDrawQuestion,
        onSelectCard: handleSelectCard,
        onDeckReset: handleDeckReset,
      })}
      ${AboutModal()} ${DownvoteModal()}
    </div>

    ${() =>
      updateBanner.visible
        ? html`<div class="update-banner" role="status">
            <p class="update-banner__text">A new version is ready.</p>
            <button
              type="button"
              class="update-banner__btn"
              @click="${handleApplyUpdate}"
            >
              Update
            </button>
          </div>`
        : null}
    ${() =>
      state.notice
        ? html`<div class="toast" role="status">
            <p class="toast__text">${() => state.notice}</p>
          </div>`
        : null}
  </div>
`(root)

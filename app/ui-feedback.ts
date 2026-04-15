import { WebHaptics } from 'web-haptics'

/** Web Vibration API — no-ops on unsupported devices. */
export const haptic = new WebHaptics()

// ---------------------------------------------------------------------------
// Tiny sine-tone player using the Web Audio API.
// No external sound files, no loading step — just oscillators.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
    return ctx
  } catch {
    return null
  }
}

/**
 * Play a short sine-wave tone.
 * @param freq   Fundamental frequency in Hz
 * @param gain   Volume 0-1
 * @param dur    Duration in seconds
 */
function sine(freq: number, gain = 0.15, dur = 0.08): void {
  const c = getCtx()
  if (!c) return
  // Resume if suspended (first interaction on iOS/Safari)
  if (c.state === 'suspended') void c.resume()

  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.value = gain
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
  osc.connect(g).connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + dur)
}

// ---------------------------------------------------------------------------
// Sine-tone presets — distinct pitches for each semantic role
// ---------------------------------------------------------------------------

const TONE = {
  /** Short percussive tap — buttons, secondary actions */
  tap: () => sine(1_200, 0.12, 0.06),
  /** Rising select — answering, primary card actions */
  select: () => {
    sine(880, 0.14, 0.07)
    setTimeout(() => sine(1_100, 0.1, 0.06), 50)
  },
  /** Toggle flip — skip, prev/next navigation */
  toggle: () => {
    sine(660, 0.12, 0.05)
    setTimeout(() => sine(990, 0.1, 0.06), 40)
  },
  /** Two-note notification — copy, lightweight success */
  notify: () => {
    sine(1_050, 0.12, 0.08)
    setTimeout(() => sine(1_320, 0.1, 0.1), 70)
  },
  /** Celebratory rise — share, milestones */
  celebrate: () => {
    sine(880, 0.1, 0.06)
    setTimeout(() => sine(1_100, 0.1, 0.06), 60)
    setTimeout(() => sine(1_320, 0.12, 0.12), 120)
  },
  /** Low caution — destructive confirms, approaching reset */
  caution: () => {
    sine(440, 0.12, 0.07)
    setTimeout(() => sine(350, 0.1, 0.09), 50)
  },
  /** Error buzz — validation failures */
  error: () => {
    sine(330, 0.14, 0.05)
    setTimeout(() => sine(260, 0.12, 0.07), 50)
  },
} as const

// ---------------------------------------------------------------------------
// Public feedback helpers — haptic + tone paired by semantics
// ---------------------------------------------------------------------------

/** Primary actions: draw / answered */
export function feedbackPrimary(): void {
  void haptic.trigger('medium')
  TONE.select()
}

/** Secondary / outline actions */
export function feedbackSecondary(): void {
  void haptic.trigger('light')
  TONE.tap()
}

/** Segments, pickers, discrete filters */
export function feedbackSelection(): void {
  void haptic.trigger('selection')
  TONE.tap()
}

/** Copy, lightweight confirmation */
export function feedbackSoftSuccess(): void {
  void haptic.trigger('success')
  TONE.notify()
}

/** Share, milestone moments */
export function feedbackSuccess(): void {
  void haptic.trigger('success')
  TONE.celebrate()
}

/** Validation / nothing matched */
export function feedbackError(): void {
  void haptic.trigger('error')
  TONE.error()
}

/** Disabled / blocked action — can't deselect last item */
export function feedbackBlocked(): void {
  void haptic.trigger('error')
  TONE.error()
}

/** Destructive confirm, approaching reset */
export function feedbackWarning(): void {
  void haptic.trigger('warning')
  TONE.caution()
}

/** Prev / next / skip */
export function feedbackDeckNav(): void {
  void haptic.trigger('medium')
  TONE.toggle()
}

/** Filters modal open / close */
export function feedbackDetailsToggle(open: boolean): void {
  void open
  void haptic.trigger('light')
  TONE.tap()
}

/** Thumbs up — positive rating */
export function feedbackRateUp(): void {
  void haptic.trigger('success')
  TONE.notify()
}

/** Thumbs down — negative rating */
export function feedbackRateDown(): void {
  void haptic.trigger('warning')
  TONE.caution()
}

// Whether a diagram has the reader's gestures (BON-78). Decisions: LOG.md, "Pan, zoom and turn the way people expect (BON-78)".
// A diagram in a page that does not scroll always has them. One in a page that scrolls gets them on a click (or a tap,
// or two fingers) and lets go on Esc or a press outside it, so scrolling past it scrolls the page; a hint says how to take hold.
import type { Mode } from './camera.ts'
import { guessInput, hintShown, holdChanged, insetRadii, type HoldHow, type Input, type Radii } from './controls.ts'

/** How long the hint stays up after the last wheel or touch that asked for it, ms. */
export const HINT_MS = 1500

const scrolls = (overflow: string) => overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay'

/** Whether `el` sits in something the reader can scroll: an ancestor that scrolls, or the page itself. */
export function inScroller(el: HTMLElement | null): boolean {
  if (!el) return false
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && scrolls(getComputedStyle(n).overflowY)) return true
  }
  const root = document.scrollingElement ?? document.documentElement
  if (root.scrollHeight <= root.clientHeight + 1) return false
  // a page that has switched its own scrolling off does not scroll
  return getComputedStyle(document.documentElement).overflowY !== 'hidden' && getComputedStyle(document.body).overflowY !== 'hidden'
}

/** The held ring's corners: those of the nearest ancestor (the diagram's own box included) that clips and is rounded. */
export function clipRadii(el: HTMLElement): Radii {
  const me = el.getBoundingClientRect()
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
    const r = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => parseFloat(v) || 0) as Radii
    if (!r.some(v => v > 0)) continue
    return insetRadii(r, me, n.getBoundingClientRect())
  }
  return [0, 0, 0, 0]
}

/** The input to assume before the reader uses one, from the device (`guessInput`). */
export function firstInput(): Input {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return guessInput(coarse, typeof navigator !== 'undefined' ? navigator.platform : '')
}

/** One per diagram: whether it is held, the input last used, how many fingers are down, and who to tell. */
export class Gate {
  held = false
  input: Input = firstInput()
  /** Touches down on the canvas; a node drag gives way once there are two. */
  fingers = 0
  /** The diagram's box: a press outside it lets go. */
  el: HTMLElement | null = null
  mode: () => Mode = () => 'iso'
  /** Told when `held` changes. */
  readonly listeners = new Set<() => void>()
  onHint: () => void = () => {}
  onInput: (i: Input) => void = () => {}
  private hintUntil = 0

  /** The diagram has the gestures: held, or not in a page that scrolls. */
  engaged() { return this.held || !inScroller(this.el) }

  hold(on: boolean, how: HoldHow) {
    if (this.held === on) return
    this.held = on
    // only a diagram in a page that scrolls has anything to take hold of or let go of
    if (inScroller(this.el)) holdChanged(on, how, this.mode())
    for (const f of this.listeners) f()
  }

  /** Show the hint (again); one span per time it appears, not per wheel event. */
  hint() {
    const now = performance.now()
    if (now > this.hintUntil) hintShown(this.input, this.mode())
    this.hintUntil = now + HINT_MS
    this.onHint()
  }

  setInput(i: Input) {
    if (i === this.input) return
    this.input = i
    this.onInput(i)
  }
}

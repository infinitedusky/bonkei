// What the reader's controls allow, as pure decisions SceneView asks for. No React and no .tsx
// imports, so node can test it. Decisions: LOG.md, "The Bonkei component and render() (BON-51)"
// and "Pan, zoom and turn the way people expect (BON-78)".
import type { Span } from '@opentelemetry/api'
import type { Mode } from './camera.ts'
import type { ResolvedControls } from './options.ts'
import { instant, tracer } from './telemetry.ts'

export const ALL_ON: Readonly<ResolvedControls> = Object.freeze({ zoom: true, pan: true, move: true, drillIn: true })

/** The keys held during a wheel event, and its deltas (any unit: only which way it mostly goes counts). */
export interface WheelKeys { ctrlKey: boolean; metaKey: boolean; shiftKey?: boolean; deltaX?: number; deltaY?: number }

/**
 * A wheel over the scene. A trackpad pinch arrives as a wheel with ctrlKey, so pinch and cmd/ctrl + wheel
 * zoom. A plain wheel or a two-finger drag moves the view, but only once the diagram has the gestures
 * (`engaged`): a diagram in a page that scrolls lets the page scroll and asks for a hint instead (`hint`), until it
 * is clicked. A mostly sideways one there is stopped as well as hinted (`block`): the page scrolls up and down, and a
 * sideways swipe left to it is the browser's Back. In 3D, Shift turns the wheel into turning. `pass` leaves the event to the page.
 */
export function wheelAction(controls: ResolvedControls, keys: WheelKeys, engaged: boolean, mode: Mode): WheelAct {
  if (keys.ctrlKey || keys.metaKey) return controls.zoom ? 'zoom' : 'pass'
  if (!controls.pan) return 'pass'
  if (!engaged) return Math.abs(keys.deltaX ?? 0) > Math.abs(keys.deltaY ?? 0) ? 'block' : 'hint'
  return mode === '3d' && keys.shiftKey ? 'turn' : 'pan'
}
export type WheelAct = 'zoom' | 'pan' | 'turn' | 'hint' | 'block' | 'pass'

/**
 * One per diagram: a sideways swipe that was stopped (`block`) stays stopped until the wheel has been still for `gapMs`,
 * its momentum included. A swipe is never quite level: one event in it that goes more up or down than sideways, left to
 * the page, would start the page's scrolling, the browser stops letting the rest be cancelled, and the rest is Back.
 */
export function swipeLatch(gapMs = WHEEL_IDLE_MS): (a: WheelAct, now: number) => WheelAct {
  let until = -Infinity
  return (a, now) => {
    if (a === 'block' || (a === 'hint' && now < until)) { until = now + gapMs; return 'block' }
    until = -Infinity
    return a
  }
}

/**
 * Whether a click (or a tap) takes hold of a diagram in a page that scrolls. Holding hands it the plain wheel and one
 * finger, which only moving the view (`pan`) or a node (`move`) use; with both off there is nothing to hold, so no ring.
 */
export const holdable = (controls: ResolvedControls) => controls.pan || controls.move

/** `swapped`: the gesture was reached with Shift or the secondary button, not by its plain form. */
export const isSwapped = (button: number, shift: boolean) => button === 2 || shift

/**
 * A drag on the ground; nothing when `pan` is off. Flat and iso: move, and turn with Shift or the secondary
 * button. 3D: turn, and move with Shift or the secondary button. One finger on a touch screen always moves
 * (there is no Shift; two fingers turn and tilt).
 */
export function dragAction(controls: ResolvedControls, mode: Mode, button: number, shift: boolean, pointerType = 'mouse'): 'pan' | 'turn' | 'none' {
  if (!controls.pan) return 'none'
  if (pointerType === 'touch') return 'pan'
  const swapped = isSwapped(button, shift)
  if (mode === '3d') return swapped ? 'pan' : 'turn'
  return swapped ? 'turn' : 'pan'
}

/** The yaw a turn settles on when let go: flat and iso snap to the nearest quarter turn from their own heading; 3D stays where it was left. */
export function settleYaw(mode: Mode, yaw: number, base: number): number {
  if (mode === '3d') return yaw
  const q = Math.PI / 2
  return base + Math.round((yaw - base) / q) * q
}

/** Radians of turn (and tilt) per px of drag. */
export const TURN_PER_PX = 0.005
const LINE_PX = 16 // a wheel in lines (deltaMode 1): px per line

/** A wheel event's deltas in px: lines and pages (deltaMode 1 and 2) become px. */
export function wheelPx(e: { deltaMode: number; deltaX: number; deltaY: number }, pageH: number): { dx: number; dy: number } {
  const k = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? pageH : 1
  return { dx: e.deltaX * k, dy: e.deltaY * k }
}

/** How much a zooming wheel changes the visible height: one notch of a mouse wheel is capped, so it is one clear step. */
export const wheelZoom = (dy: number) => Math.exp(Math.max(-60, Math.min(60, dy)) * 0.01)

/**
 * The screen offset (px) a moving wheel drags the view by: scrolling down moves the diagram up, like a page.
 * Shift + a mouse wheel scrolls sideways where the system has not already turned it into deltaX.
 */
export function wheelPan(dx: number, dy: number, shift: boolean): [number, number] {
  return shift && dx === 0 ? [-dy, 0] : [-dx, -dy]
}

/** A turning wheel (3D, Shift): sideways turns, up and down tilts. [yaw, pitch] in radians. */
export const wheelTurn = (dx: number, dy: number): [number, number] => [-dx * TURN_PER_PX, dy * TURN_PER_PX]

/** Two touches on a screen: their middle, how far apart they are and the angle between them. */
export interface Pair { x: number; y: number; d: number; a: number }
export function pairOf(p: { x: number; y: number }, q: { x: number; y: number }): Pair {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, d: Math.hypot(q.x - p.x, q.y - p.y), a: Math.atan2(q.y - p.y, q.x - p.x) }
}

/**
 * Two fingers moving from `last` to `now`: a pinch zooms (`zoom`, the factor on the visible height), a twist
 * turns (`yaw`), the middle moves the view (`pan`, px); in 3D, moving up and down tilts (`pitch`) instead of moving.
 */
export function twoFingers(last: Pair, now: Pair, mode: Mode): { zoom: number; yaw: number; pitch: number; pan: [number, number] } {
  let da = now.a - last.a
  if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI
  const tilt = mode === '3d'
  return {
    zoom: now.d > 0 ? last.d / now.d : 1,
    yaw: -da,
    pitch: tilt ? (now.y - last.y) * TURN_PER_PX : 0,
    pan: [now.x - last.x, tilt ? 0 : now.y - last.y],
  }
}

/** The input the reader last used, which the gesture card lists gestures for. */
export type Input = 'trackpad' | 'mouse' | 'touch'

/** Which input a wheel event came from: a mouse wheel moves in lines, or in big whole steps with no sideways part. */
export function wheelInput(e: { deltaMode: number; deltaX: number; deltaY: number; ctrlKey: boolean }): 'trackpad' | 'mouse' {
  if (e.deltaMode !== 0) return 'mouse'
  if (e.ctrlKey || e.deltaX !== 0) return 'trackpad'
  return Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50 ? 'mouse' : 'trackpad'
}

/** A wheel event that is a trackpad pinch: ctrlKey without ⌘, in small steps (Ctrl + a mouse wheel moves in big whole steps). */
export const isPinch = (e: { ctrlKey: boolean; metaKey: boolean; deltaMode: number; deltaY: number }) =>
  e.ctrlKey && !e.metaKey && e.deltaMode === 0 && !(Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50)

/** The input to assume before the reader uses one: a touch screen, else a trackpad on a Mac, else a mouse. */
export function guessInput(coarse: boolean, platform: string): Input {
  return coarse ? 'touch' : isMac(platform) ? 'trackpad' : 'mouse'
}

const isMac = (platform: string) => /Mac|iPhone|iPad/.test(platform)
/** The zoom key's name on this platform: ⌘ on a Mac, Ctrl elsewhere. */
export const modKey = (platform: string) => isMac(platform) ? '⌘' : 'Ctrl'

/** The gesture card's rows for an input and a view: [gesture, what it does]. `mod` is the zoom key's name (⌘ or Ctrl). */
export function gestureRows(input: Input, mode: Mode, mod: string): [string, string][] {
  const turn = mode === '3d' ? 'Turn and tilt' : mode === 'iso' ? 'Turn to another corner' : 'Turn (settles square)'
  if (mode === '3d' && input === 'trackpad') return [['Drag', turn], ['Two-finger drag', 'Move'], ['Pinch', 'Zoom'], ['⇧ Shift + drag', 'Move'], ['⇧ Shift + two-finger drag', turn]]
  if (mode === '3d' && input === 'mouse') return [['Drag', turn], ['Scroll wheel', 'Move up and down'], [`${mod} + scroll`, 'Zoom'], ['⇧ Shift + drag, or right-drag', 'Move'], ['⇧ Shift + scroll', 'Turn']]
  if (input === 'trackpad') return [['Two-finger drag', 'Move'], ['Pinch', 'Zoom'], ['Drag the background', 'Move'], ['⇧ Shift + drag', turn]]
  if (input === 'mouse') return [['Drag the background', 'Move'], ['Scroll wheel', 'Move up and down (⇧ for sideways)'], [`${mod} + scroll`, 'Zoom'], ['⇧ Shift + drag, or right-drag', turn]]
  return [['One finger', 'Move'], ['Pinch', 'Zoom'], ['Two-finger twist', turn], ...(mode === '3d' ? [['Two fingers up or down', 'Tilt'] as [string, string]] : [])]
}

/** What the hint over a diagram in a page that scrolls says. */
export function hintText(input: Input, zoom: boolean, mod: string): string {
  if (input === 'touch') return 'Tap, or use two fingers, to move the diagram'
  return `Click to move the diagram${zoom ? ` · ${mod} + scroll to zoom` : ''}`
}

/** [top-left, top-right, bottom-right, bottom-left] corner radii, px. */
export type Radii = [number, number, number, number]
interface Rect { left: number; top: number; right: number; bottom: number }
/**
 * The held ring's corners: the clipping box's corner radii, less how far the diagram's corner sits inside the box.
 * A diagram flush with a rounded card gets the card's corners; one set well inside it, square ones.
 */
export function insetRadii(r: Radii, me: Rect, box: Rect): Radii {
  const l = me.left - box.left, t = me.top - box.top, rt = box.right - me.right, bt = box.bottom - me.bottom
  return [Math.max(0, r[0] - Math.max(l, t)), Math.max(0, r[1] - Math.max(rt, t)), Math.max(0, r[2] - Math.max(rt, bt)), Math.max(0, r[3] - Math.max(l, bt))]
}

/** Where the "Esc to let go" chip sits ([left, top], px): 10px in, and further on a big rounded corner so the curve never clips it. */
export function chipAt(r: Radii): [number, number] {
  return [Math.max(10, Math.ceil(Math.max(r[0], r[3]) * 0.3) + 4), Math.max(10, Math.ceil(Math.max(r[0], r[1]) * 0.3) + 4)]
}

export type Pickable = 'node' | 'group' | 'participant'
export type Cursor = 'grab' | 'zoom-in' | 'pointer' | ''

/** The cursor over a node, group or participant. `''` leaves the default. */
export function cursorFor(kind: Pickable, controls: ResolvedControls, hasClick: boolean): Cursor {
  if (kind === 'node' && controls.move) return 'grab'
  if (kind === 'group' && controls.drillIn) return 'zoom-in'
  return hasClick ? 'pointer' : ''
}

export type Gesture = 'zoom' | 'pan' | 'turn' | 'move'
/** How a gesture arrived: a wheel event, a trackpad pinch (a wheel with ctrlKey), a pointer drag, or fingers on a touch screen. */
export type Via = 'wheel' | 'pinch' | 'drag' | 'touch'
export type HoldHow = 'click' | 'touch' | 'esc' | 'outside'
export type HelpHow = 'button' | 'esc' | 'close'

/** One-off spans for what a reader sees or does: the hint over a page-scrolling diagram, taking or letting go of it, the gesture card, Fit. */
export const hintShown = (input: Input, mode: Mode) => instant('bonkei.control.hint', { 'bonkei.input': input, 'bonkei.mode': mode })
export const holdChanged = (held: boolean, how: HoldHow, mode: Mode) => instant('bonkei.control.hold', { 'bonkei.hold': held ? 'taken' : 'let_go', 'bonkei.hold.how': how, 'bonkei.mode': mode })
export const helpToggled = (open: boolean, how: HelpHow, input: Input, mode: Mode) => instant('bonkei.help', { 'bonkei.help': open ? 'open' : 'close', 'bonkei.help.how': how, 'bonkei.input': input, 'bonkei.mode': mode })
export const fitUsed = (mode: Mode) => instant('bonkei.fit', { 'bonkei.mode': mode })

export interface GestureSpan {
  /** The gesture is going on: the first call opens the span, later ones keep it open. */
  touch(): void
  /** The gesture is over: ends the span, if one is open. */
  end(): void
}

export interface GestureOpts {
  /** End the span on its own once `touch` has not been called for this long (wheel gestures arrive as many events). */
  idleMs?: number
  /** How it arrived. Default `wheel`. */
  via?: Via
  /** The view, read when the span opens. */
  mode?: () => Mode
  /** Reached with Shift or the secondary button. Default false. */
  swapped?: boolean
}

/**
 * One `bonkei.control` span per gesture, with `bonkei.control` (zoom, pan, turn, move), `bonkei.control.via`,
 * `bonkei.control.swapped` and `bonkei.mode`. With `idleMs` the span ends on its own; without it the caller
 * ends it (drags end on pointer up, two-finger gestures when a finger lifts).
 */
export function gesture(control: Gesture, { idleMs, via = 'wheel', mode, swapped = false }: GestureOpts = {}): GestureSpan {
  let span: Span | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const end = () => {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    if (span) { span.end(); span = null }
  }
  return {
    touch() {
      if (!span) span = tracer.startSpan('bonkei.control', { attributes: { 'bonkei.control': control, 'bonkei.control.via': via, 'bonkei.control.swapped': swapped, ...(mode ? { 'bonkei.mode': mode() } : {}) } })
      if (idleMs !== undefined) {
        if (timer !== undefined) clearTimeout(timer)
        timer = setTimeout(end, idleMs)
      }
    },
    end,
  }
}

/** Wheel gestures end after this long without a wheel event. */
export const WHEEL_IDLE_MS = 300

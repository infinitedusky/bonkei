// What the reader's controls allow, as pure decisions SceneView asks for. No React and no .tsx
// imports, so node can test it. Decisions: LOG.md, "The Bonkei component and render() (BON-51)".
import type { Span } from '@opentelemetry/api'
import type { Mode } from './camera.ts'
import type { ResolvedControls } from './options.ts'
import { tracer } from './telemetry.ts'

export const ALL_ON: Readonly<ResolvedControls> = Object.freeze({ zoom: true, pan: true, move: true, drillIn: true })

/**
 * A wheel over the scene (BON-78). Pinch on a trackpad arrives as a wheel with ctrlKey, so pinch and
 * cmd/ctrl + wheel zoom. A plain wheel or a two-finger drag moves the view, but only once the diagram
 * has the gestures (`engaged`): a diagram in a page that scrolls lets the page scroll and asks for a
 * hint instead, until it is clicked.
 */
export function wheelAction(controls: ResolvedControls, e: { ctrlKey: boolean; metaKey: boolean }, engaged: boolean): 'zoom' | 'pan' | 'hint' | 'pass' {
  if (e.ctrlKey || e.metaKey) return controls.zoom ? 'zoom' : 'pass'
  if (!controls.pan) return 'pass'
  return engaged ? 'pan' : 'hint'
}

/** A drag on the ground: pan, or turn with Shift or the secondary button; nothing when `pan` is off. Every view alike. */
export function dragAction(controls: ResolvedControls, button: number, shift: boolean): 'pan' | 'turn' | 'none' {
  if (!controls.pan) return 'none'
  return button === 2 || shift ? 'turn' : 'pan'
}

/** The yaw a turn settles on when let go: flat and iso snap to the nearest quarter turn from their own heading; 3D stays where it was left. */
export function settleYaw(mode: Mode, yaw: number, base: number): number {
  if (mode === '3d') return yaw
  const q = Math.PI / 2
  return base + Math.round((yaw - base) / q) * q
}

/** Which input the reader last used, from a wheel event: a mouse wheel moves in whole lines or big integer steps with no sideways part. */
export type Input = 'trackpad' | 'mouse' | 'touch'
export function wheelInput(e: { deltaMode: number; deltaX: number; deltaY: number; ctrlKey: boolean }): 'trackpad' | 'mouse' {
  if (e.deltaMode !== 0) return 'mouse'
  if (e.ctrlKey || e.deltaX !== 0) return 'trackpad'
  return Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50 ? 'mouse' : 'trackpad'
}

/** The gesture card's rows for an input and a view: [gesture, what it does]. `mod` is the zoom key's name (⌘ or Ctrl). */
export function gestureRows(input: Input, mode: Mode, mod: string): [string, string][] {
  const turn = mode === '3d' ? 'Turn and tilt' : mode === 'iso' ? 'Turn to another corner' : 'Turn (settles square)'
  if (input === 'trackpad') return [['Two-finger drag', 'Move'], ['Pinch', 'Zoom'], ['Drag the background', 'Move'], ['⇧ Shift + drag', turn]]
  if (input === 'mouse') return [['Drag the background', 'Move'], ['Scroll wheel', 'Move up and down (⇧ for sideways)'], [`${mod} + scroll`, 'Zoom'], ['⇧ Shift + drag, or right-drag', turn]]
  return [['One finger', 'Move'], ['Pinch', 'Zoom'], ['Two-finger twist', turn], ...(mode === '3d' ? [['Two fingers up or down', 'Tilt'] as [string, string]] : [])]
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

export interface GestureSpan {
  /** The gesture is going on: the first call opens the span, later ones keep it open. */
  touch(): void
  /** The gesture is over: ends the span, if one is open. */
  end(): void
}

/**
 * One `bonkei.control` span per gesture, attribute `bonkei.control`. With `idleMs` the span ends
 * on its own once `touch` has not been called for that long (wheel zooms arrive as many events);
 * without it the caller ends it (pan, turn and move end on pointer up).
 */
export function gesture(control: Gesture, idleMs?: number): GestureSpan {
  let span: Span | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const end = () => {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    if (span) { span.end(); span = null }
  }
  return {
    touch() {
      if (!span) span = tracer.startSpan('bonkei.control', { attributes: { 'bonkei.control': control } })
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

// What the reader's controls allow, as pure decisions SceneView asks for. No React and no .tsx
// imports, so node can test it. Decisions: LOG.md, "The Bonkei component and render() (BON-51)".
import type { Span } from '@opentelemetry/api'
import type { Mode } from './camera.ts'
import type { ResolvedControls } from './options.ts'
import { tracer } from './telemetry.ts'

export const ALL_ON: Readonly<ResolvedControls> = Object.freeze({ zoom: true, pan: true, move: true, drillIn: true })

/** A wheel over the scene zooms, or is left alone so the page scrolls. */
export function wheelAction(controls: ResolvedControls): 'zoom' | 'pass' {
  return controls.zoom ? 'zoom' : 'pass'
}

/** A drag on the ground: orbit (3D, primary button), pan, or nothing when `pan` is off. */
export function dragAction(controls: ResolvedControls, mode: Mode, button: number): 'pan' | 'orbit' | 'none' {
  if (!controls.pan) return 'none'
  return mode === '3d' && button === 0 ? 'orbit' : 'pan'
}

export type Pickable = 'node' | 'group' | 'participant'
export type Cursor = 'grab' | 'zoom-in' | 'pointer' | ''

/** The cursor over a node, group or participant. `''` leaves the default. */
export function cursorFor(kind: Pickable, controls: ResolvedControls, hasClick: boolean): Cursor {
  if (kind === 'node' && controls.move) return 'grab'
  if (kind === 'group' && controls.drillIn) return 'zoom-in'
  return hasClick ? 'pointer' : ''
}

export type Gesture = 'zoom' | 'pan' | 'orbit' | 'move'

export interface GestureSpan {
  /** The gesture is going on: the first call opens the span, later ones keep it open. */
  touch(): void
  /** The gesture is over: ends the span, if one is open. */
  end(): void
}

/**
 * One `bonkei.control` span per gesture, attribute `bonkei.control`. With `idleMs` the span ends
 * on its own once `touch` has not been called for that long (wheel zooms arrive as many events);
 * without it the caller ends it (pan, orbit and move end on pointer up).
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

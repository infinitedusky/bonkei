import { S } from './scale.ts'

/** The part of a layout the camera needs to keep a view across layouts (flow and sequence alike). */
export interface Frame {
  width: number; height: number
  boxes: { id: string; kind: 'node' | 'group'; x: number; y: number; w: number; h: number; parent?: string }[]
}
/** What a re-layout did to the view, for telemetry. */
export interface Kept {
  anchor: 'node' | 'tray' | 'origin'
  tray: 'none' | 'found' | 'parent' | 'diagram'
  shiftX: number; shiftZ: number
}

export type Mode = 'flat' | 'iso' | '3d'
const D = Math.PI / 180
// One perspective camera for every view. "Flat" and "iso" use a ~1deg fov (visually orthographic,
// distance is compensated so the framing is identical); 3D opens the fov. Animating fov while
// holding the framing at the target = dolly-zoom, which gives a continuous ortho <-> perspective morph.
export const PRESET = Object.freeze({
  flat: Object.freeze({ yaw: 0, pitch: 89.9 * D, fov: 1 }),
  iso: Object.freeze({ yaw: 45 * D, pitch: Math.atan(1 / Math.SQRT2), fov: 1 }),
  '3d': Object.freeze({ yaw: 25 * D, pitch: 38 * D, fov: 45 }),
})
export interface Pose { tx: number; tz: number; H: number; yaw: number; pitch: number; fov: number }
export interface Camera {
  mode: Mode
  /** Where the camera is heading; the render loop tweens `cur` towards it. */
  goal: Pose
  cur: Pose
  focus: { cx: number; cz: number; X: number; Z: number }
  /** The tray `focus` frames, when the reader flew into one; undefined = the whole diagram. */
  focusId?: string
  /** The layout last shown; undefined until the first draw. */
  layout?: Frame
  /** Layouts absorbed since the last fit. */
  edits: number
  aspect: number
  setMode(m: Mode): void
  focusOn(cx: number, cz: number, X: number, Z: number, id?: string): void
  /** A new layout after the first: keep the view where it is (compensating for the diagram's middle moving). */
  relayout(next: Frame): Kept
  /** Remember the first layout. */
  adopt(first: Frame): void
  fitH(m: Mode): number
  /** Frame the whole diagram (layout px, centred on the origin), in the current mode. */
  fit(width: number, height: number): void
  /** Jump `cur` to `goal` now, skipping the tween. */
  snap(): void
  /** @internal the next mode switch should centre on `focus` */
  refocus: boolean
}

/** A camera state for one diagram view. Starts in iso, H 30. */
export function createCamera(): Camera {
  const cam: Camera = {
    mode: 'iso',
    goal: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    cur: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    focus: { cx: 0, cz: 0, X: 20, Z: 20 },
    aspect: 1.6,
    edits: 0,
    refocus: false,
    fitH(mode) {
      const { X, Z } = cam.focus
      if (mode === 'flat') return Math.max(Z, X / cam.aspect) * 1.12
      const diag = Math.hypot(X, Z)
      return Math.max(diag * Math.sin(PRESET[mode].pitch) + 2, (diag / cam.aspect) * 0.8) * (mode === '3d' ? 1.15 : 0.95)
    },
    setMode(m) {
      cam.mode = m
      Object.assign(cam.goal, PRESET[m])
      if (cam.refocus) { cam.goal.tx = cam.focus.cx; cam.goal.tz = cam.focus.cz; cam.refocus = false }
      cam.goal.H = cam.fitH(m)
    },
    adopt(first) { cam.layout = first; cam.edits = 0 },
    relayout(next) {
      const prev = cam.layout
      cam.layout = next
      cam.edits++
      if (!prev) return { anchor: 'origin', tray: 'none', shiftX: 0, shiftZ: 0 }
      const wx = (f: Frame, b: { x: number; w: number }) => (b.x + b.w / 2 - f.width / 2) * S
      const wz = (f: Frame, b: { y: number; h: number }) => (b.y + b.h / 2 - f.height / 2) * S
      // anchor: the node (else tray) nearest the view centre that is still in the new layout
      const nextById = new Map(next.boxes.map(b => [b.id, b]))
      let best: { p: Frame['boxes'][number]; n: Frame['boxes'][number]; d: number } | undefined
      for (const p of prev.boxes) {
        const n = nextById.get(p.id)
        if (!n || n.kind !== p.kind) continue
        const d = Math.hypot(wx(prev, p) - cam.goal.tx, wz(prev, p) - cam.goal.tz) + (p.kind === 'group' ? 1e6 : 0)
        if (!best || d < best.d) best = { p, n, d }
      }
      let shiftX: number, shiftZ: number, anchor: Kept['anchor']
      if (best) {
        shiftX = wx(next, best.n) - wx(prev, best.p); shiftZ = wz(next, best.n) - wz(prev, best.p)
        anchor = best.p.kind === 'group' ? 'tray' : 'node'
      } else { shiftX = (prev.width - next.width) / 2 * S; shiftZ = (prev.height - next.height) / 2 * S; anchor = 'origin' }
      for (const pose of [cam.goal, cam.cur]) { pose.tx += shiftX; pose.tz += shiftZ }
      // the tray the reader is in: find it again, else the nearest enclosing one still there, else the whole diagram
      let tray: Kept['tray'] = 'none'
      if (cam.focusId) {
        const prevById = new Map(prev.boxes.map(b => [b.id, b]))
        let id: string | undefined = cam.focusId
        tray = 'found'
        while (id && !nextById.has(id)) { id = prevById.get(id)?.parent; tray = 'parent' }
        const b = id ? nextById.get(id) : undefined
        if (b) { cam.focusId = id; cam.focus = { cx: wx(next, b), cz: wz(next, b), X: b.w * S, Z: b.h * S } }
        else { cam.focusId = undefined; tray = 'diagram' }
      }
      if (!cam.focusId) cam.focus = { cx: 0, cz: 0, X: next.width * S, Z: next.height * S }
      cam.refocus = true // the next mode switch frames the (updated) focus, not the stale pan
      return { anchor, tray, shiftX, shiftZ }
    },
    focusOn(cx, cz, X, Z, id) {
      cam.focus = { cx, cz, X, Z }
      cam.focusId = id
      cam.refocus = false
      cam.goal.tx = cx; cam.goal.tz = cz; cam.goal.H = cam.fitH(cam.mode)
    },
    fit(width, height) {
      cam.edits = 0
      cam.focusOn(0, 0, width * S, height * S)
    },
    snap() {
      Object.assign(cam.cur, cam.goal)
    },
  }
  return cam
}

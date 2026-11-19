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

/** The camera mode: flat, iso or 3d. */
export type Mode = 'flat' | 'iso' | '3d'
const D = Math.PI / 180
// One perspective camera for every view. "Flat" and "iso" use a ~1deg fov (visually orthographic,
// distance is compensated so the framing is identical); 3D opens the fov. Animating fov while
// holding the framing at the target = dolly-zoom, which gives a continuous ortho <-> perspective morph.
const LABEL_WORLD = 0.36 // a node label's height in world units
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
  /** Frame the diagram's real projected extent with a small margin, instead of the conservative default. Off by default. */
  tight: boolean
  /** Smallest on-screen size (px) a node label may open at; 0 = off. When the whole diagram would make labels smaller, the view opens zoomed in instead. */
  minLabel: number
  /** Frame height in px (set by the render loop), used with minLabel. */
  frameH: number
  /** Show the whole diagram even with minLabel set (the Fit control); cleared by the next frame()/resize. */
  whole: boolean
  /** What a tight fit frames: the diagram's top-level boxes in world units (centred diagram). Empty: its rectangle. */
  content: Rect[]
  setMode(m: Mode): void
  focusOn(cx: number, cz: number, X: number, Z: number, id?: string): void
  /** A new layout after the first: keep the view where it is (compensating for the diagram's middle moving). */
  relayout(next: Frame): Kept
  /** Remember the first layout. */
  adopt(first: Frame): void
  fitH(m: Mode): number
  fitHWhole(m: Mode): number
  /** Frame the whole diagram (layout px, centred on the origin), in the current mode; `at` centres it on a point instead. */
  fit(width: number, height: number, at?: { cx: number; cz: number }): void
  /** Turn back to the view's own heading and tilt (the Fit control, BON-78), the short way round. */
  square(): void
  /** Jump `cur` to `goal` now, skipping the tween. */
  snap(): void
}

/** `to` plus whole turns, as close as can be to `from`: the heading `from` reaches by turning the short way to `to`. */
export function nearestTurn(from: number, to: number): number {
  return to + Math.round((from - to) / (2 * Math.PI)) * 2 * Math.PI
}

/** A camera state for one diagram view. Starts in iso, H 30. */
export function createCamera(): Camera {
  // the view frames the whole diagram (fit without `at`), not a tray flown into or a point
  let onWhole = false
  // a re-layout moved or replaced the tray flown into: the next mode switch centres on `focus` again, not on the old pan
  let refocus = false
  // a tight fit of the whole diagram with its boxes known: frame what the view really shows
  const onContent = (mode: Mode) => (cam.tight && onWhole && cam.content.length ? projectedFit(cam.content, mode, cam.aspect) : null)
  const cam: Camera = {
    mode: 'iso',
    goal: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    cur: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    focus: { cx: 0, cz: 0, X: 20, Z: 20 },
    aspect: 1.6,
    edits: 0,
    tight: false,
    minLabel: 0,
    frameH: 0,
    whole: false,
    content: [],
    fitH(mode) {
      const h = cam.fitHWhole(mode)
      // labels are 0.36 world units tall (shapes.tsx): at least minLabel px means at most frameH / (minLabel / 0.36) world units on screen
      return cam.minLabel > 0 && cam.frameH > 0 && !cam.whole ? Math.min(h, (cam.frameH * LABEL_WORLD) / cam.minLabel) : h
    },
    fitHWhole(mode) {
      const { X, Z } = cam.focus
      const proj = onContent(mode)
      if (proj) return proj.H * (mode === '3d' ? 1.15 : 1)
      if (cam.tight) {
        // the diagram's rectangle turned by the view's yaw and squashed by its pitch (a node's height adds a little), plus a margin of 1.2 world units
        const { yaw, pitch } = PRESET[mode]
        const hx = (X * Math.abs(Math.cos(yaw)) + Z * Math.abs(Math.sin(yaw))) / 2
        const hz = (X * Math.abs(Math.sin(yaw)) + Z * Math.abs(Math.cos(yaw))) / 2
        const hy = hz * Math.sin(pitch) + 0.5 * Math.cos(pitch)
        return Math.max(2 * hy + 1.2, (2 * hx) / cam.aspect + 1.2) * (mode === '3d' ? 1.15 : 1)
      }
      if (mode === 'flat') return Math.max(Z, X / cam.aspect) * 1.12
      const diag = Math.hypot(X, Z)
      return Math.max(diag * Math.sin(PRESET[mode].pitch) + 2, (diag / cam.aspect) * 0.8) * (mode === '3d' ? 1.15 : 0.95)
    },
    setMode(m) {
      cam.mode = m
      // a reader may have turned the view round several times: head for the new view's yaw the short way
      Object.assign(cam.goal, PRESET[m], { yaw: nearestTurn(cam.goal.yaw, PRESET[m].yaw) })
      // after a re-layout, the tray the reader is in (or the whole diagram) is framed afresh
      if (refocus) { cam.goal.tx = cam.focus.cx; cam.goal.tz = cam.focus.cz; refocus = false }
      // a tight fit on the whole diagram centres what the new view actually shows
      const proj = onContent(m)
      if (proj) { cam.goal.tx = proj.tx; cam.goal.tz = proj.tz }
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
      // Anchor: what the reader is looking at that is still there. Only something on screen counts (a far-off survivor would
      // drag the camera after it): the node whose middle is nearest the view's centre, else the smallest tray the centre is in or near.
      const nextById = new Map(next.boxes.map(b => [b.id, b]))
      const onScreen = (cam.goal.H * Math.max(cam.aspect, 1)) / 2
      const { tx, tz } = cam.goal
      let best: { p: Frame['boxes'][number]; n: Frame['boxes'][number]; d: number; area: number } | undefined
      for (const p of prev.boxes) {
        const n = nextById.get(p.id)
        if (!n || n.kind !== p.kind) continue
        let d: number
        if (p.kind === 'node') d = Math.hypot(wx(prev, p) - tx, wz(prev, p) - tz)
        else { // distance from the view's centre to the tray's rectangle: 0 inside it
          const ex = Math.max(0, Math.abs(wx(prev, p) - tx) - (p.w * S) / 2), ez = Math.max(0, Math.abs(wz(prev, p) - tz) - (p.h * S) / 2)
          d = Math.hypot(ex, ez)
        }
        if (d > onScreen) continue
        const area = p.w * p.h
        const better = !best ? true
          : p.kind !== best.p.kind ? p.kind === 'node'
          : p.kind === 'node' ? d < best.d : d < best.d || (d === best.d && area < best.area)
        if (better) best = { p, n, d, area }
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
        else { cam.focusId = undefined; tray = 'diagram'; onWhole = true }
        refocus = true // the next mode switch frames the (updated) focus, not the stale pan
      }
      if (!cam.focusId) {
        // the whole diagram, or a point it was opened on (minLabel): same size rule, the point moves with the anchor
        cam.focus = { cx: onWhole || tray === 'diagram' ? 0 : cam.focus.cx + shiftX, cz: onWhole || tray === 'diagram' ? 0 : cam.focus.cz + shiftZ, X: next.width * S, Z: next.height * S }
      }
      return { anchor, tray, shiftX, shiftZ }
    },
    focusOn(cx, cz, X, Z, id) {
      onWhole = false
      cam.focus = { cx, cz, X, Z }
      cam.focusId = id
      refocus = false
      cam.goal.tx = cx; cam.goal.tz = cz; cam.goal.H = cam.fitH(cam.mode)
    },
    fit(width, height, at) {
      cam.edits = 0
      cam.focusOn(at?.cx ?? 0, at?.cz ?? 0, width * S, height * S)
      onWhole = !at
      const proj = onContent(cam.mode)
      if (proj) { cam.goal.tx = proj.tx; cam.goal.tz = proj.tz; cam.goal.H = cam.fitH(cam.mode) }
    },
    square() {
      cam.goal.yaw = nearestTurn(cam.goal.yaw, PRESET[cam.mode].yaw)
      cam.goal.pitch = PRESET[cam.mode].pitch
    },
    snap() {
      Object.assign(cam.cur, cam.goal)
    },
  }
  return cam
}

/** Where the largest top-level tray is, in world units (centred diagram), for opening a zoomed-in view on it; the middle when there is none. */
export function biggestTray(boxes: { kind: string; level: number; x: number; y: number; w: number; h: number }[], width: number, height: number) {
  let best: (typeof boxes)[number] | undefined
  for (const b of boxes) if (b.kind === 'group' && b.level === 0 && (!best || b.w * b.h > best.w * best.h)) best = b
  return best ? { cx: (best.x + best.w / 2 - width / 2) * S, cz: (best.y + best.h / 2 - height / 2) * S } : { cx: 0, cz: 0 }
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }
const TOP = 1.6 // the tallest thing standing on a box (a landscape form on its plinth), world units
const MARGIN = 0.6 // world units left free on each side by a tight fit

/**
 * A tight framing of boxes in one view: their corners (on the ground and TOP above it) projected on the screen's axes, the
 * visible height H that holds them with a margin, and the ground point (tx, tz) the camera looks at to centre them.
 * Screen right is (cos yaw, 0, -sin yaw); screen up is (-sin yaw sin pitch, cos pitch, -cos yaw sin pitch).
 */
export function projectedFit(rects: Rect[], mode: Mode, aspect: number) {
  const { yaw, pitch } = PRESET[mode]
  const cy = Math.cos(yaw), sy = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const r of rects) for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) for (const y of [0, TOP]) {
    const u = x * cy - z * sy, v = -(x * sy + z * cy) * sp + y * cp
    x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v)
  }
  const H = Math.max(y1 - y0 + 2 * MARGIN, (x1 - x0 + 2 * MARGIN) / aspect)
  // the ground point that projects to the middle of the box: its screen x is a, and its screen y is -b sin(pitch)
  const a = (x0 + x1) / 2, b = -((y0 + y1) / 2) / sp
  return { H, tx: a * cy + b * sy, tz: -a * sy + b * cy }
}

/** The top-level boxes of a laid-out diagram, in world units about its centre: what a tight fit frames. */
export function contentOf(boxes: { level: number; x: number; y: number; w: number; h: number }[], width: number, height: number): Rect[] {
  return boxes.filter(b => b.level === 0).map(b => ({ x0: (b.x - width / 2) * S, z0: (b.y - height / 2) * S, x1: (b.x + b.w - width / 2) * S, z1: (b.y + b.h - height / 2) * S }))
}

/**
 * What the camera keeps of a layout between draws: its size and its boxes (a flow diagram's nodes and trays, a sequence
 * diagram's participants), so a new layout can be lined up with the last one.
 */
export function frameOf(data: { width: number; height: number; boxes?: Frame['boxes']; parts?: { id: string; x: number; y: number; w: number; h: number }[] }): Frame {
  const boxes = data.boxes ?? (data.parts ?? []).map(p => ({ id: p.id, kind: 'node' as const, x: p.x, y: p.y, w: p.w, h: p.h }))
  return { width: data.width, height: data.height, boxes }
}

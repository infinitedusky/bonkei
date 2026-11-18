import { S } from './scale.ts'

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
  focusOn(cx: number, cz: number, X: number, Z: number): void
  fitH(m: Mode): number
  fitHWhole(m: Mode): number
  /** Frame the whole diagram (layout px, centred on the origin), in the current mode; `at` centres it on a point instead. */
  fit(width: number, height: number, at?: { cx: number; cz: number }): void
  /** Jump `cur` to `goal` now, skipping the tween. */
  snap(): void
}

/** A camera state for one diagram view. Starts in iso, H 30. */
export function createCamera(): Camera {
  // the view frames the whole diagram (fit without `at`), not a tray flown into or a point
  let onWhole = false
  // a tight fit of the whole diagram with its boxes known: frame what the view really shows
  const onContent = (mode: Mode) => (cam.tight && onWhole && cam.content.length ? projectedFit(cam.content, mode, cam.aspect) : null)
  const cam: Camera = {
    mode: 'iso',
    goal: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    cur: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    focus: { cx: 0, cz: 0, X: 20, Z: 20 },
    aspect: 1.6,
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
      Object.assign(cam.goal, PRESET[m])
      // a tight fit on the whole diagram centres what the new view actually shows
      const proj = onContent(m)
      if (proj) { cam.goal.tx = proj.tx; cam.goal.tz = proj.tz }
      cam.goal.H = cam.fitH(m)
    },
    focusOn(cx, cz, X, Z) {
      onWhole = false
      cam.focus = { cx, cz, X, Z }
      cam.goal.tx = cx; cam.goal.tz = cz; cam.goal.H = cam.fitH(cam.mode)
    },
    fit(width, height, at) {
      cam.focusOn(at?.cx ?? 0, at?.cz ?? 0, width * S, height * S)
      onWhole = !at
      const proj = onContent(cam.mode)
      if (proj) { cam.goal.tx = proj.tx; cam.goal.tz = proj.tz; cam.goal.H = cam.fitH(cam.mode) }
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

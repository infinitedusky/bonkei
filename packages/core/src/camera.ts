import { S } from './scale.ts'

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
  aspect: number
  /** Frame the diagram's real projected extent with a small margin, instead of the conservative default. Off by default. */
  tight: boolean
  setMode(m: Mode): void
  focusOn(cx: number, cz: number, X: number, Z: number): void
  fitH(m: Mode): number
  /** Frame the whole diagram (layout px, centred on the origin), in the current mode. */
  fit(width: number, height: number): void
  /** Jump `cur` to `goal` now, skipping the tween. */
  snap(): void
}

/** A camera state for one diagram view. Starts in iso, H 30. */
export function createCamera(): Camera {
  const cam: Camera = {
    mode: 'iso',
    goal: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    cur: { tx: 0, tz: 0, H: 30, ...PRESET.iso },
    focus: { cx: 0, cz: 0, X: 20, Z: 20 },
    aspect: 1.6,
    tight: false,
    fitH(mode) {
      const { X, Z } = cam.focus
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
      cam.goal.H = cam.fitH(m)
    },
    focusOn(cx, cz, X, Z) {
      cam.focus = { cx, cz, X, Z }
      cam.goal.tx = cx; cam.goal.tz = cz; cam.goal.H = cam.fitH(cam.mode)
    },
    fit(width, height) {
      cam.focusOn(0, 0, width * S, height * S)
    },
    snap() {
      Object.assign(cam.cur, cam.goal)
    },
  }
  return cam
}

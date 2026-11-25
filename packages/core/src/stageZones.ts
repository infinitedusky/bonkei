// How a stage's parts are named (BON-253): each name written on the part's own sides, else floating over it; and the model's own floor
// grown to keep an even padding round everything on it. Plain numbers, no React and no three.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import { groundWidth } from './titles.ts'
import { S } from './scale.ts'
import type { PartBody, StageModel, StagePart } from './stage.ts'
import type { Upright } from './camera.ts'

/** The padding the model's own floor keeps round everything standing on it, world units: where something stands nearer an edge (or over it), the floor is grown to this, evenly. */
export const FLOOR_PAD = 0.6
/**
 * A name goes on the part's own side faces (the front, facing the iso and 3D views, and the back, so it reads turned): capitals of one
 * size for every part, in one line or two, on the part's body (its mesh of the largest volume: the grill's counter, not the hood over
 * it), `off` from the surface, if the face is wide and tall enough for it. It is never drawn smaller: if it does not fit, it floats.
 */
export const SIDE = { size: 0.32, pad: 0.15, off: 0.012 }
/**
 * A floating name's column of capitals, one under another (StageScene), as the approved prototype draws it, world units over the part's
 * top: its letter size (0.36, a little smaller for a long name so the column stays about 4 tall: TELEPHONE POLE), the top of the line
 * down to the part (`line`), and the frame the column stands in, facing the camera: from `foot`, `h` tall (the letters in its middle,
 * 0.15 to spare at each end for their gentle bob).
 */
export function floatColumn(label: string) {
  const n = [...label.trim()].length, size = Math.min(0.36, 4 / Math.max(n, 1))
  return { size, line: 1, foot: 1.3, h: n * size + 0.3 }
}
/** How high a floating name reaches over its part's top, world units. */
export const floatRoom = (label: string) => { const c = floatColumn(label); return c.foot + c.h }

export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** A name written on the part's own front and back faces. */
export interface SideName {
  lines: string[]; size: number // the capitals, in one line or two, and their letter size
  faces: { at: [number, number, number]; rot: number }[] // the two faces it is written on (model coordinates, the text's middle, just off the surface, and the turn about the vertical)
}

// The words of a name in capitals, in one to three lines that each fit `room` at `size`, the longest line as short as it can be; null: they do not fit.
export function wrapTo(label: string, size: number, room: number): string[] | null {
  const words = label.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  const best = (ws: string[], k: number): string[] | null => {
    if (k === 1) return [ws.join(' ')]
    let out: string[] | null = null, longest = Infinity
    for (let i = 1; i <= ws.length - k + 1; i++) {
      const rest = best(ws.slice(i), k - 1)
      if (!rest) continue
      const ls = [ws.slice(0, i).join(' '), ...rest], m = Math.max(...ls.map(l => l.length))
      if (m < longest) { out = ls; longest = m }
    }
    return out
  }
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const ls = best(words, n)
    if (ls && ls.every(l => groundWidth(l, size) <= room)) return ls
  }
  return null
}

const grow = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) })
const inside = (a: Rect, b: Rect) => a.x0 >= b.x0 - 1e-6 && a.x1 <= b.x1 + 1e-6 && a.z0 >= b.z0 - 1e-6 && a.z1 <= b.z1 + 1e-6
/** A part's footprint, world units. */
export const footprint = (p: StagePart): Rect => ({ x0: p.cx - (p.w * S) / 2, x1: p.cx + (p.w * S) / 2, z0: p.cz - (p.h * S) / 2, z1: p.cz + (p.h * S) / 2 })

// The name on the part's own sides, if it fits there and nothing stands in front of them; null: it does not.
function onSide(p: StagePart, i: number, blockers: NonNullable<StageModel['blockers']>): SideName | null {
  const bd = p.body, faceH = bd.y1 - bd.y0, y = (bd.y0 + bd.y1) / 2
  // the faces across the part (front and back) if the name fits them, else the faces along it (right and left): front and right face the iso and 3D views
  const hiddenFront = blockers.some(b => b.part !== i && b.x0 < bd.x1 && b.x1 > bd.x0 && b.z0 < bd.z1 + 0.6 && b.z1 > bd.z1)
  const hiddenRight = blockers.some(b => b.part !== i && b.z0 < bd.z1 && b.z1 > bd.z0 && b.x0 < bd.x1 + 0.6 && b.x1 > bd.x1)
  const lines = (width: number) => { const ls = wrapTo(p.label, SIDE.size, width - 2 * SIDE.pad); return ls && ls.length * SIDE.size * 1.2 + 0.1 <= faceH ? ls : null }
  const textH = (ls: string[]) => ls.length * SIDE.size * 1.2
  // where along a face the name can go: from the middle outwards, the first place no piece of the part itself stands out in front of (the server's rack)
  const slide = (lo: number, hi: number, ls: string[], blocked: [number, number][]): number | null => {
    const tw = Math.max(...ls.map(l => groundWidth(l, SIDE.size))), mid = (lo + hi) / 2
    for (let d = 0; d <= (hi - lo) / 2; d += 0.1) for (const c of d === 0 ? [mid] : [mid - d, mid + d]) {
      if (c - tw / 2 < lo + SIDE.pad - 1e-6 || c + tw / 2 > hi - SIDE.pad + 1e-6) continue
      if (!blocked.some(([a, b]) => a < c + tw / 2 && b > c - tw / 2)) return c
    }
    return null
  }
  const band = (q: PartBody, t: number) => q.y0 < y + t / 2 && q.y1 > y - t / 2
  const across = hiddenFront ? null : lines(bd.x1 - bd.x0)
  if (across) {
    const x = slide(bd.x0, bd.x1, across, p.solids.filter(q => band(q, textH(across)) && (q.z1 > bd.z1 + 0.005 || q.z0 < bd.z0 - 0.005)).map((q): [number, number] => [q.x0, q.x1]))
    if (x !== null) return { lines: across, size: SIDE.size, faces: [{ at: [x, y, bd.z1 + SIDE.off], rot: 0 }, { at: [x, y, bd.z0 - SIDE.off], rot: Math.PI }] }
  }
  const along = hiddenRight ? null : lines(bd.z1 - bd.z0)
  if (along) {
    const z = slide(bd.z0, bd.z1, along, p.solids.filter(q => band(q, textH(along)) && (q.x1 > bd.x1 + 0.005 || q.x0 < bd.x0 - 0.005)).map((q): [number, number] => [q.z0, q.z1]))
    if (z !== null) return { lines: along, size: SIDE.size, faces: [{ at: [bd.x1 + SIDE.off, y, z], rot: Math.PI / 2 }, { at: [bd.x0 - SIDE.off, y, z], rot: -Math.PI / 2 }] }
  }
  return null
}

/**
 * The stage as the camera frames it. The model's own floor (a flat mesh the scene stretches, with its own material) keeps FLOOR_PAD round
 * everything standing on it, the parts and the unnamed solid objects: where one hangs off an edge or stands nearer it than that, the floor
 * grows to the padding; it is never made smaller, and a floor that already has it is left as it is (`floorTo` null). The whole is centred
 * on the origin (`ox`, `oz` move the model and its names there), the layout's width and height are those of the grown floor, so fit, pan
 * and zoom frame it. `sides` is each part's name on its own sides (null: it floats), `reach` how high the stage stands: the model's own
 * height or the top of the highest name were every part's name to float, whichever is higher, and `upright` where each floating name's column of letters stands (it faces the camera, so a flat or iso fit counts it whole).
 */
export function framed(layout: StageModel): StageModel {
  const hw = (layout.width * S) / 2, hd = (layout.height * S) / 2
  const model: Rect = { x0: -hw, x1: hw, z0: -hd, z1: hd }
  const sides = layout.parts.map((p, i) => onSide(p, i, layout.blockers ?? []))
  let ext = model, floorTo: Rect | null = null
  const floor = layout.floor?.rect ?? null
  const stands = [...layout.parts.map(footprint), ...(layout.blockers ?? []).filter(b => b.part < 0)]
  if (floor && stands.length) {
    const need = stands.map((r): Rect => ({ x0: r.x0 - FLOOR_PAD, x1: r.x1 + FLOOR_PAD, z0: r.z0 - FLOOR_PAD, z1: r.z1 + FLOOR_PAD })).reduce(grow)
    if (!inside(need, floor)) { floorTo = grow(floor, need); ext = grow(model, floorTo) }
  }
  // every part's name can float (one too small for its sides in every view; in flat, where side faces cannot be seen, every one): the fit leaves room for each
  const reach = Math.max(layout.tall, ...layout.parts.map(p => p.top + floatRoom(p.label)))
  const ox = -(ext.x0 + ext.x1) / 2, oz = -(ext.z0 + ext.z1) / 2
  const width = (ext.x1 - ext.x0) / S, height = (ext.z1 - ext.z0) / S
  const parts = layout.parts.map(p => ({ ...p, x: (p.cx + ox) / S + width / 2 - p.w / 2, y: (p.cz + oz) / S + height / 2 - p.h / 2 }))
  const upright = layout.parts.map((p): Upright => { const c = floatColumn(p.label); return { x: p.cx + ox, y: p.top + c.foot, z: p.cz + oz, h: c.h } })
  return { ...layout, width, height, parts, sides, floorTo, reach, upright, ox, oz }
}

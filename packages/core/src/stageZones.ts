// How a stage's parts are named (BON-253): a flat zone under each part, its name on the zone if it fits, else on the part's own sides,
// else floating; and the model's own floor grown to hold the zones. Plain numbers, no React and no three.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import { GROUND, groundWidth, type GroundFit } from './titles.ts'
import { S } from './scale.ts'
import type { PartBody, StageModel, StagePart } from './stage.ts'
import type { Upright } from './camera.ts'

/** The margins a zone may have round its part, world units, tried in turn: modest and even; smaller only where a neighbour is close. */
export const ZONE_MARGINS = [0.5, 0.35, 0.2, 0.1]
/** How far the floor reaches past a zone it had to be grown for, world units. */
export const FLOOR_MARGIN = 0.3
/**
 * Every zone title on a stage is this size, world units, so the names read alike. A name that does not fit its zone at it, on one line or
 * wrapped between words, goes on the part's sides or floats: it is never drawn smaller.
 */
export const FLOOR_SIZE = 0.5
/** The space a title keeps from its zone's edge, world units. */
export const TITLE_INSET = 0.25
/**
 * A name that does not fit its zone goes on the part's own side faces (the front, facing the iso and 3D views, and the back, so it reads
 * turned): capitals of one size for every part, in one line or two, on the part's body (its mesh of the largest volume: the grill's
 * counter, not the hood over it), `off` from the surface, if the face is wide and tall enough for it. If not it floats.
 */
export const SIDE = { size: 0.32, pad: 0.15, off: 0.012 }
/** A floating name: its letter size (one for every part, never smaller for a long name) and how high over the part's top its column starts, world units. */
export const FLOAT_SIZE = 0.36
export const FLOAT_HOVER = 0.9
/** A floating name's column of letters (StageScene): it starts this far over its part's top and stands this tall with a little to spare, facing the camera, world units. */
const column = (label: string) => ({ foot: FLOAT_HOVER + 0.1, h: [...label.trim()].length * FLOAT_SIZE + 0.2 })
/** How high a floating name reaches over its part's top, world units: the hover, then one letter under another (StageScene). */
export const floatRoom = (label: string) => { const c = column(label); return c.foot + c.h }
/** How far the floor behind a tall thing is hidden from the iso and 3D views (which look from the front right), as a multiple of its height. */
const SHADOW = 1

export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** A name written on the part's own front and back faces. */
export interface SideName {
  lines: string[]; size: number // the capitals, in one line or two, and their letter size
  faces: { at: [number, number, number]; rot: number }[] // the two faces it is written on (model coordinates, the text's middle, just off the surface, and the turn about the vertical)
}
export interface Zone extends Rect {
  w: number; h: number // the zone, world units (h includes the strip for the name when it lies on the zone)
  title: GroundFit | null // the name as it lies on the zone, at FLOOR_SIZE; null: the name is written elsewhere
  side: 'front' | 'back' // which side of the part the title's strip is on
  titleX: number // where the name starts along the strip, from the zone's centre
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

const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6
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
 * How each part is named. Every part gets a zone, the flat shaded area under it: its footprint and an even margin (the largest of
 * ZONE_MARGINS that overlaps no other zone and no other thing standing on the floor), with a strip on one side for the name when the name
 * lies on it. The name then goes, in this order: on the zone at FLOOR_SIZE if it fits (the front strip or the back, slid along to where
 * nothing stands over it: a tall thing hides the floor behind it from the iso and 3D views); else on the part's own sides at SIDE.size;
 * else it floats (null in both). A part with no clear place for a zone at any margin has none (null), and is named as if it had no room.
 */
export function solveNames(layout: StageModel): { zones: (Zone | null)[]; sides: (SideName | null)[] } {
  const zones: (Zone | null)[] = [], sides: (SideName | null)[] = []
  const placed: Rect[] = []
  const blockers = layout.blockers ?? []
  const shadows = blockers.map(b => ({ x0: b.x0 - SHADOW * b.h, x1: b.x1, z0: b.z0 - SHADOW * b.h, z1: b.z1 }))
  const solid = [...layout.parts.map(footprint), ...blockers.filter(b => b.part < 0)]
  layout.parts.forEach((p, i) => {
    const fw = p.w * S, fd = p.h * S
    const free = (r: Rect) => !solid.some((b, k) => k !== i && overlap(r, b)) && !placed.some(q => overlap(r, q))
    // a zone at margin m, with a strip for the title on one side (title given) or without; null: it overlaps something, or the title has nowhere unhidden to lie
    const make = (m: number, side: 'front' | 'back', title: GroundFit | null): Zone | null => {
      const w = fw + 2 * m
      const th = title ? title.size * GROUND.line * title.lines.length : 0, room = title ? th + TITLE_INSET : 0
      const x0 = p.cx - w / 2, x1 = p.cx + w / 2
      const z0 = p.cz - fd / 2 - m - (side === 'back' ? room : 0), z1 = p.cz + fd / 2 + m + (side === 'front' ? room : 0)
      const rect = { x0, x1, z0, z1 }
      if (!free(rect)) return null
      let titleX = 0
      if (title) {
        const tw = Math.max(...title.lines.map(l => groundWidth(l, title.size)))
        const tz0 = side === 'front' ? z1 - TITLE_INSET - th : z0 + TITLE_INSET, tz1 = tz0 + th
        let at: number | null = null
        for (let x = x0 + TITLE_INSET; at === null && x + tw <= x1 - TITLE_INSET + 1e-6; x += 0.2) {
          if (!shadows.some(b => b.x0 < x + tw && b.x1 > x && b.z0 < tz1 && b.z1 > tz0)) at = x
        }
        if (at === null) return null
        titleX = at - (x0 + x1) / 2
      }
      return { ...rect, w, h: z1 - z0, title, side, titleX }
    }
    let zone: Zone | null = null
    for (const m of ZONE_MARGINS) for (const sd of ['front', 'back'] as const) {
      if (zone) break
      const lines = wrapTo(p.label, FLOOR_SIZE, fw + 2 * m - 2 * TITLE_INSET)
      if (lines) zone = make(m, sd, { lines, size: FLOOR_SIZE })
    }
    const side = zone ? null : onSide(p, i, blockers)
    for (const m of ZONE_MARGINS) zone ??= make(m, 'front', null)
    if (zone) placed.push(zone)
    zones[i] = zone
    sides[i] = side
  })
  return { zones, sides }
}

/**
 * The stage as the camera frames it. Where a zone runs past the model's own floor, that floor (a flat mesh the scene stretches, with its own
 * material) is grown to hold every zone with FLOOR_MARGIN to spare; a model with no floor of its own gets one in the theme's style, `base`,
 * only when a zone runs past the model. The whole is centred on the origin (`ox`, `oz` move the model and its names there), the layout's
 * width and height are those of the grown floor, so fit, pan and zoom frame it, `reach` is how high the tallest floating name stands, and
 * `upright` where each floating name's column of letters stands (it faces the camera, so a flat or iso fit counts it whole).
 */
export function framed(layout: StageModel): StageModel {
  const hw = (layout.width * S) / 2, hd = (layout.height * S) / 2
  const model: Rect = { x0: -hw, x1: hw, z0: -hd, z1: hd }
  const { zones, sides } = solveNames(layout)
  let ext = model
  let floorTo: Rect | null = null, base: Rect | null = null
  const placed = zones.filter((z): z is Zone => z !== null)
  if (placed.length) {
    const reach = placed.map((z): Rect => ({ x0: z.x0, x1: z.x1, z0: z.z0, z1: z.z1 })).reduce(grow)
    const need: Rect = { x0: reach.x0 - FLOOR_MARGIN, x1: reach.x1 + FLOOR_MARGIN, z0: reach.z0 - FLOOR_MARGIN, z1: reach.z1 + FLOOR_MARGIN }
    const floor = layout.floor?.rect ?? null
    if (floor) {
      if (!inside(reach, floor)) { floorTo = grow(floor, need); ext = grow(model, floorTo) }
    } else if (!inside(reach, model)) {
      base = grow(model, need); ext = base
    }
  }
  // a floating name (a part named neither on its zone nor, in iso and 3D, on its sides; in flat a side-named part floats too) stands a column of letters above its part
  const floats = layout.parts.filter((_, i) => !zones[i]?.title)
  const reach = Math.max(layout.tall, ...floats.map(p => p.top + floatRoom(p.label)))
  const ox = -(ext.x0 + ext.x1) / 2, oz = -(ext.z0 + ext.z1) / 2
  const width = (ext.x1 - ext.x0) / S, height = (ext.z1 - ext.z0) / S
  const parts = layout.parts.map(p => ({ ...p, x: (p.cx + ox) / S + width / 2 - p.w / 2, y: (p.cz + oz) / S + height / 2 - p.h / 2 }))
  const upright = floats.map((p): Upright => { const c = column(p.label); return { x: p.cx + ox, y: p.top + c.foot, z: p.cz + oz, h: c.h } })
  return { ...layout, width, height, parts, zones, sides, floorTo, base, reach, upright, ox, oz }
}

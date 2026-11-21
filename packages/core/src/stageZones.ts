// Zones and the floor of a stage (BON-253): the floor under each part that has one, kept off its neighbours, and the model's own
// floor grown to hold them. Plain numbers, no React and no three: the camera's fit and the scene both read it.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import { GROUND, groundTitle, groundWidth, type GroundFit } from './titles.ts'
import { S } from './scale.ts'
import type { PartBody, StageLayout, StagePart } from './stage.ts'
import type { StageLabelMode } from './model.ts'

/** The margins a zone may have round its part, world units, tried in turn: modest and even; smaller only where a neighbour is close. */
export const ZONE_MARGINS = [0.5, 0.35, 0.2, 0.1]
/** How far the floor reaches past a zone it had to be grown for, world units. */
export const FLOOR_MARGIN = 0.3
/** The padding the model's own floor keeps round everything standing on it, world units: where something stands nearer an edge (or over it) the floor is grown to this, evenly. */
export const FLOOR_PAD = 0.6
/**
 * Every zone title on a stage is this size, world units (Cloud Cartography lets a zone's name run from 0.35 to 1.3 by the zone's size; a
 * stage wants one size so the names read alike). A name that does not fit its zone at it, on one line or wrapped between words, goes
 * elsewhere: the title is never made smaller. (The `zone` value alone shrinks it, to show the Cloud Cartography way.)
 */
export const FLOOR_SIZE = 0.5
/** The space a title keeps from its floor's edge, world units (Cloud Cartography keeps 0.45; a stage's one title size is wide, so less). */
export const TITLE_INSET = 0.25
/**
 * A name that does not fit its zone goes on the part's own side faces (the front, facing the iso and 3D views, and the back, so it reads
 * turned): capitals of one size for every part, in one line or two, on the part's body (its mesh of the largest volume: the grill's counter, not the hood over it), 0.012 off the surface, if the face is wide
 * and tall enough for it. If not it floats.
 */
export const SIDE = { size: 0.32, pad: 0.15, off: 0.012 }
/** How far the floor behind a tall thing is hidden from the iso and 3D views (which look from the front right), as a multiple of its height. */
const SHADOW = 1

export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** A name written on the part's own front and back faces. */
export interface SideName {
  lines: string[]; size: number // the capitals, in one line or two, and their letter size
  faces: { at: [number, number, number]; rot: number }[] // the two faces it is written on (model coordinates, the text's middle, just off the surface, and the turn about the vertical)
}
export interface Zone extends Rect {
  w: number; h: number // the floor, world units (h includes the strip for the name when it lies on the floor)
  title: GroundFit | null // the name as it lies on the floor, at one size; null: the name is written elsewhere
  room: number // the strip the name lies in (0 without a title)
  side: 'front' | 'back' // which side of the part the strip is on
  titleX: number // where the name starts along the strip, from the floor's centre
  clear: boolean // false: no place was found that overlaps nothing; this is the least bad one
}

const wrapTo = (label: string, size: number, room: number): string[] | null => {
  const words = label.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const fits = (ls: string[]) => ls.every(l => groundWidth(l, size) <= room)
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    // the split of the words into n lines with the shortest longest line
    const best = (ws: string[], k: number): string[] | null => {
      if (k === 1) return [ws.join(' ')]
      let out: string[] | null = null, mx = Infinity
      for (let i = 1; i <= ws.length - k + 1; i++) { const rest = best(ws.slice(i), k - 1); if (!rest) continue; const ls = [ws.slice(0, i).join(' '), ...rest]; const m = Math.max(...ls.map(l => l.length)); if (m < mx) { out = ls; mx = m } }
      return out
    }
    const ls = best(words, n)
    if (ls && fits(ls)) return ls
  }
  return null
}

const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6
const footprint = (p: StagePart): Rect => ({ x0: p.cx - (p.w * S) / 2, x1: p.cx + (p.w * S) / 2, z0: p.cz - (p.h * S) / 2, z1: p.cz + (p.h * S) / 2 })

/**
 * How each part is named, under a label mode (`zone`, `auto`; otherwise nothing here). Every part has a zone, the flat shaded area under it, whichever way it is named (it has a title on it when the name lies on the floor):
 * its footprint and an even margin, with a strip on one side for the name when the name lies on the floor. No zone overlaps another zone or
 * another part: a part tries the margins in turn (smaller where a neighbour is close);  In `auto` the name is then, in this order, on the zone's
 * floor at the one title size if it fits there readably (the front strip or the back, slid along to where nothing stands over it: a tall
 * thing hides the floor behind it from the iso and 3D views); else written on the part's own sides at the one side size; else floating.
 */
export function solveNames(layout: StageLayout, mode: StageLabelMode): { zones: (Zone | null)[]; sides: (SideName | null)[] } {
  const zones: (Zone | null)[] = [], sides: (SideName | null)[] = []
  if (mode !== 'zone' && mode !== 'auto') return { zones: layout.parts.map(() => null), sides: layout.parts.map(() => null) }
  const placed: Rect[] = []
  const raw = layout.blockers ?? []
  const shadows = raw.map(b => ({ x0: b.x0 - SHADOW * b.h, x1: b.x1, z0: b.z0 - SHADOW * b.h, z1: b.z1 }))
  const solid = [...layout.parts.map(footprint), ...raw.filter(b => b.part < 0)]
  const onSide = (p: StagePart, i: number): SideName | null => {
    const bd = p.body, fh = bd.y1 - bd.y0, cx = (bd.x0 + bd.x1) / 2, cz = (bd.z0 + bd.z1) / 2, y = (bd.y0 + bd.y1) / 2
    // the faces across the part (front and back) if the name fits them, else the faces along it (right and left): front and right face the iso and 3D views
    const hiddenFront = raw.some(b => b.part !== i && b.x0 < bd.x1 && b.x1 > bd.x0 && b.z0 < bd.z1 + 0.6 && b.z1 > bd.z1)
    const hiddenRight = raw.some(b => b.part !== i && b.z0 < bd.z1 && b.z1 > bd.z0 && b.x0 < bd.x1 + 0.6 && b.x1 > bd.x1)
    const lines = (width: number) => { const ls = wrapTo(p.label, SIDE.size, width - 2 * SIDE.pad); return ls && ls.length * SIDE.size * 1.2 + 0.1 <= fh ? ls : null }
    const th = (ls: string[]) => ls.length * SIDE.size * 1.2
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
    const zl = hiddenFront ? null : lines(bd.x1 - bd.x0)
    if (zl) {
      const x = slide(bd.x0, bd.x1, zl, p.solids.filter(q => band(q, th(zl)) && (q.z1 > bd.z1 + 0.005 || q.z0 < bd.z0 - 0.005)).map((q): [number, number] => [q.x0, q.x1]))
      if (x !== null) return { lines: zl, size: SIDE.size, faces: [{ at: [x, y, bd.z1 + SIDE.off], rot: 0 }, { at: [x, y, bd.z0 - SIDE.off], rot: Math.PI }] }
    }
    const xl = hiddenRight ? null : lines(bd.z1 - bd.z0)
    if (xl) {
      const zc = slide(bd.z0, bd.z1, xl, p.solids.filter(q => band(q, th(xl)) && (q.x1 > bd.x1 + 0.005 || q.x0 < bd.x0 - 0.005)).map((q): [number, number] => [q.z0, q.z1]))
      if (zc !== null) return { lines: xl, size: SIDE.size, faces: [{ at: [bd.x1 + SIDE.off, y, zc], rot: Math.PI / 2 }, { at: [bd.x0 - SIDE.off, y, zc], rot: -Math.PI / 2 }] }
    }
    void cx; void cz
    return null
  }
  // `auto`: the name written on the part's own sides, else floating; no area under anything (the person's rule: write on the sides, get rid of the areas)
  if (mode === 'auto') return { zones: layout.parts.map(() => null), sides: layout.parts.map((p, i) => onSide(p, i)) }
  layout.parts.forEach((p, i) => {
    const fw = p.w * S, fd = p.h * S
    const free = (rect: Rect) => !solid.some((b, k) => k !== i && overlap(rect, b)) && !placed.some(r => overlap(rect, r))
    // a zone at margin m, with a strip for the name on one side (title given) or without
    const make = (m: number, side: 'front' | 'back', title: GroundFit | null): Zone => {
      const w = fw + 2 * m
      const th = title ? title.size * GROUND.line * title.lines.length : 0, room = title ? th + TITLE_INSET : 0
      const x0 = p.cx - w / 2, x1 = p.cx + w / 2
      const z0 = p.cz - fd / 2 - m - (side === 'back' ? room : 0), z1 = p.cz + fd / 2 + m + (side === 'front' ? room : 0)
      let titleX: number | null = 0
      if (title) {
        const tw = Math.max(...title.lines.map(l => groundWidth(l, title.size)))
        const tz0 = side === 'front' ? z1 - TITLE_INSET - th : z0 + TITLE_INSET, tz1 = tz0 + th
        titleX = null
        for (let x = x0 + TITLE_INSET; x + tw <= x1 - TITLE_INSET + 1e-6; x += 0.2) {
          if (!shadows.some(b => b.x0 < x + tw && b.x1 > x && b.z0 < tz1 && b.z1 > tz0)) { titleX = x; break }
        }
      }
      const rect = { x0, x1, z0, z1 }
      return { ...rect, w, h: z1 - z0, title, room, side, titleX: title ? (titleX ?? x0 + TITLE_INSET) - (x0 + x1) / 2 : 0, clear: titleX !== null && free(rect) }
    }
    // the name on the zone's floor first, at the one title size: the largest margin, the front strip then the back, where the title fits and nothing overlaps
    let zone: Zone | null = null
    for (const m of ZONE_MARGINS) for (const sd of ['front', 'back'] as const) {
      if (zone) break
      const lines = wrapTo(p.label, FLOOR_SIZE, fw + 2 * m - 2 * TITLE_INSET)
      if (!lines) continue
      const zn = make(m, sd, { lines, size: FLOOR_SIZE })
      if (zn.clear) zone = zn
    }
    if (!zone && mode === 'zone') {
      // the Cloud Cartography way, for comparison: the name is made smaller to fit the floor it has
      const m = ZONE_MARGINS[0], fit = groundTitle(fw + 2 * m, fd + 2 * m, p.label, 0)
      for (const sd of ['front', 'back'] as const) { if (!zone) { const zn = make(m, sd, fit); if (zn.clear) zone = zn } }
      zone ??= make(ZONE_MARGINS[ZONE_MARGINS.length - 1], 'front', fit)
    }
    // else (in `auto`) on the part's own sides, else floating; every part keeps its area, a zone without a title (the largest margin that overlaps nothing)
    const side = null
    let bare: Zone | null = null
    if (!zone) for (const m of ZONE_MARGINS) { if (!bare) { const zn = make(m, 'front', null); if (zn.clear) bare = zn } }
    const chosen = zone ?? bare
    if (chosen) placed.push(chosen)
    zones[i] = chosen
    sides[i] = side
  })
  return { zones, sides }
}

/**
 * The stage as the camera frames it. The model's own floor is grown to hold every zone (the floor is a flat mesh the scene stretches, with its
 * own material); a model with no floor gets one in the theme's style, `base`, only when a zone runs past the model. The whole is centred on
 * the origin (`ox`, `oz` move the model and its names there) and the layout's width and height are those of the grown floor, so fit, pan and
 * zoom frame it.
 */
export function framed(layout: StageLayout, mode: StageLabelMode): StageLayout {
  const hw = (layout.width * S) / 2, hd = (layout.height * S) / 2
  const model: Rect = { x0: -hw, x1: hw, z0: -hd, z1: hd }
  const { zones, sides } = solveNames(layout, mode)
  const grow = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) })
  const inside = (a: Rect, b: Rect) => a.x0 >= b.x0 - 1e-6 && a.x1 <= b.x1 + 1e-6 && a.z0 >= b.z0 - 1e-6 && a.z1 <= b.z1 + 1e-6
  let ext = model
  let floorTo: Rect | null = null, base: Rect | null = null
  const placed = zones.filter((z): z is Zone => z !== null)
  const floor = layout.floor?.rect ?? null
  // everything standing on the floor: the parts and the unnamed solid objects
  const stands = [...layout.parts.map(footprint), ...(layout.blockers ?? []).filter(b => b.part < 0)]
  if (floor && stands.length) {
    // The floor keeps an even padding round all of it, like a box with padding: where something hangs off an edge or stands nearer it than that, the
    // floor (its own mesh, stretched) grows to the padding, together with room for any zone. It is never made smaller.
    const need = [...stands.map((r): Rect => ({ x0: r.x0 - FLOOR_PAD, x1: r.x1 + FLOOR_PAD, z0: r.z0 - FLOOR_PAD, z1: r.z1 + FLOOR_PAD })),
      ...placed.map((z): Rect => ({ x0: z.x0 - FLOOR_MARGIN, x1: z.x1 + FLOOR_MARGIN, z0: z.z0 - FLOOR_MARGIN, z1: z.z1 + FLOOR_MARGIN }))].reduce(grow)
    if (!inside(need, floor)) { floorTo = grow(floor, need); ext = grow(model, floorTo) }
  } else if (placed.length) {
    const need = placed.map((z): Rect => ({ x0: z.x0 - FLOOR_MARGIN, x1: z.x1 + FLOOR_MARGIN, z0: z.z0 - FLOOR_MARGIN, z1: z.z1 + FLOOR_MARGIN })).reduce(grow)
    // a model with no floor gets one in the theme's style, only where a zone runs past the model
    if (!inside(placed.reduce<Rect>((r, z) => grow(r, z), placed[0]), model)) { base = grow(model, need); ext = base }
  }
  // floating names (in `auto` every part's, from above where its sides cannot be seen; every part's in `sign` and `diamond`) stand up to a column of letters above the part: the fit leaves room
  const floats = layout.parts.filter((p, i) => mode === 'sign' || mode === 'diamond' || (mode === 'auto' && zones[i] === null))
  const reach = Math.max(layout.tall, ...floats.map(p => p.top + 1.9 + Math.min(4, [...p.label].length * 0.36)))
  const ox = -(ext.x0 + ext.x1) / 2, oz = -(ext.z0 + ext.z1) / 2
  const width = (ext.x1 - ext.x0) / S, height = (ext.z1 - ext.z0) / S
  const parts = layout.parts.map(p => ({ ...p, x: (p.cx + ox) / S + width / 2 - p.w / 2, y: (p.cz + oz) / S + height / 2 - p.h / 2 }))
  return { ...layout, width, height, parts, zones, sides, floorTo, base, reach, ox, oz }
}

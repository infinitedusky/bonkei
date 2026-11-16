// Edges in 3D, as pure functions on world units (x, z in plan; y is height): where an edge steps between
// heights, where two edges cross, and how the crossing is drawn. Decisions: LOG.md, "How edges sit in 3D (BON-85)".
// Imported by node tests: explicit .ts extensions, no .tsx.
import { TRAY, NODE_H, S } from './scale.ts'

export type CrossingStyle = 'none' | 'bridge' | 'tunnel' | 'portal'
export const CROSSING_STYLES: readonly CrossingStyle[] = ['none', 'bridge', 'tunnel', 'portal']

export type P3 = [number, number, number] // x, z (plan), y (height)

export const STEP_OFFSET = 20 * S // how far outside a tray rim (or the higher end) the step stands
export const RISE = 0.35 // a bridge clears the other line by this much
export const HALF_GAP = 0.4 // half the distance between the two holes / portals / bridge feet
export const SLOT_W = 0.3 // a tunnel's open slot is this wide
export const SLOT_MARGIN = 0.1 // and runs this far past the dipped stretch each end
// how far the line dips and how deep the slot is cut: into the ground, or (shallower: a tray is only TRAY thick) into a tray's top
export const DIP = { ground: 0.25, tray: 0.1 }
export const SLOT_DEPTH = { ground: 0.4, tray: 0.18 } // a tray is TRAY (0.25) thick: its trough stays inside it
export const SLOT_GAP = 0.25 // troughs closer than this are merged into one
const CLUSTER = 0.45 // crossings closer than this along a line share one bridge / trough / portal pair
const TOUCH = 0.2 // lines whose heights differ by less than this at a crossing would touch
const EPS = 1e-6

/** A node or a tray in world units. `height` is the block's own height (default NODE_H); a tray is TRAY. */
export interface Body {
  id: string
  kind: 'node' | 'group'
  x0: number; z0: number; x1: number; z1: number
  level: number
  parent?: string
  height?: number
}

export const baseOf = (b: Pick<Body, 'level'>) => b.level * TRAY
export const heightOf = (b: Pick<Body, 'kind' | 'height'>) => b.kind === 'group' ? TRAY : b.height ?? NODE_H
/** Where an edge meets a body: halfway up it. */
export const endHeight = (b: Body) => baseOf(b) + heightOf(b) / 2

type Rect = { x0: number; z0: number; x1: number; z1: number }
const grow = (r: Rect, d: number): Rect => ({ x0: r.x0 - d, z0: r.z0 - d, x1: r.x1 + d, z1: r.z1 + d })

// Liang-Barsky: the part [t0, t1] of segment a->b inside r, or null.
function clip(a: [number, number], b: [number, number], r: Rect): [number, number] | null {
  let t0 = 0, t1 = 1
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const test = (p: number, q: number) => {
    if (Math.abs(p) < EPS) return q >= 0
    const t = q / p
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t }
    return true
  }
  if (test(-dx, a[0] - r.x0) && test(dx, r.x1 - a[0]) && test(-dz, a[1] - r.z0) && test(dz, r.z1 - a[1])) return [t0, t1]
  return null
}

const ancestors = (b: Body, bodies: Map<string, Body>) => {
  const out: Body[] = []
  for (let p = b.parent ? bodies.get(b.parent) : undefined; p; p = p.parent ? bodies.get(p.parent) : undefined) out.push(p)
  return out
}

// A point on the polyline at parameter p = segment index + fraction.
function pointAt(pts: [number, number][], p: number): { i: number; f: number; at: [number, number] } {
  let i = Math.floor(p + EPS), f = p - i
  if (i >= pts.length - 1) { i = pts.length - 2; f = 1 }
  if (f < EPS) f = 0
  if (f > 1 - EPS) { i++; f = 0; if (i > pts.length - 2) { i = pts.length - 2; f = 1 } }
  const a = pts[i], b = pts[i + 1]
  return { i, f, at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] }
}

// Parameter on the polyline `d` of arc length away from its start (or end), at most half the line.
function paramAtDistance(pts: [number, number][], d: number, fromEnd: boolean): number {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const total = seg.reduce((s, x) => s + x, 0)
  let left = Math.min(d, total / 2)
  const order = seg.map((_, i) => i)
  if (fromEnd) order.reverse()
  for (const i of order) {
    if (left <= seg[i] + EPS) {
      const f = seg[i] < EPS ? 0 : left / seg[i]
      return fromEnd ? i + 1 - f : i + f
    }
    left -= seg[i]
  }
  return fromEnd ? 0 : seg.length
}

/**
 * Adds the heights to an edge's plan route: it runs at one end's height, makes exactly one vertical step, and
 * runs on at the other's. The step stands `offset` outside the outermost tray rim the line crosses; if it crosses
 * none, `offset` out from the higher end. Equal end heights: no step.
 */
export function stepRoute(pts: [number, number][], a: Body, b: Body, bodies: Map<string, Body>, offset = STEP_OFFSET): P3[] {
  const ha = endHeight(a), hb = endHeight(b)
  const flat = () => pts.map(([x, z]) => [x, z, ha] as P3)
  if (Math.abs(ha - hb) < EPS || pts.length < 2) return flat()

  // trays only one end is inside: their rims are what the line crosses
  const inA = new Set(ancestors(a, bodies).map(t => t.id)), inB = new Set(ancestors(b, bodies).map(t => t.id))
  const cands: { t: Body; side: 'a' | 'b' }[] = [
    ...ancestors(a, bodies).filter(t => !inB.has(t.id) && t.id !== b.id).map(t => ({ t, side: 'a' as const })),
    ...ancestors(b, bodies).filter(t => !inA.has(t.id) && t.id !== a.id).map(t => ({ t, side: 'b' as const })),
  ]
  const higher = ha > hb ? 'a' : 'b'
  cands.sort((x, y) => x.t.level - y.t.level || (x.side === higher ? -1 : 0) - (y.side === higher ? -1 : 0))

  // where the polyline is inside a grown rect: [first entry, last exit] as parameters
  const span = (r: Rect) => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < pts.length - 1; i++) {
      const c = clip(pts[i], pts[i + 1], r)
      if (c) { lo = Math.min(lo, i + c[0]); hi = Math.max(hi, i + c[1]) }
    }
    return lo === Infinity ? null : { lo, hi }
  }

  let p: number | null = null
  const first = cands[0]
  if (first) {
    const s = span(grow(first.t, offset))
    if (s) {
      p = first.side === 'a' ? s.hi : s.lo
      // two trays side by side: stay clear of the other one's grown rim too
      const other = cands.find(c => c.side !== first.side)
      const so = other && span(grow(other.t, offset))
      if (so) {
        if (first.side === 'a' && so.lo < p) p = (so.lo + p) / 2
        if (first.side === 'b' && so.hi > p) p = (so.hi + p) / 2
      }
    }
  }
  if (p === null) p = paramAtDistance(pts, offset, higher === 'b')

  const { i, at } = pointAt(pts, p)
  const out: P3[] = []
  const push = (q: P3) => {
    const l = out[out.length - 1]
    if (!l || Math.abs(l[0] - q[0]) > EPS || Math.abs(l[1] - q[1]) > EPS || Math.abs(l[2] - q[2]) > EPS) out.push(q)
  }
  for (let j = 0; j <= i; j++) push([pts[j][0], pts[j][1], ha])
  push([at[0], at[1], ha]); push([at[0], at[1], hb])
  for (let j = i + 1; j < pts.length; j++) push([pts[j][0], pts[j][1], hb])
  return out
}

export interface Crossing {
  h: { edge: number; seg: number } // the segment running along x: it changes
  v: { edge: number; seg: number } // the segment running along z: it stays
  x: number; z: number
  hh: number; hv: number // their heights
  touches: boolean // would the two lines touch (heights closer than TOUCH)
}

/** Every place a segment running along x meets a segment running along z, in different edges. Shared endpoints and overlaps are not crossings. */
export function findCrossings(lines: P3[][]): Crossing[] {
  type Sg = { edge: number; seg: number; c: number; lo: number; hi: number; y: number }
  const hs: Sg[] = [], vs: Sg[] = []
  lines.forEach((l, edge) => {
    for (let seg = 0; seg < l.length - 1; seg++) {
      const a = l[seg], b = l[seg + 1]
      const dx = b[0] - a[0], dz = b[1] - a[1]
      if (Math.abs(dz) < EPS && Math.abs(dx) > EPS) hs.push({ edge, seg, c: a[1], lo: Math.min(a[0], b[0]), hi: Math.max(a[0], b[0]), y: a[2] })
      else if (Math.abs(dx) < EPS && Math.abs(dz) > EPS) vs.push({ edge, seg, c: a[0], lo: Math.min(a[1], b[1]), hi: Math.max(a[1], b[1]), y: a[2] })
    }
  })
  const out: Crossing[] = []
  for (const h of hs) for (const v of vs) {
    if (h.edge === v.edge) continue
    if (v.c > h.lo + EPS && v.c < h.hi - EPS && h.c > v.lo + EPS && h.c < v.hi - EPS)
      out.push({ h: { edge: h.edge, seg: h.seg }, v: { edge: v.edge, seg: v.seg }, x: v.c, z: h.c, hh: h.y, hv: v.y, touches: Math.abs(h.y - v.y) < TOUCH })
  }
  return out
}

/** A pair of portals: the line ends at `a` and carries on from `b`. `dir` is the way the line runs (unit, on x or z). */
export interface PortalPair { a: P3; b: P3; dir: [number, number] }
/** An open trough: x0..x1 along x, z0..z1 across (equal for one line: a stadium; merged troughs are a rounded rectangle). Its floor is `depth` below `top`; it is cut in the tray `tray`, or in the ground. */
export interface Slot { x0: number; x1: number; z0: number; z1: number; top: number; depth: number; tray?: string }

/** Troughs on the same surface that are closer than SLOT_GAP become one trough (the bounding rectangle), repeatedly. */
export function mergeSlots(slots: Slot[]): Slot[] {
  const out = slots.map(s => ({ ...s }))
  const near = (a: Slot, b: Slot) => a.tray === b.tray
    && a.x0 - SLOT_GAP < b.x1 && b.x0 - SLOT_GAP < a.x1
    && a.z0 - SLOT_W - SLOT_GAP < b.z1 && b.z0 - SLOT_W - SLOT_GAP < a.z1
  for (let again = true; again;) {
    again = false
    for (let i = 0; i < out.length && !again; i++) for (let j = i + 1; j < out.length && !again; j++) {
      if (!near(out[i], out[j])) continue
      const a = out[i], b = out[j]
      out[i] = { ...a, x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }
      out.splice(j, 1); again = true
    }
  }
  return out
}
export interface EdgePlan {
  parts: P3[][] // the line, cut where it goes through portals; the arrow is on the last
  slots: Slot[] // tunnel slots, open in the surface the line dips into
  portals: PortalPair[]
}

/** The surface under (x, z): the top of the innermost tray there, else the ground. */
export function surfaceAt(x: number, z: number, bodies: Body[]): { top: number; tray?: Body } {
  let top = 0, tray: Body | undefined
  for (const b of bodies) if (b.kind === 'group' && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && (b.level + 1) * TRAY > top) { top = (b.level + 1) * TRAY; tray = b }
  return { top, tray }
}

export interface Stats { crossings: number; touching: number; bridge: number; tunnel: number; portal: number; skipped: number }

/**
 * Draws each crossing in the chosen style on the line with the most crossings (a tie: the one along x). Where that line has no room at the
 * crossing (libavoid's nudged lines often cross close to a bend) the other line gets past instead. Pure: returns new lines.
 */
export function applyCrossings(lines: P3[][], style: CrossingStyle, bodies: Body[]): { plans: EdgePlan[]; stats: Stats; slots: Slot[] } {
  const all = findCrossings(lines)
  const todo = style === 'none' ? [] : all.filter(c => c.touches)
  const stats: Stats = { crossings: all.length, touching: all.filter(c => c.touches).length, bridge: 0, tunnel: 0, portal: 0, skipped: 0 }
  const plans: EdgePlan[] = lines.map(l => ({ parts: [l], slots: [], portals: [] }))
  if (!todo.length) return { plans, stats, slots: [] }

  const need = style === 'bridge' ? 0.06 : style === 'portal' ? 0.1 : 0.12
  // who changes: the line along x, unless it cannot (room each side of the crossing along its own segment) and the other can
  type Ch = { edge: number; seg: number; axis: 0 | 1; along: number; cross: number; hh: number; hv: number }
  const roomOf = (edge: number, seg: number, axis: 0 | 1, along: number) => {
    const a = lines[edge][seg], b = lines[edge][seg + 1], last = seg === lines[edge].length - 2
    return Math.min(Math.abs(along - a[axis]), Math.abs(b[axis] - along) - (last ? 0.35 : 0)) - 0.05
  }
  // the line with the most crossings is the one that gets past them (one dip under four lines, not four hops over one); a tie goes to the line along x
  const count = new Map<number, number>()
  for (const c of todo) for (const e of [c.h.edge, c.v.edge]) count.set(e, (count.get(e) ?? 0) + 1)
  const chg: Ch[] = todo.map(c => {
    const h: Ch = { edge: c.h.edge, seg: c.h.seg, axis: 0, along: c.x, cross: c.z, hh: c.hh, hv: c.hv }
    const v: Ch = { edge: c.v.edge, seg: c.v.seg, axis: 1, along: c.z, cross: c.x, hh: c.hh, hv: c.hv }
    const [first, second] = count.get(v.edge)! > count.get(h.edge)! ? [v, h] : [h, v]
    return roomOf(first.edge, first.seg, first.axis, first.along) >= need || roomOf(second.edge, second.seg, second.axis, second.along) < need ? first : second
  })

  const byEdge = new Map<number, Ch[]>()
  for (const c of chg) byEdge.set(c.edge, [...(byEdge.get(c.edge) ?? []), c])
  const pt = (axis: 0 | 1, along: number, cross: number, y: number): P3 => axis === 0 ? [along, cross, y] : [cross, along, y]
  for (const [edge, cs] of byEdge) {
    const line = lines[edge]
    const plan = plans[edge]
    let part: P3[] = []
    const parts: P3[][] = []
    const emit = (q: P3) => part.push(q)
    for (let seg = 0; seg < line.length - 1; seg++) {
      const a = line[seg], b = line[seg + 1]
      emit(a)
      const here: Ch[] = []
      for (const c of cs.filter(c => c.seg === seg)) {
        const same = here.find(q => q.axis === c.axis && Math.abs(q.along - c.along) < EPS)
        if (same) { same.hv = Math.max(same.hv, c.hv); same.hh = Math.max(same.hh, c.hh) } else here.push({ ...c })
      }
      if (!here.length) continue
      // a segment runs along one axis; only crossings assigned to that axis belong to it
      const ax: 0 | 1 = Math.abs(b[0] - a[0]) > EPS ? 0 : 1
      const mine = here.filter(c => c.axis === ax)
      stats.skipped += here.length - mine.length
      if (!mine.length) continue
      const d = Math.sign(b[ax] - a[ax])
      mine.sort((p, q) => d * (p.along - q.along))
      const last = seg === line.length - 2
      // crossings closer than CLUSTER along the line (a bundle of nudged parallel lines) get one gap together; t is the distance along the segment's own direction
      type Cl = { t0: number; t1: number; cross: number; hh: number; hv: number }
      const cls: Cl[] = []
      for (const c of mine) {
        const t = d * c.along, l = cls[cls.length - 1]
        if (l && t - l.t1 < CLUSTER) { l.t1 = t; l.hh = Math.max(l.hh, c.hh); l.hv = Math.max(l.hv, c.hv) } else cls.push({ t0: t, t1: t, cross: c.cross, hh: c.hh, hv: c.hv })
      }
      const ta = d * a[ax], tb = d * b[ax]
      // room each side of a gap: the segment's ends and its neighbours; the last segment keeps the arrowhead clear if it can
      const gapAt = (k: number, reserve: number) => {
        const c = cls[k]
        const before = k === 0 ? c.t0 - ta : (c.t0 - cls[k - 1].t1) / 2
        const after = k === cls.length - 1 ? tb - c.t1 - reserve : (cls[k + 1].t0 - c.t1) / 2
        return Math.min(HALF_GAP, before - 0.05, after - 0.05)
      }
      const gaps = cls.map((_, k) => { const g = gapAt(k, last ? 0.35 : 0); return g >= need ? g : gapAt(k, 0) })
      cls.forEach((c, k) => {
        const g = gaps[k]
        if (g < need) { stats.skipped += mine.filter(m => d * m.along >= c.t0 - EPS && d * m.along <= c.t1 + EPS).length; return } // no room: left as a plain crossing
        const xe = d * (c.t0 - g), xx = d * (c.t1 + g), mid = d * (c.t0 + c.t1) / 2, z = c.cross, y = a[2]
        if (style === 'bridge') {
          const top = Math.max(c.hh, c.hv) + RISE
          emit(pt(ax, xe, z, y)); emit(pt(ax, xe, z, top)); emit(pt(ax, xx, z, top)); emit(pt(ax, xx, z, y)); stats.bridge++
        } else if (style === 'tunnel') {
          const [sx, sz] = ax === 0 ? [mid, z] : [z, mid]
          const sf = surfaceAt(sx, sz, bodies), kind = sf.tray ? 'tray' : 'ground', bottom = sf.top - DIP[kind]
          emit(pt(ax, xe, z, y)); emit(pt(ax, xe, z, bottom)); emit(pt(ax, xx, z, bottom)); emit(pt(ax, xx, z, y))
          const lo = Math.min(xe, xx) - SLOT_MARGIN, hi = Math.max(xe, xx) + SLOT_MARGIN
          // a trough along x is x0..x1 at z; one along z is a rectangle SLOT_W wide whose stadium ends sit SLOT_W/2 beyond z0 and z1
          plan.slots.push(ax === 0
            ? { x0: lo, x1: hi, z0: z, z1: z, top: sf.top, depth: SLOT_DEPTH[kind], tray: sf.tray?.id }
            : { x0: z - SLOT_W / 2, x1: z + SLOT_W / 2, z0: lo + SLOT_W / 2, z1: hi - SLOT_W / 2, top: sf.top, depth: SLOT_DEPTH[kind], tray: sf.tray?.id })
          stats.tunnel++
        } else if (style === 'portal') {
          emit(pt(ax, xe, z, y)); parts.push(part); part = []; emit(pt(ax, xx, z, y))
          plan.portals.push({ a: pt(ax, xe, z, y), b: pt(ax, xx, z, y), dir: ax === 0 ? [d, 0] : [0, d] }); stats.portal++
        }
      })
    }
    emit(line[line.length - 1])
    parts.push(part)
    plan.parts = parts
  }
  return { plans, stats, slots: mergeSlots(plans.flatMap(p => p.slots)) }
}

/** The pieces `Scene` needs: bodies and routes in world units in, one plan per route out. */
export function planEdges(bodies: Body[], routes: { id: string; from: string; to: string; points: [number, number][] }[], style: CrossingStyle) {
  const map = new Map(bodies.map(b => [b.id, b]))
  const ids: string[] = []
  const lines: P3[][] = []
  for (const r of routes) {
    const a = map.get(r.from), b = map.get(r.to)
    if (!a || !b) continue
    ids.push(r.id)
    lines.push(stepRoute(r.points, a, b, map))
  }
  const { plans, stats, slots } = applyCrossings(lines, style, bodies)
  return { plans: new Map(ids.map((id, i) => [id, plans[i]])), stats, slots }
}

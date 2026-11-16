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
export const DEPTH = 0.2 // a tunnel bottoms out this far below the surface
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
export interface EdgePlan {
  parts: P3[][] // the line, cut where it goes through portals; the arrow is on the last
  holes: P3[] // tunnel mouths, on the surface
  portals: PortalPair[]
}

/** The height of the surface under (x, z): the top of the innermost tray there, else the ground. */
export function surfaceAt(x: number, z: number, bodies: Body[]): number {
  let top = 0
  for (const b of bodies) if (b.kind === 'group' && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) top = Math.max(top, (b.level + 1) * TRAY)
  return top
}

export interface Stats { crossings: number; touching: number; bridge: number; tunnel: number; portal: number; skipped: number }

/** Draws each crossing in the chosen style on the line that runs along x. Pure: returns new lines. */
export function applyCrossings(lines: P3[][], style: CrossingStyle, bodies: Body[]): { plans: EdgePlan[]; stats: Stats } {
  const all = findCrossings(lines)
  const todo = style === 'none' ? [] : all.filter(c => c.touches)
  const stats: Stats = { crossings: all.length, touching: all.filter(c => c.touches).length, bridge: 0, tunnel: 0, portal: 0, skipped: 0 }
  const plans: EdgePlan[] = lines.map(l => ({ parts: [l], holes: [], portals: [] }))
  if (!todo.length) return { plans, stats }

  const byEdge = new Map<number, Crossing[]>()
  for (const c of todo) byEdge.set(c.h.edge, [...(byEdge.get(c.h.edge) ?? []), c])
  for (const [edge, cs] of byEdge) {
    const line = lines[edge]
    const plan = plans[edge]
    let part: P3[] = []
    const parts: P3[][] = []
    const emit = (q: P3) => part.push(q)
    for (let seg = 0; seg < line.length - 1; seg++) {
      const a = line[seg], b = line[seg + 1]
      emit(a)
      // lines that share a track cross here at one x: one gap serves them all
      const here: Crossing[] = []
      for (const c of cs.filter(c => c.h.seg === seg)) {
        const same = here.find(q => Math.abs(q.x - c.x) < EPS)
        if (same) { same.hv = Math.max(same.hv, c.hv); same.hh = Math.max(same.hh, c.hh) } else here.push({ ...c })
      }
      if (!here.length) continue
      const d = Math.sign(b[0] - a[0])
      here.sort((p, q) => d * (p.x - q.x))
      const last = seg === line.length - 2
      // room each side of a crossing: the segment's ends and its neighbours; the last segment keeps the arrowhead clear if it can
      const gapAt = (k: number, reserve: number) => {
        const c = here[k]
        const before = k === 0 ? Math.abs(c.x - a[0]) : Math.abs(c.x - here[k - 1].x) / 2
        const after = k === here.length - 1 ? Math.abs(b[0] - c.x) - reserve : Math.abs(here[k + 1].x - c.x) / 2
        return Math.min(HALF_GAP, before - 0.05, after - 0.05)
      }
      const need = style === 'bridge' ? 0.06 : style === 'portal' ? 0.1 : 0.2
      const gaps = here.map((_, k) => { const g = gapAt(k, last ? 0.35 : 0); return g >= need ? g : gapAt(k, 0) })
      here.forEach((c, k) => {
        const g = gaps[k]
        if (g < need) { stats.skipped++; return } // no room: left as a plain crossing
        const xe = c.x - d * g, xx = c.x + d * g, z = c.z, y = a[2]
        if (style === 'bridge') {
          const top = Math.max(c.hh, c.hv) + RISE
          emit([xe, z, y]); emit([xe, z, top]); emit([xx, z, top]); emit([xx, z, y]); stats.bridge++
        } else if (style === 'tunnel') {
          const s = surfaceAt(c.x, z, bodies), bottom = s - DEPTH
          emit([xe, z, y]); emit([xe, z, bottom]); emit([xx, z, bottom]); emit([xx, z, y])
          plan.holes.push([xe, z, s], [xx, z, s]); stats.tunnel++
        } else if (style === 'portal') {
          emit([xe, z, y]); parts.push(part); part = []; emit([xx, z, y])
          plan.portals.push({ a: [xe, z, y], b: [xx, z, y], dir: [d, 0] }); stats.portal++
        }
      })
    }
    emit(line[line.length - 1])
    parts.push(part)
    plan.parts = parts
  }
  return { plans, stats }
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
  const { plans, stats } = applyCrossings(lines, style, bodies)
  return { plans: new Map(ids.map((id, i) => [id, plans[i]])), stats }
}

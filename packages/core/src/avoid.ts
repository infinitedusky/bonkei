// Lines routed by libavoid (BON-99), pure TypeScript on layout pixels. ELK places the boxes; one libavoid router routes
// every line, orthogonally, around blocks and around trays a line does not go into. Decisions: LOG.md, "Lines routed by libavoid (BON-99)".
//
// libavoid-js has no clusters, so a tray is four thin wall obstacles on its rim. Where a line must enter or leave a tray
// the wall has an opening (a gap), cut where the line's own end is, so it goes straight in. Inside a tray is free.
// An edge to a tray itself ends at a small dock shape just outside the rim's midpoint on the side facing the other end.
// Imported by node tests and scripts: explicit .ts extensions, no .tsx.
import { AvoidLib } from 'libavoid-js'
import type { Avoid, Router, ShapeRef, ConnRef } from 'libavoid-js'
import type { Box, LayoutResult, Route } from './model.ts'

export interface AvoidTune {
  /** Space kept between a line and a block it passes (px of layout). */
  buffer: number
  /** Space between parallel lines. */
  nudge: number
  /** Cost of a bend. */
  segment: number
  /** Cost of a move back against the line's own direction. */
  reverse: number
  /** Cost of crossing another line when the lines are first routed (0 = off). It makes a re-route take ~1 s on 50 nodes. */
  crossing: number
  /** The same while a node is dragged: kept low so a frame is a few ms. */
  dragCrossing: number
  /** Width of the opening cut in a tray's wall where a line enters. */
  gap: number
  /** Thickness of a tray's wall obstacle. */
  wall: number
  /** How trays are closed: 'walls' = walls with openings (shipped); 'none' = trays do not block (comparison). */
  trays: 'walls' | 'none'
  /** Let the router nudge the stub at a pin sideways (ends then leave the side midpoint). */
  nudgeEnds: boolean
  /** libavoid's nudgeSharedPathsWithCommonEndPoint and performUnifyingNudgingPreprocessingStep options. */
  shared: boolean
  unify: boolean
  /** Force each entering line through its own opening with a routing checkpoint on the rim. */
  checkpoints: boolean
}
export const TUNE: AvoidTune = { buffer: 10, nudge: 10, segment: 10, reverse: 200, crossing: 1000, dragCrossing: 0, gap: 36, wall: 4, trays: 'walls', nudgeEnds: false, shared: true, unify: false, checkpoints: false }

// ---- loading the wasm
let loading: Promise<Avoid> | null = null
let wasmUrl: string | undefined
/** Where the browser finds libavoid.wasm, if the bundler does not find it itself (Vite does). Call before the first layout. */
export function setAvoidWasm(url: string) { wasmUrl = url }
/** Loads the wasm once. Rejects if it cannot load (the caller falls back to ELK's routes). */
export function loadAvoid(): Promise<Avoid> {
  loading ??= AvoidLib.load(wasmUrl).then(() => AvoidLib.getInstance()).catch(e => { loading = null; throw e })
  return loading
}
/** The loaded module, or null while it has not loaded. */
export function avoidLoaded(): Avoid | null { try { return AvoidLib.getInstance() } catch { return null } }

/** How hard the router tries not to cross lines: off, some, strong. The cost is paid when the lines are routed (about 0.8 s on 50 nodes); a drag frame always routes without it. */
export const AVOID_CROSSINGS = ['off', 'some', 'strong'] as const
export type AvoidCrossings = typeof AVOID_CROSSINGS[number]
export const CROSSING_COST: Record<AvoidCrossings, number> = { off: 0, some: 1000, strong: 3000 }

export interface RouterStats {
  /** Time to build the router and route every line, ms. */
  buildMs: number
  /** Lines libavoid could not route (hasValidRoute false) or that still cross an obstacle. */
  failed: string[]
  /** Re-route ms of the last move. */
  moveMs: number
}
export interface EdgeRouter {
  /** The crossing-avoidance level the lines were routed with. */
  level: AvoidCrossings
  routes: Route[]
  stats: RouterStats
  /** Moves a node by (dx, dy) and re-routes; the router stays alive. Returns all routes. */
  move(id: string, dx: number, dy: number): Route[]
  /** Where the router has a node now. */
  at(id: string): { x: number; y: number }
  /** Puts every moved node back where the layout had it and re-routes. */
  reset(): Route[]
  dispose(): void
}

type Side = 'N' | 'S' | 'E' | 'W'
const PIN = 1
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/** The side of `t` a line from inside it towards `to` leaves by. */
function exitSide(t: Box, from: [number, number], to: [number, number]): Side {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  let tx = Infinity, ty = Infinity
  if (dx > 0) tx = (t.x + t.w - from[0]) / dx; else if (dx < 0) tx = (t.x - from[0]) / dx
  if (dy > 0) ty = (t.y + t.h - from[1]) / dy; else if (dy < 0) ty = (t.y - from[1]) / dy
  return tx < ty ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N')
}
const centre = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2]
const sideMid = (b: Box, s: Side): [number, number] => s === 'N' ? [b.x + b.w / 2, b.y] : s === 'S' ? [b.x + b.w / 2, b.y + b.h] : s === 'E' ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2]

export function createRouter(A: Avoid, data: LayoutResult, tune: AvoidTune = TUNE, level: AvoidCrossings = 'some'): EdgeRouter {
  tune = { ...tune, crossing: tune === TUNE ? CROSSING_COST[level] : tune.crossing }
  const t0 = performance.now()
  const base = data.routes
  const home = new Map(data.boxes.map(b => [b.id, { x: b.x, y: b.y }]))
  const byId = new Map(data.boxes.map(b => [b.id, { ...b }]))
  const ancestors = (id: string) => { const l: string[] = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) l.push(p); return l }
  const router: Router = new A.Router(A.RouterFlag.OrthogonalRouting)
  const P = A.RoutingParameter
  router.setRoutingParameter(P.shapeBufferDistance, tune.buffer)
  router.setRoutingParameter(P.idealNudgingDistance, tune.nudge)
  router.setRoutingParameter(P.segmentPenalty, tune.segment)
  router.setRoutingParameter(P.reverseDirectionPenalty, tune.reverse)
  router.setRoutingParameter(P.crossingPenalty, tune.crossing)
  router.setRoutingOption(A.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes, tune.nudgeEnds)
  router.setRoutingOption(A.RoutingOption.nudgeSharedPathsWithCommonEndPoint, tune.shared)
  router.setRoutingOption(A.RoutingOption.performUnifyingNudgingPreprocessingStep, tune.unify)
  const D = A.ConnDirFlag
  const DIR: Record<Side, number> = { N: D.ConnDirUp, S: D.ConnDirDown, E: D.ConnDirRight, W: D.ConnDirLeft }
  const rect = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h })

  const shapes = new Map<string, ShapeRef>()
  for (const b of byId.values()) {
    if (b.kind !== 'node') continue
    const s = router.addShape(rect(b.x, b.y, b.w, b.h))
    for (const [x, y, d] of [[0.5, 0, 'N'], [1, 0.5, 'E'], [0.5, 1, 'S'], [0, 0.5, 'W']] as [number, number, Side][])
      s.addPin({ classId: PIN, x, y, directions: DIR[d] }).setExclusive(false)
    shapes.set(b.id, s)
  }

  // which edges are routed here, and where each enters or leaves each tray it does not belong to
  const edges = data.routes.filter(r => byId.has(r.from) && byId.has(r.to) && !ancestors(r.from).includes(r.to) && !ancestors(r.to).includes(r.from))
  const gaps = new Map<string, Record<Side, number[]>>() // tray id -> openings (centre along the wall) per side
  const passes = new Map<string, { at: [number, number]; side: Side }[]>() // `${edge}:${end}` -> trays that end passes through, inner first
  const dockSide = new Map<string, Side>() // `${edge}:${end}` -> side of the tray that the edge docks at
  const addGap = (tray: string, side: Side, at: number) => { const g = gaps.get(tray) ?? gaps.set(tray, { N: [], S: [], E: [], W: [] }).get(tray)!; g[side].push(at) }
  for (const e of edges) {
    for (const [end, other] of [[e.from, e.to], [e.to, e.from]] as const) {
      const X = byId.get(end)!, O = byId.get(other)!
      const keep = new Set(ancestors(other).concat(other))
      const trays = ancestors(end).filter(t => !keep.has(t))
      const oc = centre(O)
      if (X.kind === 'group') dockSide.set(`${e.id}:${end}`, exitSide(X, centre(X), oc))
      for (const tid of trays) {
        const T = byId.get(tid)!
        const xc = centre(X)
        const side = exitSide(T, xc, oc)
        const along = side === 'N' || side === 'S' ? xc[0] : xc[1]
        addGap(tid, side, along)
        const lo = side === 'N' || side === 'S' ? T.x : T.y, hi = lo + (side === 'N' || side === 'S' ? T.w : T.h)
        const c = Math.min(Math.max(along, lo + tune.gap / 2), hi - tune.gap / 2)
        const at = side === 'N' ? [c, T.y] : side === 'S' ? [c, T.y + T.h] : side === 'W' ? [T.x, c] : [T.x + T.w, c]
        const k = `${e.id}:${end}`
        passes.set(k, [...(passes.get(k) ?? []), { at: at as [number, number], side }])
      }
    }
  }
  // walls: four thin rects per tray, broken where openings are
  if (tune.trays === 'walls') for (const t of byId.values()) {
    if (t.kind !== 'group') continue
    const g = gaps.get(t.id)
    const th = tune.wall
    for (const side of ['N', 'S', 'E', 'W'] as Side[]) {
      const horiz = side === 'N' || side === 'S'
      const lo = horiz ? t.x : t.y, hi = lo + (horiz ? t.w : t.h)
      const half = tune.gap / 2, edge = tune.gap / 2
      let ivs = (g?.[side] ?? []).map(c => { const m = Math.min(Math.max(c, lo + edge), hi - edge); return [m - half, m + half] as [number, number] }).sort((a, b) => a[0] - b[0])
      const merged: [number, number][] = []
      for (const iv of ivs) { const l = merged[merged.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else merged.push([...iv]) }
      let at = lo
      const segs: [number, number][] = []
      for (const iv of merged) { if (iv[0] > at) segs.push([at, iv[0]]); at = iv[1] }
      if (at < hi) segs.push([at, hi])
      for (const [a, b] of segs) {
        const fixed = side === 'N' ? t.y : side === 'S' ? t.y + t.h : side === 'W' ? t.x : t.x + t.w
        router.addShape(horiz ? rect(a, fixed - th / 2, b - a, th) : rect(fixed - th / 2, a, th, b - a))
      }
    }
  }
  // docks: a small shape just outside a tray's rim midpoint, for the edges that end at the tray itself
  const DOCK_OUT = 12, DOCK = 6
  const docks = new Map<string, ShapeRef>()
  const dockFor = (tray: string, side: Side) => {
    const key = `${tray}:${side}`
    let s = docks.get(key)
    if (!s) {
      const T = byId.get(tray)!
      const [mx, my] = sideMid(T, side)
      const n = side === 'N' ? [0, -1] : side === 'S' ? [0, 1] : side === 'E' ? [1, 0] : [-1, 0]
      const cx = mx + n[0] * DOCK_OUT, cy = my + n[1] * DOCK_OUT
      s = router.addShape(rect(cx - DOCK / 2, cy - DOCK / 2, DOCK, DOCK))
      s.addPin({ classId: PIN, x: 0.5, y: 0.5, directions: DIR[side] }).setExclusive(false)
      docks.set(key, s)
    }
    return s
  }

  const conns = new Map<string, ConnRef>()
  for (const e of edges) {
    const end = (id: string) => byId.get(id)!.kind === 'group' ? dockFor(id, dockSide.get(`${e.id}:${id}`)!) : shapes.get(id)!
    const c = router.addConnector({ shape: end(e.from), pin: PIN }, { shape: end(e.to), pin: PIN })
    conns.set(e.id, c)
    if (tune.checkpoints) {
      const cp = (p: { at: [number, number]; side: Side }, out: boolean) => ({ x: p.at[0], y: p.at[1] })
      const list = [...(passes.get(`${e.id}:${e.from}`) ?? []).map(p => cp(p, true)), ...[...(passes.get(`${e.id}:${e.to}`) ?? [])].reverse().map(p => cp(p, false))]
      if (list.length) c.setRoutingCheckpoints(list)
    }
  }
  router.processTransaction()
  router.setRoutingParameter(P.crossingPenalty, tune.dragCrossing)

  const out: EdgeRouter = {
    level, routes: [], stats: { buildMs: 0, failed: [], moveMs: 0 },
    move(id, dx, dy) {
      const t1 = performance.now()
      const b = byId.get(id)!
      b.x += dx; b.y += dy
      const s = shapes.get(id)
      if (s) router.moveShape(s, dx, dy)
      router.processTransaction()
      read()
      out.stats.moveMs = performance.now() - t1
      return out.routes
    },
    at(id) { const b = byId.get(id)!; return { x: b.x, y: b.y } },
    reset() {
      let moved = false
      for (const [id, h] of home) { const b = byId.get(id)!; if (shapes.has(id) && (b.x !== h.x || b.y !== h.y)) { router.moveShape(shapes.get(id)!, h.x - b.x, h.y - b.y); b.x = h.x; b.y = h.y; moved = true } }
      if (moved) { router.processTransaction(); read() }
      return out.routes
    },
    dispose() { router.delete() },
  }
  const read = () => {
    const failed: string[] = []
    out.routes = base.map(r => {
      const c = conns.get(r.id)
      if (!c) return r
      if (!c.hasValidRoute() || c.hasCrossingObstacles()) failed.push(r.id)
      const pts = c.displayRoute().map(p => [p.x, p.y] as [number, number])
      // an end at a tray's dock goes on to the rim's midpoint
      for (const [end, first] of [[r.from, true], [r.to, false]] as const) {
        const side = dockSide.get(`${r.id}:${end}`)
        if (!side) continue
        const m = sideMid(byId.get(end)!, side)
        if (first) pts.unshift(m); else pts.push(m)
      }
      return { ...r, points: tidy(pts) }
    })
    out.stats.failed = failed
  }
  read()
  out.stats.buildMs = performance.now() - t0
  return out
}

/** Drops repeated points and points in the middle of a straight run. */
export function tidy(p: [number, number][]): [number, number][] {
  const q: [number, number][] = []
  for (const pt of p) if (!q.length || Math.hypot(pt[0] - q[q.length - 1][0], pt[1] - q[q.length - 1][1]) > 0.5) q.push(pt)
  const out: [number, number][] = []
  for (let i = 0; i < q.length; i++) {
    const a = out[out.length - 1], b = q[i], c = q[i + 1]
    if (a && c && ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5))) continue
    out.push(b)
  }
  return out
}

// ---- the router a layout leaves behind, for dragging
// layout() routes with a router and keeps it for the scene that draws the result; it is freed when the result is collected.
const kept = new WeakMap<object, EdgeRouter>()
const freed = new FinalizationRegistry<EdgeRouter>(r => r.dispose())
export function keepRouter(result: object, r: EdgeRouter) { kept.set(result, r); freed.register(result, r) }
/**
 * The router for `result` at `level`: the one layout() kept if it has that level, else a new one (which replaces it; the old one is freed).
 * Null until the wasm has loaded. A result made by hand is routed here as laid out.
 */
export function routerFor(result: LayoutResult, level: AvoidCrossings = 'some'): EdgeRouter | null {
  const k = kept.get(result)
  if (k && k.level === level) return k
  const A = avoidLoaded()
  if (!A) return null
  const r = createRouter(A, result, TUNE, level)
  k?.dispose()
  keepRouter(result, r)
  return r
}

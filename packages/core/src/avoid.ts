// Lines routed by libavoid (BON-99), pure TypeScript on layout pixels. ELK places the boxes; one libavoid router routes
// every line, orthogonally, around blocks and around trays a line does not go into. Decisions: LOG.md, "Lines routed by libavoid (BON-99)".
//
// libavoid-js has no clusters, so a tray is four thin wall obstacles on its rim. Where a line must enter or leave a tray
// the wall is closed except for small gates, where the line's own end is, and a line that enters or leaves is routed gate to gate. Inside a tray is free.
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
  /** Keep a gate this far from a tray's corner. */
  gap: number
  /** Width of a gate in a tray's wall. */
  gate: number
  /** Thickness of a tray's wall obstacle. */
  wall: number
  /** How trays are closed: 'walls' = walls with an opening where a line enters (shipped); 'gates' = walls closed but for gate shapes, lines routed gate to gate; 'none' = trays do not block (comparison). */
  trays: 'walls' | 'gates' | 'none'
  /** Let the router nudge the stub at a pin sideways (ends then leave the side midpoint). */
  nudgeEnds: boolean
  /** libavoid's nudgeSharedPathsWithCommonEndPoint and performUnifyingNudgingPreprocessingStep options. */
  shared: boolean
  unify: boolean
}
export const TUNE: AvoidTune = { buffer: 10, nudge: 10, segment: 10, reverse: 200, crossing: 1000, dragCrossing: 0, gap: 36, gate: 8, wall: 4, trays: 'walls', nudgeEnds: false, shared: true, unify: false }

// ---- loading the wasm
let loading: Promise<Avoid> | null = null
let wasmUrl: string | undefined
/** Where the browser finds libavoid.wasm. By default the file beside this module (`./libavoid.wasm`), which Vite, webpack and Rollup turn into an asset; call this before the first layout to point elsewhere. */
export function setAvoidWasm(url: string) { wasmUrl = url }
/** Loads the wasm once. Rejects if it cannot load (the caller falls back to ELK's routes). */
export function loadAvoid(): Promise<Avoid> {
  // Node loads the wasm from disk itself; a bundled page needs a URL, and libavoid-js's own default does not survive bundling
  loading ??= AvoidLib.load(wasmUrl ?? (typeof document !== 'undefined' ? new URL('./libavoid.wasm', import.meta.url).href : undefined)).then(() => AvoidLib.getInstance()).catch(e => { loading = null; throw e })
  return loading
}
/** The loaded module, or null while it has not loaded. */
export function avoidLoaded(): Avoid | null { try { return AvoidLib.getInstance() } catch { return null } }

/** How hard the router tries not to cross lines: off, some, strong. The cost is paid when the lines are routed (about 0.8 s on 50 nodes); a drag frame always routes without it. */
export const AVOID_CROSSINGS = ['off', 'some', 'strong'] as const
export type AvoidCrossings = typeof AVOID_CROSSINGS[number]
/** Where a line meets a node: all at the middle of a side (lines to the same side share a short stub), or each at its own point along the side. */
export const ENDS = ['midpoint', 'spread'] as const
export type Ends = typeof ENDS[number]
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
  /** The crossing-avoidance level and the way ends are placed that the lines were routed with. */
  level: AvoidCrossings
  ends: Ends
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

export function createRouter(A: Avoid, data: LayoutResult, tune: AvoidTune = TUNE, level: AvoidCrossings = 'some', ends: Ends = 'midpoint'): EdgeRouter {
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

  // 'spread': every line gets its own pin. Each is put on the side the flow uses for it (or, for a line against the flow, the side that faces its other end); a side that would hold more than a third of the node's lines (at least 3) hands the extras to the neighbouring side; on each
  // side the lines are spaced evenly, in the order of their other ends so they do not cross.
  const spreadClass = new Map<string, number>() // `${edge}:${node}` -> the pin class of that end
  const spreadPins: { node: string; cls: number; side: Side; f: number }[] = []
  if (ends === 'spread') {
    const at = new Map<string, { id: string; other: [number, number]; side: Side }[]>()
    for (const r of data.routes) for (const [id, other] of [[r.from, r.to], [r.to, r.from]] as const) {
      const X = byId.get(id), O = byId.get(other)
      if (!X || X.kind !== 'node' || !O || r.from === r.to) continue
      const [xc, yc] = centre(X), [ox, oy] = centre(O)
      const dx = ox - xc, dy = oy - yc
      // the flow side (out of the bottom or right, into the top or left) when the other end lies ahead of or behind the node that way, else the side that faces it
      const lr = data.direction === 'LR', leaves = r.from === id
      const ahead = (lr ? dx : dy) > 0
      const side: Side = leaves === ahead ? (lr ? (leaves ? 'E' : 'W') : (leaves ? 'S' : 'N')) : Math.abs(dy) * X.w > Math.abs(dx) * X.h ? (dy > 0 ? 'S' : 'N') : (dx > 0 ? 'E' : 'W')
      ;(at.get(id) ?? at.set(id, []).get(id)!).push({ id: r.id, other: [ox, oy], side })
    }
    let cls = 100
    for (const [node, list] of at) {
      const X = byId.get(node)!
      const cap = Math.max(3, Math.ceil(list.length / 3))
      const count = (sd: Side) => list.filter(e => e.side === sd).length
      for (const sd of ['N', 'S', 'E', 'W'] as Side[]) {
        const mine = list.filter(e => e.side === sd)
        // the ones that point least along this side's axis move over, to the neighbour they lean towards
        const lean = (e: { other: [number, number] }): Side => (sd === 'N' || sd === 'S') ? (e.other[0] > X.x + X.w / 2 ? 'E' : 'W') : (e.other[1] > X.y + X.h / 2 ? 'S' : 'N')
        const slack = (e: { other: [number, number] }) => (sd === 'N' || sd === 'S') ? Math.abs(e.other[0] - (X.x + X.w / 2)) : Math.abs(e.other[1] - (X.y + X.h / 2))
        mine.sort((p, q) => slack(q) - slack(p))
        for (const e of mine.slice(0, Math.max(0, count(sd) - cap))) { const to = lean(e); if (count(to) < count(sd)) e.side = to }
      }
      for (const sd of ['N', 'S', 'E', 'W'] as Side[]) {
        // ends along a side in the order that keeps the lines from crossing. Top and bottom: the lines that turn left first, shallowest first, then
        // those that turn right, deepest first (a line that turns far away leaves furthest out). Left and right: the lines that go up first,
        // furthest first, then those that go down, nearest first.
        const vert = sd === 'N' || sd === 'S'
        const [xc, yc] = centre(X)
        const dist = (e: { other: [number, number] }) => Math.abs(e.other[1] - yc)
        const first = (e: { other: [number, number] }) => vert ? e.other[0] < xc : e.other[1] < yc
        const on = list.filter(e => e.side === sd)
        const mine = vert
          ? [...on.filter(first).sort((p, q) => dist(p) - dist(q)), ...on.filter(e => !first(e)).sort((p, q) => dist(q) - dist(p))]
          : [...on.filter(first).sort((p, q) => dist(q) - dist(p)), ...on.filter(e => !first(e)).sort((p, q) => dist(p) - dist(q))]
        mine.forEach((e, i) => { const c = cls++; spreadClass.set(`${e.id}:${node}`, c); spreadPins.push({ node, cls: c, side: sd, f: (i + 1) / (mine.length + 1) }) })
      }
    }
  }
  const shapes = new Map<string, ShapeRef>()
  for (const b of byId.values()) {
    if (b.kind !== 'node') continue
    const s = router.addShape(rect(b.x, b.y, b.w, b.h))
    if (ends === 'midpoint') {
      for (const [x, y, d] of [[0.5, 0, 'N'], [1, 0.5, 'E'], [0.5, 1, 'S'], [0, 0.5, 'W']] as [number, number, Side][])
        s.addPin({ classId: PIN, x, y, directions: DIR[d] }).setExclusive(false)
    } else {
      for (const p of spreadPins.filter(q => q.node === b.id)) {
        const [x, y] = p.side === 'N' ? [p.f, 0] : p.side === 'S' ? [p.f, 1] : p.side === 'W' ? [0, p.f] : [1, p.f]
        s.addPin({ classId: p.cls, x, y, directions: DIR[p.side] }).setExclusive(false)
      }
    }
    shapes.set(b.id, s)
  }

  // which edges are routed here, and the gates each passes through: a tray's wall is closed except for small gate shapes, and a line
  // that enters or leaves a tray is routed as a chain of connectors, node -> gate -> ... -> gate -> node, so it can only cross a wall at its own gates.
  const edges = data.routes.filter(r => byId.has(r.from) && byId.has(r.to) && !ancestors(r.from).includes(r.to) && !ancestors(r.to).includes(r.from))
  type Gate = { tray: string; side: Side; at: number; key: string }
  const gates = new Map<string, Gate>()
  const gatesOf = new Map<string, { exit: Gate[]; enter: Gate[] }>() // edge -> gates left through (inner first) and entered through (outer first)
  const dockSide = new Map<string, Side>() // `${edge}:${end}` -> side of the tray that the edge docks at
  const Q = tune.trays === 'gates' ? 12 : 1 // gates whose lines are this close share one (openings stay where the line's own end is)
  for (const e of edges) {
    const mine = { exit: [] as Gate[], enter: [] as Gate[] }
    for (const [end, other, list] of [[e.from, e.to, mine.exit], [e.to, e.from, mine.enter]] as const) {
      const X = byId.get(end)!, O = byId.get(other)!
      const keep = new Set(ancestors(other).concat(other))
      const oc = centre(O), xc = centre(X)
      if (X.kind === 'group') dockSide.set(`${e.id}:${end}`, exitSide(X, xc, oc))
      for (const tid of ancestors(end).filter(t => !keep.has(t))) {
        const T = byId.get(tid)!
        const side = exitSide(T, xc, oc)
        const horiz = side === 'N' || side === 'S'
        const lo = horiz ? T.x : T.y, hi = lo + (horiz ? T.w : T.h)
        const along = horiz ? xc[0] : xc[1]
        const at = Math.min(Math.max(Math.round(along / Q) * Q, lo + tune.gap / 2), hi - tune.gap / 2)
        const key = `${tid}:${side}:${at}`
        const g = gates.get(key) ?? gates.set(key, { tray: tid, side, at, key }).get(key)!
        list.push(g)
      }
    }
    mine.enter.reverse()
    gatesOf.set(e.id, mine)
  }
  // walls: four thin rects per tray. 'walls': broken where a line enters (an opening `gap` wide); 'gates': closed but for gate shapes
  const gateShape = new Map<string, ShapeRef>()
  const OUT = 2, IN = 3 // pin classes of a gate: facing out of the tray, facing into it
  const gw = tune.gate
  if (tune.trays !== 'none') for (const t of byId.values()) {
    if (t.kind !== 'group') continue
    const th = tune.wall
    for (const side of ['N', 'S', 'E', 'W'] as Side[]) {
      const horiz = side === 'N' || side === 'S'
      const lo = horiz ? t.x : t.y, hi = lo + (horiz ? t.w : t.h)
      const fixed = side === 'N' ? t.y : side === 'S' ? t.y + t.h : side === 'W' ? t.x : t.x + t.w
      const here = [...gates.values()].filter(g => g.tray === t.id && g.side === side).sort((a, b) => a.at - b.at)
      const wall = (a: number, b: number) => { if (b - a > 1) router.addShape(horiz ? rect(a, fixed - th / 2, b - a, th) : rect(fixed - th / 2, a, th, b - a)) }
      let at = lo
      if (tune.trays === 'walls') {
        const merged: [number, number][] = []
        for (const g of here) { const iv: [number, number] = [g.at - tune.gap / 2, g.at + tune.gap / 2]; const l = merged[merged.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else merged.push(iv) }
        for (const iv of merged) { wall(at, iv[0]); at = iv[1] }
        wall(at, hi)
        continue
      }
      for (const g of here) {
        wall(at, g.at - gw / 2 - tune.buffer) // the wall stops a buffer short, so the gate's pins are not inside its buffer; the gate's own buffer closes the gap
        const gs = router.addShape(horiz ? rect(g.at - gw / 2, fixed - th / 2, gw, th) : rect(fixed - th / 2, g.at - gw / 2, th, gw))
        // the pin facing out sits on the outer face of the wall, the one facing in on the inner face
        const outer = side === 'N' ? [0.5, 0] : side === 'S' ? [0.5, 1] : side === 'W' ? [0, 0.5] : [1, 0.5]
        const inner = [1 - outer[0], 1 - outer[1]] as number[]
        gs.addPin({ classId: OUT, x: outer[0], y: outer[1], directions: DIR[side] }).setExclusive(false)
        gs.addPin({ classId: IN, x: inner[0], y: inner[1], directions: DIR[OPP[side]] }).setExclusive(false)
        gateShape.set(g.key, gs)
        at = g.at + gw / 2 + tune.buffer
      }
      wall(at, hi)
    }
  }
  // an edge to a tray itself ends at a free point just outside the rim's midpoint on the side facing the other end (no obstacle: a shape there would block the narrow room between nested trays)
  const DOCK_OUT = 14 // clear of the rim wall and its buffer
  const dockPoint = (tray: string, side: Side) => {
    const T = byId.get(tray)!
    const [mx, my] = sideMid(T, side)
    const n = side === 'N' ? [0, -1] : side === 'S' ? [0, 1] : side === 'E' ? [1, 0] : [-1, 0]
    return { x: mx + n[0] * DOCK_OUT, y: my + n[1] * DOCK_OUT, directions: DIR[side] }
  }

  // one connector per hop of each edge
  const conns = new Map<string, ConnRef[]>()
  for (const e of edges) {
    const end = (id: string) => byId.get(id)!.kind === 'group' ? { point: dockPoint(id, dockSide.get(`${e.id}:${id}`)!) } : { shape: shapes.get(id)! }
    const g = gatesOf.get(e.id)!
    // waypoints: the pin a hop leaves from and the pin the next one arrives at
    const gated = tune.trays === 'gates'
    type Hop = { shape?: ShapeRef; point?: { x: number; y: number; directions: number }; leave: number; arrive: number }
    const hops: Hop[] = [
      { ...end(e.from), leave: spreadClass.get(`${e.id}:${e.from}`) ?? PIN, arrive: PIN },
      ...(gated ? g.exit : []).map(x => ({ shape: gateShape.get(x.key)!, leave: OUT, arrive: IN })), // coming from inside: arrive at the inner face, leave by the outer
      ...(gated ? g.enter : []).map(x => ({ shape: gateShape.get(x.key)!, leave: IN, arrive: OUT })), // coming from outside: arrive at the outer face, leave by the inner
      { ...end(e.to), leave: PIN, arrive: spreadClass.get(`${e.id}:${e.to}`) ?? PIN },
    ]
    const list: ConnRef[] = []
    const at = (h: Hop, pin: number) => h.point ?? { shape: h.shape!, pin }
    for (let i = 0; i + 1 < hops.length; i++) list.push(router.addConnector(at(hops[i], hops[i].leave), at(hops[i + 1], hops[i + 1].arrive)))
    conns.set(e.id, list)
  }
  router.processTransaction()
  router.setRoutingParameter(P.crossingPenalty, tune.dragCrossing)

  const out: EdgeRouter = {
    level, ends, routes: [], stats: { buildMs: 0, failed: [], moveMs: 0 },
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
      const list = conns.get(r.id)
      if (!list) return r
      let pts: [number, number][] = []
      for (const c of list) {
        if (!c.hasValidRoute() || c.hasCrossingObstacles()) { if (!failed.includes(r.id)) failed.push(r.id) }
        pts = pts.concat(c.displayRoute().map(p => [p.x, p.y] as [number, number]))
      }
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
 * The router for `result` at `level` and `ends`: the one layout() kept if it has them, else a new one (which replaces it; the old one is freed).
 * Null until the wasm has loaded. A result made by hand is routed here as laid out.
 */
export function routerFor(result: LayoutResult, level: AvoidCrossings = 'some', ends: Ends = 'midpoint'): EdgeRouter | null {
  const k = kept.get(result)
  if (k && k.level === level && k.ends === ends) return k
  const A = avoidLoaded()
  if (!A) return null
  const r = createRouter(A, result, TUNE, level, ends)
  k?.dispose()
  keepRouter(result, r)
  return r
}

// Lines routed by libavoid (BON-99/BON-100), pure TypeScript on layout pixels. ELK places the boxes; one libavoid router routes
// every line, orthogonally, around blocks and around trays a line does not go into. Decisions: LOG.md, "Edges in 3D, routed by libavoid (BON-100)".
//
// libavoid-js has no clusters, so a tray is four thin wall obstacles on its rim, with an opening where a line must go in or out
// (where that line's own end is, so it goes straight through). Inside a tray is free. An edge to a tray itself ends at a free point
// just outside the middle of the rim on the side facing the other end, then goes on to the rim.
// A line libavoid routes with a U-turn, or through a tray it does not belong to, is replaced by the most direct route that
// avoids every block and foreign tray, when there is one (monotone.ts).
// Imported by node tests and scripts: explicit .ts extensions, no .tsx.
import { AvoidLib } from 'libavoid-js'
import type { Avoid, Router, ShapeRef, ConnRef } from 'libavoid-js'
import type { Box, LayoutResult, Route } from './model.ts'
import { straighten, refine, type StraightenCache } from './monotone.ts'

export interface AvoidTune {
  /** Space kept between a line and a block it passes (px of layout). */
  buffer: number
  /** Space between parallel lines. */
  nudge: number
  /** Cost of a bend. */
  segment: number
  /** Cost of a move back against the line's own direction. */
  reverse: number
  /** Cost of crossing another line while a node is dragged: 0, so a drag frame takes a few ms instead of most of a second. */
  dragCrossing: number
  /** Width of the opening cut in a tray's wall where a line goes in or out. */
  gap: number
  /** Thickness of a tray's wall obstacle. */
  wall: number
  /** Give a line that libavoid sends back on itself, or through a foreign tray, the direct route (monotone.ts). Off only to compare. */
  straighten: boolean
}
export const TUNE: Readonly<AvoidTune> = Object.freeze({ buffer: 10, nudge: 10, segment: 10, reverse: 200, dragCrossing: 0, gap: 36, wall: 4, straighten: true })

/** How hard the router tries not to cross lines. The cost is paid when the lines are routed (about 1 s on 50 nodes at 'some'); a drag frame always routes without it. */
export const AVOID_CROSSINGS = ['off', 'some', 'strong'] as const
export type AvoidCrossings = typeof AVOID_CROSSINGS[number]
export const CROSSING_COST: Readonly<Record<AvoidCrossings, number>> = Object.freeze({ off: 0, some: 1000, strong: 3000 })
/** How many more lines a direct route may cross than the route libavoid found before the line keeps libavoid's route, sideways
 * jog and all. Off and some: any number (every line goes direct when it can). Strong: none (a line may jog aside to cross fewer lines). */
export const SLACK: Readonly<Record<AvoidCrossings, number>> = Object.freeze({ off: Infinity, some: Infinity, strong: 0 })

// ---- loading the wasm
let loading: Promise<Avoid> | null = null
let wasmUrl: string | undefined
/** Where the browser finds libavoid.wasm. By default the file beside this module (`./libavoid.wasm`), which Vite, webpack and Rollup turn into an asset; call this before the first layout to point elsewhere. */
export function setAvoidWasm(url: string) { wasmUrl = url }
/** Loads the wasm once. Rejects if it cannot load (the caller falls back to ELK's routes); a later call tries again. */
export function loadAvoid(): Promise<Avoid> {
  // Node loads the wasm from disk itself; a bundled page needs a URL, and libavoid-js's own default does not survive bundling
  loading ??= AvoidLib.load(wasmUrl ?? (typeof document !== 'undefined' ? new URL('./libavoid.wasm', import.meta.url).href : undefined)).then(() => AvoidLib.getInstance()).catch(e => { loading = null; throw e })
  return loading
}
/** The loaded module, or null while it has not loaded. */
export function avoidLoaded(): Avoid | null { try { return AvoidLib.getInstance() } catch { return null } }

export interface RouterStats {
  /** Time to build the router and route every line, ms. */
  buildMs: number
  /** Lines libavoid could not route (no valid route, or one that still crosses an obstacle). */
  failed: string[]
  /** Lines whose libavoid route made a U-turn or crossed a foreign tray and were given the direct route instead. */
  straightened: number
  /** Lines that still turn back because no route to their target can avoid it (it sits behind a block or tray they must go round). */
  forced: number
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

export type Side = 'N' | 'S' | 'E' | 'W'
const PIN = 1 // a pin at each side's midpoint: the router picks the side
const SIDE_PIN: Record<Side, number> = { N: 11, S: 12, E: 13, W: 14 } // one side only
const SIDES: [number, number, Side][] = [[0.5, 0, 'N'], [1, 0.5, 'E'], [0.5, 1, 'S'], [0, 0.5, 'W']]

/** The side of `t` a line from `from` (inside it) towards `to` leaves by. */
export function exitSide(t: Box, from: [number, number], to: [number, number]): Side {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  let tx = Infinity, ty = Infinity
  if (dx > 0) tx = (t.x + t.w - from[0]) / dx; else if (dx < 0) tx = (t.x - from[0]) / dx
  if (dy > 0) ty = (t.y + t.h - from[1]) / dy; else if (dy < 0) ty = (t.y - from[1]) / dy
  return tx < ty ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N')
}
const centre = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2]
export const sideMid = (b: Box, s: Side): [number, number] => s === 'N' ? [b.x + b.w / 2, b.y] : s === 'S' ? [b.x + b.w / 2, b.y + b.h] : s === 'E' ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2]
/** How far outside a tray's rim an edge to the tray itself is routed to, before it goes on to the rim: clear of the wall and its buffer. */
export const DOCK_OUT = 14

export function createRouter(A: Avoid, data: LayoutResult, level: AvoidCrossings = 'some', tune: AvoidTune = TUNE): EdgeRouter {
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
  router.setRoutingParameter(P.crossingPenalty, CROSSING_COST[level])
  // ends are never nudged off their side midpoint; lines sharing a pin are; the unifying pre-step is off (90% of a drag frame's cost)
  router.setRoutingOption(A.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes, false)
  router.setRoutingOption(A.RoutingOption.nudgeSharedPathsWithCommonEndPoint, true)
  router.setRoutingOption(A.RoutingOption.performUnifyingNudgingPreprocessingStep, false)
  const D = A.ConnDirFlag
  const DIR: Record<Side, number> = { N: D.ConnDirUp, S: D.ConnDirDown, E: D.ConnDirRight, W: D.ConnDirLeft }
  const rect = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h })

  const shapes = new Map<string, ShapeRef>()
  for (const b of byId.values()) {
    if (b.kind !== 'node') continue
    const s = router.addShape(rect(b.x, b.y, b.w, b.h))
    // the one-side pins sit a hair off the midpoint so libavoid keeps them apart; tidy() straightens the difference
    for (const [x, y, d] of SIDES) {
      s.addPin({ classId: PIN, x, y, directions: DIR[d] }).setExclusive(false)
      s.addPin({ classId: SIDE_PIN[d], x: x + (d === 'N' || d === 'S' ? 0.002 : 0), y: y + (d === 'E' || d === 'W' ? 0.002 : 0), directions: DIR[d] }).setExclusive(false)
    }
    shapes.set(b.id, s)
  }

  // the edges routed here: not those between a tray and something inside it
  const edges = data.routes.filter(r => byId.has(r.from) && byId.has(r.to) && !ancestors(r.from).includes(r.to) && !ancestors(r.to).includes(r.from))
  // Where each line goes through a tray's rim: on the side facing its other end, at its own end's position along that side.
  type Door = { tray: string; side: Side; at: number }
  let doors: Door[] = []
  const dockSide = new Map<string, Side>() // `${edge}:${end}` -> side of the tray an edge to a tray itself docks at
  const doorOf = new Map<string, Side>() // `${edge}:${end}` -> side of the first tray that end goes out through
  const computeDoors = () => {
    doors = []; dockSide.clear(); doorOf.clear()
    for (const e of edges) for (const [end, other] of [[e.from, e.to], [e.to, e.from]] as const) {
      const X = byId.get(end)!, O = byId.get(other)!
      const keep = new Set(ancestors(other).concat(other))
      const oc = centre(O), xc = centre(X)
      if (X.kind === 'group') dockSide.set(`${e.id}:${end}`, exitSide(X, xc, oc))
      for (const tid of ancestors(end).filter(t => !keep.has(t))) {
        const T = byId.get(tid)!
        const side = exitSide(T, xc, oc)
        const horiz = side === 'N' || side === 'S'
        const lo = horiz ? T.x : T.y, hi = lo + (horiz ? T.w : T.h)
        doors.push({ tray: tid, side, at: Math.min(Math.max(horiz ? xc[0] : xc[1], lo + tune.gap / 2), hi - tune.gap / 2) })
        if (!doorOf.has(`${e.id}:${end}`)) doorOf.set(`${e.id}:${end}`, side)
      }
    }
  }
  computeDoors()
  // four thin walls per tray, broken by an opening `gap` wide at each door (overlapping openings merge)
  const wallShapes = new Map<string, ShapeRef[]>()
  const wallSig = new Map<string, string>()
  const doorSig = (t: Box) => doors.filter(d => d.tray === t.id).map(d => `${d.side}${Math.round(d.at)}`).sort().join('|')
  const buildWalls = (t: Box) => {
    for (const old of wallShapes.get(t.id) ?? []) router.deleteShape(old)
    const mine: ShapeRef[] = []
    wallShapes.set(t.id, mine)
    wallSig.set(t.id, doorSig(t))
    const th = tune.wall
    for (const side of ['N', 'S', 'E', 'W'] as Side[]) {
      const horiz = side === 'N' || side === 'S'
      const lo = horiz ? t.x : t.y, hi = lo + (horiz ? t.w : t.h)
      const fixed = side === 'N' ? t.y : side === 'S' ? t.y + t.h : side === 'W' ? t.x : t.x + t.w
      const wall = (a: number, b: number) => { if (b - a > 1) mine.push(router.addShape(horiz ? rect(a, fixed - th / 2, b - a, th) : rect(fixed - th / 2, a, th, b - a))) }
      const open: [number, number][] = []
      for (const d of doors.filter(d => d.tray === t.id && d.side === side).sort((a, b) => a.at - b.at)) {
        const iv: [number, number] = [d.at - tune.gap / 2, d.at + tune.gap / 2], l = open[open.length - 1]
        if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else open.push(iv)
      }
      let at = lo
      for (const iv of open) { wall(at, iv[0]); at = iv[1] }
      wall(at, hi)
    }
  }
  const rebuildWalls = () => { for (const t of byId.values()) if (t.kind === 'group' && doorSig(t) !== wallSig.get(t.id)) buildWalls(t) }
  for (const t of byId.values()) if (t.kind === 'group') buildWalls(t)
  const dockPoint = (tray: string, side: Side) => {
    const [mx, my] = sideMid(byId.get(tray)!, side)
    const n = side === 'N' ? [0, -1] : side === 'S' ? [0, 1] : side === 'E' ? [1, 0] : [-1, 0]
    return { x: mx + n[0] * DOCK_OUT, y: my + n[1] * DOCK_OUT, directions: DIR[side] }
  }
  // An end that goes out through a tray's door leaves its node by the side facing that door, so it does not loop round to it.
  const endOf = (e: Route, end: string) => {
    const key = `${e.id}:${end}`
    if (byId.get(end)!.kind === 'group') return dockPoint(end, dockSide.get(key)!)
    const d = doorOf.get(key)
    return { shape: shapes.get(end)!, pin: d ? SIDE_PIN[d] : PIN }
  }

  const conns = new Map<string, ConnRef>()
  for (const e of edges) conns.set(e.id, router.addConnector(endOf(e, e.from), endOf(e, e.to)))
  router.processTransaction()
  router.setRoutingParameter(P.crossingPenalty, tune.dragCrossing)

  // After a node moves: the doors move to where the lines now go in and out, and a line whose door changed leaves by the side facing it.
  const followDoors = () => {
    const prevDoor = new Map(doorOf), prevDock = new Map(dockSide)
    computeDoors()
    rebuildWalls()
    for (const e of edges) {
      const c = conns.get(e.id)!
      for (const [end, isFrom] of [[e.from, true], [e.to, false]] as const) {
        const key = `${e.id}:${end}`
        const changed = byId.get(end)!.kind === 'group' ? dockSide.get(key) !== prevDock.get(key) : doorOf.get(key) !== prevDoor.get(key)
        if (changed) { const x = endOf(e, end); if (isFrom) c.setSource(x); else c.setDest(x) }
      }
    }
  }
  const out: EdgeRouter = {
    level, routes: [], stats: { buildMs: 0, failed: [], straightened: 0, forced: 0, moveMs: 0 },
    move(id, dx, dy) {
      const t1 = performance.now()
      const b = byId.get(id)!
      b.x += dx; b.y += dy
      const s = shapes.get(id)
      if (s) router.moveShape(s, dx, dy)
      followDoors()
      router.processTransaction()
      read()
      out.stats.moveMs = performance.now() - t1
      return out.routes
    },
    at(id) { const b = byId.get(id)!; return { x: b.x, y: b.y } },
    reset() {
      let moved = false
      for (const [id, h] of home) {
        const b = byId.get(id)!
        if (shapes.has(id) && (b.x !== h.x || b.y !== h.y)) { router.moveShape(shapes.get(id)!, h.x - b.x, h.y - b.y); b.x = h.x; b.y = h.y; moved = true }
      }
      // with every node home the routes are the ones first made (routed with the crossing cost a drag frame does without)
      if (moved) { followDoors(); router.processTransaction(); read(); out.routes = first }
      return out.routes
    },
    dispose() { router.delete() },
  }
  const cache: StraightenCache = new Map()
  const read = () => {
    const failed: string[] = []
    const routed = base.map(r => {
      const c = conns.get(r.id)
      if (!c) return r
      if (!c.hasValidRoute() || c.hasCrossingObstacles()) failed.push(r.id)
      const pts = c.displayRoute().map(p => [p.x, p.y] as [number, number])
      // an end at a tray's dock goes on to the rim's midpoint
      const ds = dockSide.get(`${r.id}:${r.from}`), dt = dockSide.get(`${r.id}:${r.to}`)
      if (ds) pts.unshift(sideMid(byId.get(r.from)!, ds))
      if (dt) pts.push(sideMid(byId.get(r.to)!, dt))
      return { ...r, points: tidy(pts) }
    })
    const boxes = [...byId.values()]
    let s = tune.straighten ? straighten(boxes, routed, tune.buffer, CROSSING_COST[level], SLACK[level], cache) : { routes: routed, changed: 0, forced: 0, forcedIds: [] as string[] }
    // when the layout is first routed: lines left turning back get a second try, settled before the others; the better of the two is kept
    if (tune.straighten && s.forced && !out.routes.length) {
      const again = straighten(boxes, routed, tune.buffer, CROSSING_COST[level], SLACK[level], undefined, new Set(s.forcedIds))
      if (again.forced < s.forced) { s = again; cache.clear() }
    }
    // when first routed with a crossing cost: rip up and re-route the direct lines against the others as they now are
    if (tune.straighten && !out.routes.length && CROSSING_COST[level] > 0) s = { ...s, routes: refine(boxes, s.routes, tune.buffer, CROSSING_COST[level]).routes }
    out.routes = s.routes
    out.stats.failed = failed
    out.stats.straightened = s.changed
    out.stats.forced = s.forced
  }
  read()
  const first = out.routes
  out.stats.buildMs = performance.now() - t0
  return out
}

/** Drops repeated points and points in the middle of a straight run. */
export function tidy(p: [number, number][]): [number, number][] {
  const q: [number, number][] = []
  for (const pt of p) if (!q.length || Math.hypot(pt[0] - q[q.length - 1][0], pt[1] - q[q.length - 1][1]) > 0.5) q.push(pt)
  // pins on the same spot are offset by a fraction of a pixel; make those runs exactly straight
  for (let i = 1; i < q.length; i++) {
    if (Math.abs(q[i][0] - q[i - 1][0]) < 0.5) q[i] = [q[i - 1][0], q[i][1]]
    if (Math.abs(q[i][1] - q[i - 1][1]) < 0.5) q[i] = [q[i][0], q[i - 1][1]]
  }
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
  const r = createRouter(A, result, level)
  k?.dispose()
  keepRouter(result, r)
  return r
}

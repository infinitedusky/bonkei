// Mockup (BON-99): route a laid-out diagram's edges with libavoid instead of ELK's own routes.
// ELK still places the boxes; libavoid draws orthogonal lines around them, from a pin at the middle of one side of
// each end (the router picks the side). libavoid-js has no clusters, so trays are handled per line: the trays its own
// ends sit in are open to it, every other tray is a block. Lines with the same open trays share one router, so they
// are nudged apart from each other; lines in different routers are not.
import type { Avoid, Router, ShapeRef, ConnRef } from 'libavoid-js'
import type { Box, LayoutResult, Route } from 'bonkei/internal'

export interface AvoidTune {
  /** Space kept between a line and a block it passes (px of layout). */
  buffer: number
  /** Space between parallel lines. */
  nudge: number
  /** Cost of a bend. */
  segment: number
  /** Cost of a move back against the line's own direction. */
  reverse: number
  /** Cost of crossing another line (0 = off; it is slow on big diagrams). */
  crossing: number
}
export const TUNE: AvoidTune = { buffer: 10, nudge: 8, segment: 30, reverse: 0, crossing: 0 }

const PIN = 1

export interface Avoided {
  routes: Route[]
  /** Moves a box (a node or a tray, with everything in it) and re-routes; returns the new routes. */
  move(id: string, dx: number, dy: number): Route[]
  /** Lines libavoid could not route (it fell back to a straight line) or that still cross a block. */
  failed: string[]
  ms: number
  dispose(): void
}

export function avoidRoutes(A: Avoid, data: LayoutResult, tune: AvoidTune = TUNE): Avoided {
  const t0 = performance.now()
  const byId = new Map(data.boxes.map(b => [b.id, b]))
  const ancestors = (id: string) => { const l: string[] = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) l.push(p); return l }
  const boxes = new Map(data.boxes.map(b => [b.id, { ...b }]))

  // One router per set of open trays.
  type Lane = { router: Router; shapes: Map<string, ShapeRef>; conns: Map<string, ConnRef> }
  const lanes = new Map<string, Lane>()
  const laneOf = new Map<string, Lane>()
  const D = A.ConnDirFlag
  const sides = [
    { x: 0.5, y: 0, dir: D.ConnDirUp }, { x: 1, y: 0.5, dir: D.ConnDirRight },
    { x: 0.5, y: 1, dir: D.ConnDirDown }, { x: 0, y: 0.5, dir: D.ConnDirLeft },
  ]
  const rect = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h })
  const newLane = (open: Set<string>): Lane => {
    const router = new A.Router(A.RouterFlag.OrthogonalRouting)
    const P = A.RoutingParameter
    router.setRoutingParameter(P.shapeBufferDistance, tune.buffer)
    router.setRoutingParameter(P.idealNudgingDistance, tune.nudge)
    router.setRoutingParameter(P.segmentPenalty, tune.segment)
    router.setRoutingParameter(P.reverseDirectionPenalty, tune.reverse)
    router.setRoutingParameter(P.crossingPenalty, tune.crossing)
    router.setRoutingOption(A.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes, true)
    router.setRoutingOption(A.RoutingOption.nudgeSharedPathsWithCommonEndPoint, true)
    const shapes = new Map<string, ShapeRef>()
    for (const b of boxes.values()) {
      if (b.kind === 'group' && open.has(b.id)) continue
      if (ancestors(b.id).some(a => !open.has(a))) continue // inside a closed tray: the tray blocks for it
      const s = router.addShape(rect(b))
      for (const p of sides) s.addPin({ classId: PIN, x: p.x, y: p.y, directions: p.dir }).setExclusive(false)
      shapes.set(b.id, s)
    }
    return { router, shapes, conns: new Map() }
  }

  for (const r of data.routes) {
    if (!byId.has(r.from) || !byId.has(r.to)) continue
    const open = new Set([...ancestors(r.from), ...ancestors(r.to)])
    if (open.has(r.from) || open.has(r.to)) continue // an edge to its own tray
    const key = [...open].sort().join('|')
    let lane = lanes.get(key)
    if (!lane) { lane = newLane(open); lanes.set(key, lane) }
    const c = lane.router.addConnector({ shape: lane.shapes.get(r.from)!, pin: PIN }, { shape: lane.shapes.get(r.to)!, pin: PIN })
    lane.conns.set(r.id, c)
    laneOf.set(r.id, lane)
  }
  for (const l of lanes.values()) l.router.processTransaction()

  const read = (): { routes: Route[]; failed: string[] } => {
    const failed: string[] = []
    const routes = data.routes.map(r => {
      const c = laneOf.get(r.id)?.conns.get(r.id)
      if (!c) return r
      if (!c.hasValidRoute() || c.hasCrossingObstacles()) failed.push(r.id)
      return { ...r, points: c.displayRoute().map(p => [p.x, p.y] as [number, number]) }
    })
    return { routes, failed }
  }
  const first = read()
  const out: Avoided = {
    routes: first.routes, failed: first.failed, ms: performance.now() - t0,
    move(id, dx, dy) {
      const moved = [id, ...[...boxes.values()].filter(b => ancestors(b.id).includes(id)).map(b => b.id)]
      for (const m of moved) { const b = boxes.get(m)!; b.x += dx; b.y += dy }
      for (const l of lanes.values()) {
        for (const m of moved) { const s = l.shapes.get(m); if (s) l.router.moveShape(s, dx, dy) }
        l.router.processTransaction()
      }
      const r = read()
      out.routes = r.routes; out.failed = r.failed
      return r.routes
    },
    dispose() { for (const l of lanes.values()) l.router.delete() },
  }
  return out
}

/** The same metrics as BON-85's route-metrics script, plus lines lying on top of each other. */
export function routeMetrics(data: LayoutResult, routes: Route[]) {
  let len = 0, bends = 0, back = 0, ratio = 0
  const backIds: string[] = []
  for (const e of routes) {
    const p = e.points
    const seen = [0, 0]
    let rev = false, l = 0
    for (let i = 1; i < p.length; i++) {
      const d = [p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]]
      l += Math.abs(d[0]) + Math.abs(d[1])
      for (const a of [0, 1]) {
        const s = Math.sign(Math.round(d[a]))
        if (!s) continue
        if (seen[a] && seen[a] !== s) rev = true
        seen[a] = seen[a] || s
      }
    }
    const direct = Math.abs(p[p.length - 1][0] - p[0][0]) + Math.abs(p[p.length - 1][1] - p[0][1])
    len += l; bends += p.length - 2; ratio += l / Math.max(direct, 1)
    if (rev) { back++; backIds.push(e.id) }
  }
  const nodes = data.boxes.filter(b => b.kind === 'node')
  const segs = routes.flatMap((e, ri) => e.points.slice(1).map((q, i) => ({ ri, a: e.points[i], b: q, e })))
  let through = 0, cross = 0, overlap = 0
  const throughIds = new Set<string>()
  for (const s of segs) for (const n of nodes) {
    if (n.id === s.e.from || n.id === s.e.to) continue
    const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1])
    if (x1 > n.x && x0 < n.x + n.w && y1 > n.y && y0 < n.y + n.h) { through++; throughIds.add(s.e.id) }
  }
  for (const h of segs) for (const v of segs) {
    if (h.ri >= v.ri) continue
    const hz = (s: typeof h) => Math.abs(s.a[1] - s.b[1]) < 0.5
    // collinear and overlapping by more than a few px, ends excluded
    if (hz(h) && hz(v) && Math.abs(h.a[1] - v.a[1]) < 0.5) {
      const o = Math.min(Math.max(h.a[0], h.b[0]), Math.max(v.a[0], v.b[0])) - Math.max(Math.min(h.a[0], h.b[0]), Math.min(v.a[0], v.b[0]))
      if (o > 4) overlap++
    } else if (!hz(h) && !hz(v) && Math.abs(h.a[0] - v.a[0]) < 0.5) {
      const o = Math.min(Math.max(h.a[1], h.b[1]), Math.max(v.a[1], v.b[1])) - Math.max(Math.min(h.a[1], h.b[1]), Math.min(v.a[1], v.b[1]))
      if (o > 4) overlap++
    }
  }
  for (const h of segs) for (const v of segs) {
    if (h.ri === v.ri || Math.abs(h.a[1] - h.b[1]) > 0.5 || Math.abs(v.a[0] - v.b[0]) > 0.5) continue
    if (v.a[0] > Math.min(h.a[0], h.b[0]) + 0.5 && v.a[0] < Math.max(h.a[0], h.b[0]) - 0.5 && h.a[1] > Math.min(v.a[1], v.b[1]) + 0.5 && h.a[1] < Math.max(v.a[1], v.b[1]) - 0.5) cross++
  }
  return { routes: routes.length, len: Math.round(len), bends, back, backIds, through, throughIds: [...throughIds], cross, overlap, ratio: +(ratio / Math.max(routes.length, 1)).toFixed(2) }
}

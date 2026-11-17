// Direct routes for the lines libavoid gets wrong (BON-100). libavoid has no "never turn back" rule: with tray openings fixed
// where a line's own end is, and with the crossing cost on, it sometimes leaves a node, heads off and comes back (a U-turn),
// and now and then slips through another line's opening in a tray it does not belong to. For those lines only:
// - a monotone route is looked for: every step brings the line nearer its target along x and along y, so it is as short as the
//   two side midpoints allow. It keeps `buffer` away from every block and every tray the line does not go into, leaves and
//   arrives square to a side, and lies on no other line. Of those, the one with the fewest crossings and bends wins.
// - if there is none (the target sits behind a block or a tray the line has to go round), the line keeps libavoid's route, or,
//   if that goes through a block or a foreign tray, takes the cheapest route round them on the same grid.
// Decisions: LOG.md, "Edges in 3D, routed by libavoid (BON-100)". Pure, on layout pixels. Imported by node tests: explicit .ts extensions.
import type { Box, Route } from './model.ts'

type Pt = [number, number]
type Side = 'N' | 'S' | 'E' | 'W'
type Rect = { x0: number; y0: number; x1: number; y1: number }
type Seg = { a: Pt; b: Pt }
const NORMAL: Record<Side, Pt> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }
const SIDES: Side[] = ['N', 'S', 'E', 'W']
const mid = (b: Box, s: Side): Pt => s === 'N' ? [b.x + b.w / 2, b.y] : s === 'S' ? [b.x + b.w / 2, b.y + b.h] : s === 'E' ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2]

/** The cost of a bend and of lying on another line (plus as much per px), against 1 per px of length. A crossing costs what the caller says. */
export const COST = { bend: 12, overlap: 1000 }
/** A line leaves and arrives square to its side for at least this long. */
export const STUB = 12
/** The largest grid searched (cells); a bigger diagram keeps libavoid's route. */
const MAX_CELLS = 250000

/** Does the route move one way along x (or y) and later the other way? */
export function doublesBack(p: Pt[]): boolean {
  const seen = [0, 0]
  for (let i = 1; i < p.length; i++) for (const a of [0, 1]) {
    const s = Math.sign(Math.round(p[i][a] - p[i - 1][a]))
    if (!s) continue
    if (seen[a] && seen[a] !== s) return true
    seen[a] = seen[a] || s
  }
  return false
}

const inside = (x: number, y: number, r: Rect) => x > r.x0 + 1e-6 && x < r.x1 - 1e-6 && y > r.y0 + 1e-6 && y < r.y1 - 1e-6
const segHits = (a: Pt, b: Pt, r: Rect) =>
  Math.max(a[0], b[0]) > r.x0 + 1e-6 && Math.min(a[0], b[0]) < r.x1 - 1e-6 && Math.max(a[1], b[1]) > r.y0 + 1e-6 && Math.min(a[1], b[1]) < r.y1 - 1e-6

/** The obstacles of one line: every block but its own ends (grown by `buffer`), every tray neither end is in (grown), and its own ends as they are. */
function obstaclesOf(boxes: Box[], r: Route, buffer: number): Rect[] {
  const by = new Map(boxes.map(b => [b.id, b]))
  const anc = (id: string) => { const l = new Set<string>(); for (let p = by.get(id)?.parent; p; p = by.get(p)?.parent) l.add(p); return l }
  const open = new Set([...anc(r.from), ...anc(r.to)])
  const out: Rect[] = []
  for (const b of boxes) {
    if (open.has(b.id)) continue
    const g = b.id === r.from || b.id === r.to ? 0 : buffer
    out.push({ x0: b.x - g, y0: b.y - g, x1: b.x + b.w + g, y1: b.y + b.h + g })
  }
  return out
}

/** Does this route go through a block or a tray it does not belong to (more than 1 px in)? */
export function blocked(boxes: Box[], r: Route): boolean {
  const rects = obstaclesOf(boxes, r, 0).map(o => ({ x0: o.x0 + 1, y0: o.y0 + 1, x1: o.x1 - 1, y1: o.y1 - 1 }))
  return r.points.slice(1).some((q, i) => rects.some(o => segHits(r.points[i], q, o)))
}

// A grid of the coordinates that matter in [lo, hi] (the ends, their stubs, every obstacle edge, and lanes a third and two thirds
// across each gap wider than 20 px), with the cost of every move worked out once: hc[i*Y+j] from (i, j) to (i+1, j), vc to (i, j+1).
// Infinity through an obstacle; `cross` per line crossed; COST.overlap (and per px) lying on another line.
function grid(lo: Pt, hi: Pt, ends: Pt[], obstacles: Rect[], others: Seg[], cross: number) {
  const near = obstacles.filter(o => o.x1 >= lo[0] && o.x0 <= hi[0] && o.y1 >= lo[1] && o.y0 <= hi[1])
  const segs = others.filter(g => Math.max(g.a[0], g.b[0]) >= lo[0] && Math.min(g.a[0], g.b[0]) <= hi[0] && Math.max(g.a[1], g.b[1]) >= lo[1] && Math.min(g.a[1], g.b[1]) <= hi[1])
  const coords = (k: 0 | 1) => {
    const s = new Set<number>(ends.map(p => p[k]))
    for (const o of near) { s.add(k ? o.y0 : o.x0); s.add(k ? o.y1 : o.x1) }
    const v = [...s].filter(c => c >= lo[k] - 1e-6 && c <= hi[k] + 1e-6).sort((a, b) => a - b)
    const out: number[] = []
    for (let i = 0; i < v.length; i++) {
      if (i && v[i] - v[i - 1] > 20) for (const f of [1 / 3, 2 / 3]) out.push(v[i - 1] + (v[i] - v[i - 1]) * f)
      if (!out.length || v[i] - out[out.length - 1] > 0.5) out.push(v[i])
    }
    return out
  }
  const xs = coords(0), ys = coords(1)
  const X = xs.length, Y = ys.length
  if (X * Y > MAX_CELLS) return null
  const hc = new Float64Array(X * Y), vc = new Float64Array(X * Y)
  const spans = (cs: number[], a: number, b: number) => { const r: number[] = []; for (let i = 0; i + 1 < cs.length; i++) { const m = (cs[i] + cs[i + 1]) / 2; if (m > a && m < b) r.push(i) } return r }
  const within = (cs: number[], a: number, b: number) => { const r: number[] = []; for (let i = 0; i < cs.length; i++) if (cs[i] > a + 1e-6 && cs[i] < b - 1e-6) r.push(i); return r }
  for (const o of near) {
    for (const i of spans(xs, o.x0, o.x1)) for (const j of within(ys, o.y0, o.y1)) hc[i * Y + j] = Infinity
    for (const i of within(xs, o.x0, o.x1)) for (const j of spans(ys, o.y0, o.y1)) vc[i * Y + j] = Infinity
  }
  for (const g of segs) {
    const horiz = Math.abs(g.a[1] - g.b[1]) < 0.5, vert = Math.abs(g.a[0] - g.b[0]) < 0.5
    if (horiz === vert) continue
    const k = horiz ? 0 : 1, along = k ? ys : xs, across = k ? xs : ys
    const g0 = Math.min(g.a[k], g.b[k]), g1 = Math.max(g.a[k], g.b[k]), at = g.a[1 - k]
    // lying on it: moves along the same line, overlapping it
    const row = across.findIndex(c => Math.abs(c - at) < 0.5)
    if (row >= 0) for (let i = 0; i + 1 < along.length; i++) {
      const o = Math.min(g1, along[i + 1]) - Math.max(g0, along[i])
      if (o > 0.5) { const c = COST.overlap + o * COST.overlap; if (k) vc[row * Y + i] += c; else hc[i * Y + row] += c }
    }
    // crossing it: moves across it, between the two grid lines either side of it, strictly inside its run
    const col = across.findIndex((c, i) => i + 1 < across.length && at > c + 0.5 && at < across[i + 1] - 0.5)
    if (col >= 0) for (let i = 0; i < along.length; i++) if (along[i] > g0 + 0.5 && along[i] < g1 - 0.5) { if (k) hc[col * Y + i] += cross; else vc[i * Y + col] += cross }
  }
  const index = (cs: number[], v: number) => cs.findIndex(c => Math.abs(c - v) < 0.6)
  return { xs, ys, X, Y, hc, vc, index }
}

// The corners of a path through grid cells.
function corners(cells: Pt[]): Pt[] {
  const pts: Pt[] = [cells[0]]
  for (let i = 1; i < cells.length; i++) {
    const a = pts[pts.length - 1], b = cells[i], c = cells[i + 1]
    if (c && ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5))) continue
    pts.push(b)
  }
  return pts
}

// Cheapest path from p (leaving along np) to q (arriving against nq). Without `bounds`: monotone, only moves towards q inside
// [p, q]'s box, visited in order. With `bounds`: any move within them (never straight back), by Dijkstra. No bend within STUB of either end.
function search(p: Pt, q: Pt, np: Pt, nq: Pt, obstacles: Rect[], others: Seg[], bounds: Rect | null): { pts: Pt[]; cost: number } | null {
  const lo: Pt = bounds ? [bounds.x0, bounds.y0] : [Math.min(p[0], q[0]), Math.min(p[1], q[1])]
  const hi: Pt = bounds ? [bounds.x1, bounds.y1] : [Math.max(p[0], q[0]), Math.max(p[1], q[1])]
  // the start and end must not be buried in an obstacle (a block standing on a side midpoint)
  if (obstacles.some(o => inside(p[0] + np[0] * 0.5, p[1] + np[1] * 0.5, o) || inside(q[0] + nq[0] * 0.5, q[1] + nq[1] * 0.5, o))) return null
  const G = grid(lo, hi, [p, q, [p[0] + np[0] * STUB, p[1] + np[1] * STUB], [q[0] + nq[0] * STUB, q[1] + nq[1] * STUB]], obstacles, others)
  if (!G) return null
  const { xs, ys, X, Y, hc, vc, index } = G
  const i0 = index(xs, p[0]), j0 = index(ys, p[1]), i1 = index(xs, q[0]), j1 = index(ys, q[1])
  if (i0 < 0 || j0 < 0 || i1 < 0 || j1 < 0) return null
  // states (i, j, heading): heading 0 +x, 1 -x, 2 +y, 3 -y
  const head = (v: Pt) => v[0] > 0 ? 0 : v[0] < 0 ? 1 : v[1] > 0 ? 2 : 3
  const STEP: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const start = head(np), finish = head([-nq[0], -nq[1]])
  const sx = Math.sign(i1 - i0), sy = Math.sign(j1 - j0)
  const forward = (h: number) => bounds !== null || (h === 0 ? sx > 0 : h === 1 ? sx < 0 : h === 2 ? sy > 0 : sy < 0)
  const N = X * Y * 4, cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1)
  const id = (i: number, j: number, h: number) => (i * Y + j) * 4 + h
  const moveCost = (i: number, j: number, h: number) => h < 2 ? hc[(h === 0 ? i : i - 1) * Y + j] : vc[i * Y + (h === 2 ? j : j - 1)]
  const nearStart = (i: number, j: number) => (start < 2 ? j === j0 : i === i0) && Math.abs(start < 2 ? xs[i] - p[0] : ys[j] - p[1]) < STUB - 0.5
  const nearEnd = (i: number, j: number) => (finish < 2 ? j === j1 : i === i1) && Math.abs(finish < 2 ? xs[i] - q[0] : ys[j] - q[1]) < STUB - 0.5
  const s0 = id(i0, j0, start)
  const relax = (k: number, push: (k: number, c: number) => void) => {
    const h = k % 4, cell = (k - h) / 4, i = Math.floor(cell / Y), j = cell % Y, c0 = cost[k]
    for (let nh = 0; nh < 4; nh++) {
      if (k === s0 && nh !== start) continue
      if ((nh ^ 1) === h || !forward(nh)) continue // never straight back
      if (nh !== h && ((nearStart(i, j) && h === start) || (nearEnd(i, j) && nh === finish))) continue
      const ni = i + STEP[nh][0], nj = j + STEP[nh][1]
      if (ni < 0 || nj < 0 || ni >= X || nj >= Y) continue
      const e = moveCost(i, j, nh)
      if (e === Infinity) continue
      const c = c0 + e + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (nh !== h ? COST.bend : 0)
      const nk = id(ni, nj, nh)
      if (c < cost[nk]) { cost[nk] = c; prev[nk] = k; push(nk, c) }
    }
  }
  cost[s0] = 0
  const goal = id(i1, j1, finish)
  if (!bounds) {
    // monotone: every move goes forward, so visiting the cells in order from p to q settles each before it is used
    for (let a = 0; a <= Math.abs(i1 - i0); a++) for (let b = 0; b <= Math.abs(j1 - j0); b++) for (let h = 0; h < 4; h++) {
      const k = id(i0 + a * (sx || 1), j0 + b * (sy || 1), h)
      if (cost[k] < Infinity) relax(k, () => {})
    }
  } else {
    // Dijkstra on a binary heap
    const heap: [number, number][] = []
    const push = (k: number, c: number) => { heap.push([c, k]); let n = heap.length - 1; while (n) { const u = (n - 1) >> 1; if (heap[u][0] <= heap[n][0]) break; [heap[u], heap[n]] = [heap[n], heap[u]]; n = u } }
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m } } return top }
    push(s0, 0)
    while (heap.length) {
      const [c, k] = pop()
      if (c > cost[k]) continue
      if (k === goal) break
      relax(k, push)
    }
  }
  if (cost[goal] === Infinity) return null
  const cells: Pt[] = []
  for (let k = goal; k >= 0; k = prev[k]) { const cell = Math.floor(k / 4); cells.push([xs[Math.floor(cell / Y)], ys[cell % Y]]) }
  cells.reverse()
  return { pts: corners(cells), cost: cost[goal] }
}

function bestOver(boxes: Box[], r: Route, others: Seg[], buffer: number, bounds: Rect | null): Pt[] | null {
  const by = new Map(boxes.map(b => [b.id, b]))
  const A = by.get(r.from), B = by.get(r.to)
  if (!A || !B || A === B) return null
  const obstacles = obstaclesOf(boxes, r, buffer)
  let best: { pts: Pt[]; cost: number } | null = null
  for (const sa of SIDES) for (const sb of SIDES) {
    const p = mid(A, sa), q = mid(B, sb), np = NORMAL[sa], nq = NORMAL[sb]
    if (!bounds) {
      // leaving along np and arriving against nq must both head towards the target
      const dx = Math.sign(Math.round(q[0] - p[0])), dy = Math.sign(Math.round(q[1] - p[1]))
      if ((np[0] && np[0] !== dx) || (np[1] && np[1] !== dy)) continue
      if ((nq[0] && -nq[0] !== dx) || (nq[1] && -nq[1] !== dy)) continue
    }
    const found = search(p, q, np, nq, obstacles, others, bounds)
    if (found && (!best || found.cost < best.cost)) best = found
  }
  return best?.pts ?? null
}

/** The best monotone route from a side midpoint of `from` to one of `to`, or null if there is none. `others`: the other lines. */
export function monotoneRoute(boxes: Box[], r: Route, others: Seg[], buffer: number): Pt[] | null {
  return bestOver(boxes, r, others, buffer, null)
}

/** The cheapest route round every block and foreign tray (it may turn back), within the diagram grown by 60 px. */
export function detourRoute(boxes: Box[], r: Route, others: Seg[], buffer: number): Pt[] | null {
  const x0 = Math.min(...boxes.map(b => b.x)) - 60, y0 = Math.min(...boxes.map(b => b.y)) - 60
  const x1 = Math.max(...boxes.map(b => b.x + b.w)) + 60, y1 = Math.max(...boxes.map(b => b.y + b.h)) + 60
  return bestOver(boxes, r, others, buffer, { x0, y0, x1, y1 })
}

/** Is there a monotone route for this line at all, ignoring other lines? If not, any route it takes must turn back somewhere. */
export function canGoDirect(boxes: Box[], r: Route, buffer: number): boolean {
  return monotoneRoute(boxes, r, [], buffer) !== null
}

/**
 * Replaces each route that doubles back, or goes through a block or a tray it does not belong to, with the best monotone route
 * if there is one; failing that, a route through a block or foreign tray takes the cheapest way round. Lines are taken one by
 * one, each kept off those already settled. `forced` counts the lines left turning back because no direct route exists.
 */
export function straighten(boxes: Box[], routes: Route[], buffer: number): { routes: Route[]; changed: number; forced: number } {
  const out = routes.slice()
  let changed = 0, forced = 0
  const segsOf = (skip: number) => out.flatMap((e, i) => i === skip ? [] : e.points.slice(1).map((b, k) => ({ a: e.points[k], b })))
  for (let i = 0; i < out.length; i++) {
    const r = out[i]
    if (r.from === r.to || r.points.length < 2) continue
    const back = doublesBack(r.points), through = blocked(boxes, r)
    if (!back && !through) continue
    const others = segsOf(i)
    const pts = monotoneRoute(boxes, r, others, buffer) ?? (through ? detourRoute(boxes, r, others, buffer) : null)
    if (pts) { out[i] = { ...r, points: pts }; changed++ }
    if (doublesBack(out[i].points)) forced++
  }
  return { routes: out, changed, forced }
}

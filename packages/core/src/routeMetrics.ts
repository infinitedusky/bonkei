// How good a set of routes is, on layout pixels (BON-99): the numbers the playground shows beside the crossing-avoidance setting.
// The playground's route-metrics script has the same counts for whole samples. Imported by node tests: explicit .ts extensions.
import type { Box, Route } from './model.ts'

export interface RouteQuality {
  /** Places where a line crosses another (plan view, strictly inside both). */
  crossings: number
  /** Pairs of lines lying on top of each other over more than 4 px, not counting the stub two lines share where they meet one pin, nor where they fan out from it. */
  overlaps: number
  /** Lines that reverse along an axis (go right, later left). */
  doublingBack: number
  /** Lines with a segment through a block they do not end at, and through a tray they do not enter. */
  throughBlocks: number
  throughTrays: number
  /** Mean of (length / straight Manhattan distance between the ends). */
  lengthRatio: number
}

type Pt = [number, number]
export function measureRoutes(boxes: Box[], routes: Route[]): RouteQuality {
  const by = new Map(boxes.map(b => [b.id, b]))
  const anc = (id: string) => { const l: string[] = []; for (let p = by.get(id)?.parent; p; p = by.get(p)?.parent) l.push(p); return l }
  let back = 0, ratio = 0
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
    if (rev) back++
    ratio += l / Math.max(Math.abs(p[p.length - 1][0] - p[0][0]) + Math.abs(p[p.length - 1][1] - p[0][1]), 1)
  }
  const segs = routes.flatMap((e, ri) => e.points.slice(1).map((q, i) => ({ ri, a: e.points[i] as Pt, b: q, e, end: i === 0 || i === e.points.length - 2, fork: i <= 1 || i >= e.points.length - 3 })))
  const hit = (s: { a: Pt; b: Pt }, n: Box, shrink: number) =>
    Math.max(s.a[0], s.b[0]) > n.x + shrink && Math.min(s.a[0], s.b[0]) < n.x + n.w - shrink && Math.max(s.a[1], s.b[1]) > n.y + shrink && Math.min(s.a[1], s.b[1]) < n.y + n.h - shrink
  const blocks = new Set<string>(), trays = new Set<string>()
  for (const s of segs) for (const n of boxes) {
    if (n.id === s.e.from || n.id === s.e.to) continue
    if (n.kind === 'node') { if (hit(s, n, 0)) blocks.add(s.e.id) } else if (!anc(s.e.from).includes(n.id) && !anc(s.e.to).includes(n.id) && hit(s, n, 1)) trays.add(s.e.id)
  }
  let crossings = 0, overlaps = 0
  const hz = (s: { a: Pt; b: Pt }) => Math.abs(s.a[1] - s.b[1]) < 0.5
  // two lines leaving the same side midpoint fan out from the corner after its stub: counted with the shared stub, not as lying on each other
  type S = (typeof segs)[number]
  const fanOut = (h: S, v: S) => h.fork && v.fork && [h.a, h.b].some(p => [v.a, v.b].some(q => p[0] === q[0] && p[1] === q[1])) && [h.e.from, h.e.to].some(n => n === v.e.from || n === v.e.to)
  for (const h of segs) for (const v of segs) {
    if (h.ri >= v.ri) continue
    if (hz(h) === hz(v)) {
      const k = hz(h) ? 1 : 0, j = 1 - k
      if (Math.abs(h.a[k] - v.a[k]) >= 0.5 || (h.end && v.end) || fanOut(h, v)) continue
      const o = Math.min(Math.max(h.a[j], h.b[j]), Math.max(v.a[j], v.b[j])) - Math.max(Math.min(h.a[j], h.b[j]), Math.min(v.a[j], v.b[j]))
      if (o > 4) overlaps++
    }
  }
  for (const h of segs) for (const v of segs) {
    if (h.ri === v.ri || !hz(h) || Math.abs(v.a[0] - v.b[0]) > 0.5) continue
    if (v.a[0] > Math.min(h.a[0], h.b[0]) + 0.5 && v.a[0] < Math.max(h.a[0], h.b[0]) - 0.5 && h.a[1] > Math.min(v.a[1], v.b[1]) + 0.5 && h.a[1] < Math.max(v.a[1], v.b[1]) - 0.5) crossings++
  }
  return { crossings, overlaps, doublingBack: back, throughBlocks: blocks.size, throughTrays: trays.size, lengthRatio: +(ratio / Math.max(routes.length, 1)).toFixed(2) }
}

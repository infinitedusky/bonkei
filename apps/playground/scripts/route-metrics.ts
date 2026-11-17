// Route directness and obstacle checks (BON-85, extended in BON-99): per sample, lines through a block, lines through a tray
// they do not enter, lines lying on top of each other, crossings, doubling back, bends, length / direct.
// LAYOUT=<path to a layout.ts> measures another checkout's layout (e.g. main's or BON-85's) for comparison; it must sit beside its parser.ts.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/route-metrics.ts
// V=1 lists the ids. LEVEL=off|some|strong sets the crossing avoidance.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const layoutPath = process.env.LAYOUT ?? fileURLToPath(new URL('../../../packages/core/src/layout.ts', import.meta.url))
const mod = await import(layoutPath)
const { layout } = mod
const { parse } = await import(dirname(layoutPath) + '/parser.ts')
const dir = fileURLToPath(new URL('../src/', import.meta.url))
const ts = readFileSync(dir + 'samples.ts', 'utf8')
const samples: Record<string, string> = {
  small: readFileSync(dir + 'sample.mmd', 'utf8'),
  large: ts.match(/const large = `([\s\S]*?)`/)![1],
  }

type Pt = [number, number]
export function metrics(r: any) {
  const by = new Map<string, any>(r.boxes.map((b: any) => [b.id, b]))
  const anc = (id: string) => { const l: string[] = []; for (let p = by.get(id)?.parent; p; p = by.get(p)?.parent) l.push(p); return l }
  let len = 0, bends = 0, back = 0, ratio = 0
  const backIds: string[] = []
  for (const e of r.routes) {
    const p: Pt[] = e.points
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
  const segs = r.routes.flatMap((e: any, ri: number) => e.points.slice(1).map((q: Pt, i: number) => ({ ri, a: e.points[i] as Pt, b: q, e, end: i === 0 || i === e.points.length - 2, fork: i <= 1 || i >= e.points.length - 3 })))
  const hit = (s: any, n: any, shrink: number) => {
    const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1])
    return x1 > n.x + shrink && x0 < n.x + n.w - shrink && y1 > n.y + shrink && y0 < n.y + n.h - shrink
  }
  const throughIds = new Set<string>(), trayIds = new Set<string>()
  for (const s of segs) for (const n of r.boxes) {
    if (n.id === s.e.from || n.id === s.e.to) continue
    if (n.kind === 'node') { if (hit(s, n, 0)) throughIds.add(s.e.id) }
    else if (!anc(s.e.from).includes(n.id) && !anc(s.e.to).includes(n.id) && hit(s, n, 1)) trayIds.add(s.e.id)
  }
  let cross = 0, overlap = 0, stubs = 0
  const hz = (s: any) => Math.abs(s.a[1] - s.b[1]) < 0.5
  // two lines leaving the same side midpoint fan out from the corner after its stub: counted with the shared stubs
  const shared = (h: any, v: any) => (h.end && v.end) || (h.fork && v.fork && [h.a, h.b].some((p: Pt) => [v.a, v.b].some((q: Pt) => p[0] === q[0] && p[1] === q[1])) && [h.e.from, h.e.to].some((n: string) => n === v.e.from || n === v.e.to))
  for (const h of segs) for (const v of segs) {
    if (h.ri >= v.ri) continue
    if (hz(h) && hz(v) && Math.abs(h.a[1] - v.a[1]) < 0.5) {
      const o = Math.min(Math.max(h.a[0], h.b[0]), Math.max(v.a[0], v.b[0])) - Math.max(Math.min(h.a[0], h.b[0]), Math.min(v.a[0], v.b[0]))
      if (o > 4) (shared(h, v) ? stubs++ : overlap++)
    } else if (!hz(h) && !hz(v) && Math.abs(h.a[0] - v.a[0]) < 0.5) {
      const o = Math.min(Math.max(h.a[1], h.b[1]), Math.max(v.a[1], v.b[1])) - Math.max(Math.min(h.a[1], h.b[1]), Math.min(v.a[1], v.b[1]))
      if (o > 4) (shared(h, v) ? stubs++ : overlap++)
    }
  }
  for (const h of segs) for (const v of segs) {
    if (h.ri === v.ri || !hz(h) || Math.abs(v.a[0] - v.b[0]) > 0.5) continue
    if (v.a[0] > Math.min(h.a[0], h.b[0]) + 0.5 && v.a[0] < Math.max(h.a[0], h.b[0]) - 0.5 && h.a[1] > Math.min(v.a[1], v.b[1]) + 0.5 && h.a[1] < Math.max(v.a[1], v.b[1]) - 0.5) cross++
  }
  // an end that is not at a side midpoint of its box
  let offMid = 0
  for (const e of r.routes) for (const [id, p] of [[e.from, e.points[0]], [e.to, e.points[e.points.length - 1]]] as [string, Pt][]) {
    const b = by.get(id)
    const mids: Pt[] = [[b.x + b.w / 2, b.y], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2], [b.x + b.w, b.y + b.h / 2]]
    if (!mids.some(m => Math.hypot(m[0] - p[0], m[1] - p[1]) < 1)) offMid++
  }
  return { routes: r.routes.length, len: Math.round(len), bends, back, backIds, through: throughIds.size, throughIds: [...throughIds], trays: trayIds.size, trayIds: [...trayIds], cross, overlap, stubs, offMid, ratio: +(ratio / Math.max(r.routes.length, 1)).toFixed(2) }
}
export const show = (m: ReturnType<typeof metrics>) =>
  `${m.through} through a block, ${m.trays} through a foreign tray, ${m.overlap} lying on top of each other (+${m.stubs} shared pin stubs), ${m.cross} crossings, ${m.back} doubling back, ${m.offMid} ends off a side midpoint, ${m.bends} bends, length ${m.len}, length/direct ${m.ratio}`

if (process.argv[1]?.endsWith("route-metrics.ts") && !process.env.NOMAIN) {
  for (const [name, src] of Object.entries(samples)) {
    const t0 = performance.now()
    const r = await layout(parse(src), process.env.LEVEL ? { avoidCrossings: process.env.LEVEL } : undefined)
    const m = metrics(r)
    console.log(`${name} (${m.routes} edges): ${show(m)}; ${Math.round(performance.now() - t0)} ms${r.stats?.route ? `; libavoid failed ${r.stats.route.failed.length}${r.stats.route.error ? ', ERROR ' + r.stats.route.error : ''}` : ''}`)
    if (process.env.V) console.log('  back:', m.backIds.join(' '), '| block:', m.throughIds.join(' '), '| tray:', m.trayIds.join(' '))
  }
}

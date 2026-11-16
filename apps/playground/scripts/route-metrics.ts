// Route directness for BON-85: total length, bends, and doubling-back routes (a move that reverses the direction
// of an earlier move along the same axis) on the playground's samples. LAYOUT=<path to a layout.ts> measures another
// checkout's layout (e.g. main's) for comparison; it must sit beside its parser.ts.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/route-metrics.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const layoutPath = process.env.LAYOUT ?? fileURLToPath(new URL('../../../packages/core/src/layout.ts', import.meta.url))
const mod = await import(layoutPath)
const { layout } = mod
if (process.env.TUNE && mod.TUNE) Object.assign(mod.TUNE, JSON.parse(process.env.TUNE)) // e.g. TUNE='{"sides":"floating","options":{"elk.layered.nodePlacement.favorStraightEdges":"true"}}'
const { parse } = await import(dirname(layoutPath) + '/parser.ts')
const dir = fileURLToPath(new URL('../src/', import.meta.url))
const samples: Record<string, string> = {
  small: readFileSync(dir + 'sample.mmd', 'utf8'),
  large: readFileSync(dir + 'samples.ts', 'utf8').match(/const large = `([\s\S]*?)`/)![1],
}
for (const [name, src] of Object.entries(samples)) {
  const r = await layout(parse(src))
  let len = 0, bends = 0, back = 0, ratio = 0
  for (const e of r.routes) {
    const p: [number, number][] = e.points
    const seen = [0, 0] // direction signs seen so far on x and y
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
    len += l; bends += p.length - 2; back += rev ? 1 : 0; ratio += l / Math.max(direct, 1)
  }
  // lines through blocks, and crossings between routes
  const nodes = r.boxes.filter((b: any) => b.kind === 'node')
  let through = 0, cross = 0
  const segs = r.routes.flatMap((e: any, ri: number) => e.points.slice(1).map((q: number[], i: number) => ({ ri, a: e.points[i], b: q, e })))
  for (const s of segs) for (const n of nodes) {
    if (n.id === s.e.from || n.id === s.e.to) continue
    const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1])
    if (x1 > n.x && x0 < n.x + n.w && y1 > n.y && y0 < n.y + n.h) through++
  }
  for (const h of segs) for (const v of segs) {
    if (h.ri === v.ri || Math.abs(h.a[1] - h.b[1]) > 0.5 || Math.abs(v.a[0] - v.b[0]) > 0.5) continue
    if (v.a[0] > Math.min(h.a[0], h.b[0]) + 0.5 && v.a[0] < Math.max(h.a[0], h.b[0]) - 0.5 && h.a[1] > Math.min(v.a[1], v.b[1]) + 0.5 && h.a[1] < Math.max(v.a[1], v.b[1]) - 0.5) cross++
  }
  console.log(`${name}: ${through} segments run through a block, ${cross} crossings; ${r.routes.length} routes, length ${Math.round(len)} px, ${bends} bends, ${back} doubling back, mean length/direct ${(ratio / r.routes.length).toFixed(2)}, layout ${Math.round(r.width)}x${Math.round(r.height)}, docked ${(r.stats?.portFallbacks ?? 0) + (r.stats?.trayDocks ?? 0)}`)
}

// Crossing-avoidance levels on the 50-node sample (BON-99): quality, routing time, and drag frame time with the crossing
// penalty off while dragging (as the scene does) and kept on.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/avoid-levels.ts
import { readFileSync } from 'node:fs'
process.env.NOMAIN = '1'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { loadAvoid, createRouter, TUNE, AVOID_CROSSINGS, CROSSING_COST } = await import(root + 'avoid.ts')
const { metrics } = await import('./route-metrics.ts')
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const data = await layout(parse(ts.match(/const large = `([\s\S]*?)`/)![1]))
const A = await loadAvoid()
const nodes = data.boxes.filter((b: any) => b.kind === 'node').slice(0, 20)
const median = (ms: number[]) => ms.sort((a, b) => a - b)[ms.length >> 1].toFixed(0)
for (const level of AVOID_CROSSINGS) {
  const rr = createRouter(A, data, level)
  const m = metrics({ ...data, routes: rr.routes })
  const ms: number[] = []
  for (const n of nodes) for (const d of [50, -50]) { rr.move(n.id, d, 0); ms.push(rr.stats.moveMs) }
  rr.dispose()
  // the same with the penalty kept on while dragging
  const r2 = createRouter(A, data, level, { ...TUNE, dragCrossing: CROSSING_COST[level] })
  const m2: number[] = []
  for (const n of nodes.slice(0, 6)) for (const d of [50, -50]) { r2.move(n.id, d, 0); m2.push(r2.stats.moveMs) }
  r2.dispose()
  console.log(`${level}: crossings ${m.cross}, overlapping ${m.overlap}, foreign tray ${m.trays}, through a block ${m.through}, doubling back ${m.back}, length/direct ${m.ratio}, length ${m.len}; build ${Math.round(rr.stats.buildMs)} ms; drag (penalty off) ${median(ms)} ms, (penalty on) ${median(m2)} ms`)
}

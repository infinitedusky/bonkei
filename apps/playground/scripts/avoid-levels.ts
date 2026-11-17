// Crossing-avoidance levels on the 50-node sample (BON-99): quality, routing time, and drag frame time with the penalty on and off while dragging.
import { readFileSync } from 'node:fs'
process.env.NOMAIN = '1'
const root = '/Users/the_dusky/code/bonkei-worktrees/prototype--edges-in-3d-routed-by-libavoid-kond/packages/core/src/'
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { loadAvoid, createRouter, TUNE } = await import(root + 'avoid.ts')
const { metrics } = await import('./route-metrics.ts')
const ts = readFileSync('src/samples.ts', 'utf8')
const data = await layout(parse(ts.match(/const large = `([\s\S]*?)`/)![1]))
const A = await loadAvoid()
const nodes = data.boxes.filter((b: any) => b.kind === 'node').slice(0, 20)
for (const crossing of [0, 30, 100, 300, 1000, 3000]) {
  const out: string[] = []
  const rr = createRouter(A, data, { ...TUNE, crossing, dragCrossing: 0 })
  const m = metrics({ ...data, routes: rr.routes })
  const t0 = performance.now()
  const ms: number[] = []
  for (const n of nodes) for (const d of [50, -50]) { rr.move(n.id, d, 0); ms.push(rr.stats.moveMs) }
  ms.sort((a, b) => a - b)
  rr.dispose()
  // the same with the penalty kept on while dragging
  const r2 = createRouter(A, data, { ...TUNE, crossing, dragCrossing: crossing })
  const m2: number[] = []
  for (const n of nodes.slice(0, 6)) for (const d of [50, -50]) { r2.move(n.id, d, 0); m2.push(r2.stats.moveMs) }
  m2.sort((a, b) => a - b)
  r2.dispose()
  console.log(`crossing ${crossing}: x ${m.cross} ov ${m.overlap} tray ${m.trays} block ${m.through} back ${m.back} ratio ${m.ratio} len ${m.len} build ${Math.round(rr.stats.buildMs)} ms; drag(penalty off) ${ms[ms.length >> 1].toFixed(0)} ms; drag(penalty on) ${m2[m2.length >> 1].toFixed(0)} ms`)
}

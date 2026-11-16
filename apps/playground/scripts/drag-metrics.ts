// Re-route cost while dragging (BON-99): moves each node of a sample 60 px right and back on one live router and times processTransaction + read.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/drag-metrics.ts   (TUNE='{"crossing":500}' overrides)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { layout } from '../../../packages/core/src/layout.ts'
import { parse } from '../../../packages/core/src/parser.ts'
import { loadAvoid, createRouter, TUNE } from '../../../packages/core/src/avoid.ts'
import { metrics, show } from './route-metrics.ts'

if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE))
const dir = fileURLToPath(new URL('../src/', import.meta.url))
const large = readFileSync(dir + 'samples.ts', 'utf8').match(/const large = `([\s\S]*?)`/)![1]
const A = await loadAvoid()
for (const [name, src] of Object.entries({ small: readFileSync(dir + 'sample.mmd', 'utf8'), large })) {
  const data = await layout(parse(src))
  const r = createRouter(A, data)
  const nodes = data.boxes.filter(b => b.kind === 'node')
  const ms: number[] = []
  for (const n of nodes) for (const d of [60, -60]) { r.move(n.id, d, 0); ms.push(r.stats.moveMs) }
  ms.sort((a, b) => a - b)
  const after = { ...data, routes: r.routes }
  console.log(`${name}: build ${r.stats.buildMs.toFixed(0)} ms; drag frame median ${ms[ms.length >> 1].toFixed(1)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(1)}, max ${ms[ms.length - 1].toFixed(1)}; after all moves back: ${show(metrics(after))}`)
  r.dispose()
}

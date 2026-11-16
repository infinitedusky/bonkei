// Mockup (BON-99): ELK's routes against libavoid's on the playground's flowchart samples, by the BON-85 metrics.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/avoid-metrics.ts
// TUNE='{"reverse":50}' overrides the router settings.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AvoidLib } from 'libavoid-js'
import { layout } from '../../../packages/core/src/layout.ts'
import { parse } from '../../../packages/core/src/parser.ts'
import { avoidRoutes, routeMetrics, TUNE } from '../src/avoid-route.ts'

if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE))
await AvoidLib.load()
const A = AvoidLib.getInstance()
const dir = fileURLToPath(new URL('../src/', import.meta.url))
const ts = readFileSync(dir + 'samples.ts', 'utf8')
const samples: Record<string, string> = {
  small: readFileSync(dir + 'sample.mmd', 'utf8'),
  large: ts.match(/const large = `([\s\S]*?)`/)![1],
  wide: ts.match(/const wide = `([\s\S]*?)`/)![1],
}
const show = (m: ReturnType<typeof routeMetrics>) =>
  `${m.through} through a block, ${m.back} doubling back, ${m.overlap} overlapping, ${m.cross} crossings, ${m.bends} bends, length ${m.len}, length/direct ${m.ratio}`
for (const [name, src] of Object.entries(samples)) {
  const data = await layout(parse(src))
  const av = avoidRoutes(A, data)
  const m = routeMetrics(data, av.routes)
  console.log(`${name} (${data.routes.length} edges)`)
  console.log(`  ELK      ${show(routeMetrics(data, data.routes))}`)
  console.log(`  libavoid ${show(m)}; ${Math.round(av.ms)} ms; failed ${av.failed.length ? av.failed.join(',') : 0}`)
  if (process.env.V) console.log('  back:', m.backIds.join(' '), ' through:', m.throughIds.join(' '))
  // drag: move each node 60 px right and back, timing each re-route
  const nodes = data.boxes.filter(b => b.kind === 'node')
  const t0 = performance.now()
  for (const n of nodes) { av.move(n.id, 60, 0); av.move(n.id, -60, 0) }
  console.log(`  drag re-route ${((performance.now() - t0) / (nodes.length * 2)).toFixed(1)} ms per move`)
  av.dispose()
}

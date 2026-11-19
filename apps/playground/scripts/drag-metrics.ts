// Drag frame time on the 50-node sample (BON-100): one live router, a node moved 40 times by 5 px; libavoid's re-route plus the
// direct-route pass, per frame. Also doubling back and lines through a block or foreign tray in every frame.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/drag-metrics.ts
import { readFileSync } from 'node:fs'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { loadAvoid, createRouter, AVOID_CROSSINGS } = await import(root + 'avoid.ts')
const { measureRoutes } = await import(root + 'routeMetrics.ts')
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const data = await layout(parse(ts.match(/const large = `([\s\S]*?)`/)![1]))
const A = await loadAvoid()
const id = data.boxes.find((b: any) => b.kind === 'node' && b.parent)!.id
for (const level of AVOID_CROSSINGS) {
  const r = createRouter(A, data, level)
  const ms: number[] = []
  let back = 0, blocks = 0, trays = 0
  for (let i = 0; i < 40; i++) {
    r.move(id, 5, 0); ms.push(r.stats.moveMs)
    const q = measureRoutes(data.boxes.map((b: any) => b.id === id ? { ...b, ...r.at(id) } : b), r.routes)
    back = Math.max(back, q.doublingBack); blocks = Math.max(blocks, q.throughBlocks); trays = Math.max(trays, q.throughTrays)
  }
  ms.sort((a, b) => a - b)
  console.log(`${level}: drag frame median ${ms[20].toFixed(1)} ms, worst ${ms[39].toFixed(1)} ms; at most ${back} doubling back, ${blocks} through a block, ${trays} through a foreign tray`)
  r.dispose()
}

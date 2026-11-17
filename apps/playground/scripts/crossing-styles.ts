// Crossings found and drawn per style on the samples, on libavoid's routes (BON-99).
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/crossing-styles.ts
import { readFileSync } from 'node:fs'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { planEdges, CROSSING_STYLES } = await import(root + 'edges3d.ts')
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const S = 1 / 40
for (const [name, src] of [['small', readFileSync(new URL('../src/sample.mmd', import.meta.url), 'utf8')], ['large', ts.match(/const large = `([\s\S]*?)`/)![1]]] as const) {
  const r = await layout(parse(src))
  const bodies = r.boxes.map((b: any) => ({ id: b.id, kind: b.kind, x0: b.x * S, z0: b.y * S, x1: (b.x + b.w) * S, z1: (b.y + b.h) * S, level: b.level, parent: b.parent }))
  for (const style of CROSSING_STYLES) {
    const p = planEdges(bodies, r.routes.map((e: any) => ({ id: e.id, from: e.from, to: e.to, points: e.points.map(([x, y]: number[]) => [x * S, y * S]) })), style)
    const s = p.stats
    console.log(`${name} ${style}: ${s.crossings} crossings, ${s.touching} would touch; drawn bridge ${s.bridge}, tunnel ${s.tunnel}, portal ${s.portal}; left plain ${s.skipped}`)
  }
}

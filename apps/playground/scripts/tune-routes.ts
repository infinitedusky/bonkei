// Grid over the libavoid settings on the 50-node sample, best first (BON-99). pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/tune-routes.ts
import { readFileSync } from 'node:fs'
const root = '/Users/the_dusky/code/bonkei-worktrees/prototype--edges-in-3d-routed-by-libavoid-kond/'
process.env.NOMAIN = "1"
const { layout } = await import(root + 'packages/core/src/layout.ts')
const { parse } = await import(root + 'packages/core/src/parser.ts')
const { loadAvoid, createRouter, TUNE } = await import(root + 'packages/core/src/avoid.ts')
const { metrics } = await import(root + 'apps/playground/scripts/route-metrics.ts')
const ts = readFileSync(root + 'apps/playground/src/samples.ts', 'utf8')
const data = await layout(parse(ts.match(/const large = `([\s\S]*?)`/)![1]))
const A = await loadAvoid()
const rows: any[] = []
for (const crossing of [500, 1000, 2000, 4000]) for (const reverse of [200, 1000, 3000]) for (const segment of [10, 40]) for (const nudge of [6, 10]) {
  const r = createRouter(A, data, { ...TUNE, crossing, reverse, segment, nudge })
  const m = metrics({ ...data, routes: r.routes })
  rows.push({ crossing, reverse, segment, nudge, ms: Math.round(r.stats.buildMs), t: m.through, tray: m.trays, ov: m.overlap, x: m.cross, back: m.back, ratio: m.ratio, fail: r.stats.failed.length })
  r.dispose()
}
rows.sort((a, b) => (a.t + a.tray + a.ov + a.fail) - (b.t + b.tray + b.ov + b.fail) || a.x - b.x || a.back - b.back)
for (const r of rows.slice(0, 12)) console.log(JSON.stringify(r))

// Drags every node of the 50-node sample 60 px in four directions on one live router and counts frames with a line through a block (BON-99)
// and frames with a line doubling back (BON-102; those whose line has no direct route at all, `canGoDirect` false, are counted apart).
// Frames where the node lands within 12 px of another block are counted apart: a line cannot avoid a block that sits on its own end.
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/drag-check.ts
import { readFileSync } from 'node:fs'
process.env.NOMAIN = '1'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { loadAvoid, createRouter } = await import(root + 'avoid.ts')
const { measureRoutes } = await import(root + 'routeMetrics.ts')
const { doublesBack, canGoDirect } = await import(root + 'monotone.ts')
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const data = await layout(parse(ts.match(/const large = `([\s\S]*?)`/)![1]))
const A = await loadAvoid()
const r = createRouter(A, data)
const nodes = data.boxes.filter((b: any) => b.kind === 'node')
let skipped = 0, worst = 0, frames = 0, bad = 0, trays = 0, back = 0, backForced = 0
const hist: Record<string, number> = {}
for (const n of nodes) for (const d of [[60, 0], [0, 60], [-60, 0], [0, -60]]) {
  r.move(n.id, d[0], d[1]); frames++
  const boxes = data.boxes.map((b: any) => { const a = r.at(b.id); return b.kind === 'node' ? { ...b, x: a.x, y: a.y } : b })
  const q = measureRoutes(boxes, r.routes)
  const me = boxes.find((b: any) => b.id === n.id)
  const overlaps = boxes.some((o: any) => o.kind === 'node' && o.id !== n.id && o.x < me.x + me.w + 12 && o.x + o.w + 12 > me.x && o.y < me.y + me.h + 12 && o.y + o.h + 12 > me.y)
  if (q.throughBlocks && !overlaps) { bad++; hist[n.id] = (hist[n.id] ?? 0) + 1 }
  if (overlaps) skipped++
  if (q.throughTrays) trays++
  const turning = r.routes.filter((e: any) => doublesBack(e.points))
  if (turning.length && !overlaps) { if (turning.every((e: any) => !canGoDirect(boxes, e, 10))) backForced++; else back++ }
  worst = Math.max(worst, q.throughBlocks)
  r.move(n.id, -d[0], -d[1])
}
console.log({ skippedBecauseDroppedOnAnotherBlock: skipped, frames, framesWithLineThroughBlock: bad, worst, framesWithForeignTray: trays, framesDoublingBack: back, framesDoublingBackNoDirectRoute: backForced, hist })

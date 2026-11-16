// Lists every line that doubles back on a sample, with where its ends are in the flow (BON-99).
//   pnpm --filter @bonkei/playground exec node --experimental-strip-types scripts/list-back.ts
import { readFileSync } from 'node:fs'
process.env.NOMAIN = '1'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { metrics } = await import('./route-metrics.ts')
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const r = await layout(parse(ts.match(/const large = `([\s\S]*?)`/)![1]))
const m = metrics(r)
const by = new Map<string, any>(r.boxes.map((b: any) => [b.id, b]))
const anc = (id: string) => { const l: string[] = []; for (let p = by.get(id)?.parent; p; p = by.get(p)?.parent) l.push(p); return l }
const cy = (b: any) => b.y + b.h / 2
for (const id of m.backIds) {
  const e = r.routes.find((x: any) => x.id === id)
  const a = by.get(e.from), b = by.get(e.to)
  const rev = cy(b) < cy(a) - 1
  const ps = e.points.map((p: number[]) => p.map(Math.round))
  // where it reverses
  const seen = [0, 0]; const at: string[] = []
  for (let i = 1; i < ps.length; i++) for (const ax of [0, 1]) { const s = Math.sign(ps[i][ax] - ps[i - 1][ax]); if (!s) continue; if (seen[ax] && seen[ax] !== s) at.push(`${ax ? 'y' : 'x'} reverses at point ${i}`); seen[ax] = seen[ax] || s }
  console.log(`${id} ${e.from} -> ${e.to}: ${rev ? 'target is ABOVE source (against the flow)' : 'target is below/level (with the flow)'}; trays ${anc(e.from).join('/') || '-'} -> ${anc(e.to).join('/') || '-'}; ${at[0]}; ${ps.length - 1} segments`)
}
console.log('through foreign tray:', m.trayIds.join(' '))

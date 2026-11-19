// Re-runnable measurement for BON-85: lays out the playground's samples and checks, in the real routes,
// that spacing holds at every nesting level, no step lands on a node or inside an unrelated tray, and no
// tunnel trough touches a node. Run: pnpm --filter @bonkei/playground measure   (exit 1 on a violation).
// It reads core's pure .ts files by path (node strip-types cannot load bonkei/internal, which reaches .tsx).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '../../../packages/core/src/parser.ts'
import { layout, PAD, SPACING } from '../../../packages/core/src/layout.ts'
import { stepRoute, applyCrossings, type Body, type P3 } from '../../../packages/core/src/edges3d.ts'
import { SLOT_W } from '../../../packages/core/src/edges3d.ts'

const S = 1 / 40
const dir = fileURLToPath(new URL('../src/', import.meta.url))
const large = readFileSync(dir + 'samples.ts', 'utf8').match(/const large = `([\s\S]*?)`/)![1]
const samples: Record<string, string> = { small: readFileSync(dir + 'sample.mmd', 'utf8'), large }
const NODE = Number(SPACING['elk.spacing.nodeNode']), TOL = 1.5
let failed = 0
const check = (ok: boolean, what: string) => { if (!ok) { failed++; console.log('  FAIL', what) } }

for (const [name, src] of Object.entries(samples)) {
  const r = await layout(parse(src))
  const by = new Map(r.boxes.map(b => [b.id, b]))
  const gap = (a: typeof r.boxes[0], b: typeof a) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h))
  const minGap: Record<number, number> = {}
  for (const a of r.boxes) for (const b of r.boxes) if (a.id < b.id && a.parent === b.parent) minGap[a.level] = Math.min(minGap[a.level] ?? Infinity, gap(a, b))
  let side = Infinity, top = Infinity
  for (const b of r.boxes) { const p = b.parent && by.get(b.parent); if (p) { side = Math.min(side, b.x - p.x, p.x + p.w - b.x - b.w, p.y + p.h - b.y - b.h); top = Math.min(top, b.y - p.y) } }
  for (const [lv, g] of Object.entries(minGap)) check(g >= NODE - TOL, `${name}: sibling gap ${g} at level ${lv} < ${NODE}`)
  check(side >= PAD.side - TOL && top >= PAD.top - TOL, `${name}: padding ${side}/${top}`)

  const bodies: Body[] = r.boxes.map(b => ({ id: b.id, kind: b.kind, x0: b.x * S, z0: b.y * S, x1: (b.x + b.w) * S, z1: (b.y + b.h) * S, level: b.level, parent: b.parent }))
  const map = new Map(bodies.map(b => [b.id, b]))
  const ancestors = (id: string) => { const s = new Set<string>(); for (let q = map.get(id)?.parent; q; q = map.get(q)?.parent) s.add(q); return s }
  const lines: P3[][] = []
  let steps = 0, onNode = 0, inTray = 0
  for (const e of r.routes) {
    const l = stepRoute(e.points.map(([x, y]) => [x * S, y * S] as [number, number]), map.get(e.from)!, map.get(e.to)!, map)
    lines.push(l)
    l.slice(1).forEach((p, i) => {
      if (Math.abs(p[2] - l[i][2]) < 1e-9) return
      steps++
      for (const b of bodies) {
        if (!(p[0] > b.x0 && p[0] < b.x1 && p[1] > b.z0 && p[1] < b.z1)) continue
        if (b.kind === 'node') onNode++
        else if (!ancestors(e.from).has(b.id) && !ancestors(e.to).has(b.id)) inTray++
      }
    })
  }
  check(onNode === 0 && inTray === 0, `${name}: steps on a node ${onNode}, inside an unrelated tray ${inTray}`)

  const { slots, stats } = applyCrossings(lines, 'tunnel', bodies)
  let touching = 0
  const c = SLOT_W / 2
  for (const s of slots) for (const b of bodies) if (b.kind === 'node' && s.x0 < b.x1 && s.x1 > b.x0 && s.z0 - c < b.z1 && s.z1 + c > b.z0) touching++
  check(touching === 0, `${name}: ${touching} troughs touch a node`)
  console.log(`${name}: min sibling gap by level ${JSON.stringify(minGap)}, min side pad ${Math.round(side)}, min top ${Math.round(top)}; ${steps} steps (${onNode} on a node, ${inTray} in an unrelated tray); ${stats.crossings} crossings, ${slots.length} troughs (${stats.skipped} left plain), ${touching} touch a node`)
}
process.exit(failed ? 1 : 0)

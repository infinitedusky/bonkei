// The 50-node sample's lines (BON-102): at every crossing-avoidance level no line doubles back, none runs through a block or a
// tray it does not enter, and routes are no longer than main's relative to the straight distance (main: 1.12, route-metrics.ts
// with LAYOUT= main's layout.ts). The same while a node is dragged on the live router.
//   pnpm --filter @bonkei/playground test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
process.env.NOMAIN = '1'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { loadAvoid, createRouter, AVOID_CROSSINGS, TUNE } = await import(root + 'avoid.ts')
const { measureRoutes } = await import(root + 'routeMetrics.ts')
const { doublesBack, canGoDirect } = await import(root + 'monotone.ts')
const { metrics } = await import('./route-metrics.ts')

const MAIN_RATIO = 1.12
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const large = parse(ts.match(/const large = `([\s\S]*?)`/)![1])

const crossings: Record<string, number> = {}
for (const level of AVOID_CROSSINGS) {
  test(`50-node sample at ${level}: no line doubles back or runs through a block or foreign tray; length/direct within main's`, async () => {
    const r = await layout(large, { avoidCrossings: level })
    assert.equal(r.stats.route.error, null)
    const m = metrics(r)
    assert.deepEqual(m.backIds, [], 'doubling back')
    assert.deepEqual(m.throughIds, [], 'through a block')
    assert.deepEqual(m.trayIds, [], 'through a foreign tray')
    assert.ok(m.ratio <= MAIN_RATIO, `length/direct ${m.ratio}`)
    crossings[level] = m.cross
  })
}
test('50-node sample: some crosses fewer lines than off, strong fewer than some', () => {
  assert.ok(crossings.some < crossings.off && crossings.strong < crossings.some, JSON.stringify(crossings))
})

test('50-node sample, dragging a node 200 px in 5 px frames at every level: no line doubles back or runs through a block or foreign tray', async () => {
  const data = await layout(large)
  const A = await loadAvoid()
  const id = data.boxes.find((b: any) => b.kind === 'node' && b.parent)!.id
  for (const level of AVOID_CROSSINGS) {
    const r = createRouter(A, data, level)
    for (let i = 0; i < 40; i++) {
      r.move(id, 5, 0)
      const q = measureRoutes(data.boxes.map((b: any) => b.id === id ? { ...b, ...r.at(id) } : b), r.routes)
      assert.equal(q.doublingBack, 0, `${level} frame ${i}: doubling back`)
      assert.equal(q.throughBlocks, 0, `${level} frame ${i}: through a block`)
      assert.equal(q.throughTrays, 0, `${level} frame ${i}: through a foreign tray`)
    }
    r.dispose()
  }
})

test('50-node sample, every node dragged 60 px each way: no line through a block or foreign tray; a line turns back only where the drop leaves it no direct route', async () => {
  const data = await layout(large)
  const r = createRouter(await loadAvoid(), data)
  for (const n of data.boxes.filter((b: any) => b.kind === 'node')) for (const d of [[60, 0], [0, 60], [-60, 0], [0, -60]]) {
    r.move(n.id, d[0], d[1])
    const boxes = data.boxes.map((b: any) => { const a = r.at(b.id); return b.kind === 'node' ? { ...b, x: a.x, y: a.y } : b })
    const me = boxes.find((b: any) => b.id === n.id)
    // a block dropped on another (within 12 px) is not counted: a line cannot avoid a block that sits on its own end
    const dropped = boxes.some((o: any) => o.kind === 'node' && o.id !== n.id && o.x < me.x + me.w + 12 && o.x + o.w + 12 > me.x && o.y < me.y + me.h + 12 && o.y + o.h + 12 > me.y)
    if (!dropped) {
      const q = measureRoutes(boxes, r.routes)
      assert.equal(q.throughBlocks, 0, `${n.id} ${d}: through a block`)
      assert.equal(q.throughTrays, 0, `${n.id} ${d}: through a foreign tray`)
      for (const e of r.routes) if (doublesBack(e.points)) assert.ok(!canGoDirect(boxes, e, TUNE.buffer), `${n.id} ${d}: ${e.id} turns back but has a direct route`)
    }
    r.move(n.id, -d[0], -d[1])
  }
  r.dispose()
})

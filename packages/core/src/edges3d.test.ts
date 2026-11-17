import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSlots, stepRoute, findCrossings, applyCrossings, endHeight, surfaceAt, STEP_OFFSET, RISE, DIP, SLOT_W, type Body, type P3 } from './edges3d.ts'
import { TRAY, NODE_H } from './scale.ts'
import { reroute, dock, layout, sideMid, PAD, SPACING } from './layout.ts'
import { parse } from './parser.ts'
import type { Box } from './model.ts'

const body = (id: string, x0: number, z0: number, x1: number, z1: number, level = 0, over: Partial<Body> = {}): Body =>
  ({ id, kind: 'node', x0, z0, x1, z1, level, ...over })
const tray = (id: string, x0: number, z0: number, x1: number, z1: number, level = 0, parent?: string): Body =>
  ({ id, kind: 'group', x0, z0, x1, z1, level, parent })
const map = (...b: Body[]) => new Map(b.map(x => [x.id, x]))
const steps = (l: P3[]) => l.slice(1).filter((p, i) => Math.abs(p[2] - l[i][2]) > 1e-9)

test('end height is halfway up the block, per node height', () => {
  assert.equal(endHeight(body('a', 0, 0, 1, 1)), NODE_H / 2)
  assert.equal(endHeight(body('a', 0, 0, 1, 1, 2)), 2 * TRAY + NODE_H / 2)
  assert.equal(endHeight(body('a', 0, 0, 1, 1, 0, { height: 2 })), 1)
  assert.equal(endHeight(tray('t', 0, 0, 5, 5, 1)), TRAY + TRAY / 2)
})

test('same-height ends: no step', () => {
  const a = body('a', 0, 0, 2, 1), b = body('b', 6, 0, 8, 1)
  const l = stepRoute([[2, .5], [6, .5]], a, b, map(a, b))
  assert.deepEqual(l, [[2, .5, NODE_H / 2], [6, .5, NODE_H / 2]])
})

test('sibling trays at the same height: the line stays level', () => {
  const t1 = tray('t1', 0, 0, 4, 4), t2 = tray('t2', 8, 0, 12, 4)
  const a = body('a', 1, 1, 3, 2, 1, { parent: 't1' }), b = body('b', 9, 1, 11, 2, 1, { parent: 't2' })
  const l = stepRoute([[3, 1.5], [9, 1.5]], a, b, map(t1, t2, a, b))
  assert.equal(steps(l).length, 0)
})

test('climbing into a tray: one step, OFFSET outside its rim', () => {
  const t = tray('t', 4, 0, 10, 4)
  const a = body('a', 0, 1, 2, 2), b = body('b', 6, 1, 8, 2, 1, { parent: 't' })
  const l = stepRoute([[2, 1.5], [6, 1.5]], a, b, map(t, a, b))
  assert.equal(steps(l).length, 1)
  const up = l.find((p, i) => i > 0 && p[2] !== l[i - 1][2])!
  assert.ok(Math.abs(up[0] - (4 - STEP_OFFSET)) < 1e-9)
  assert.equal(l[0][2], endHeight(a)); assert.equal(l[l.length - 1][2], endHeight(b))
})

test('leaving nested trays: one step, outside the outermost, staying high until then', () => {
  const t0 = tray('t0', 0, 0, 12, 6), t1 = tray('t1', 2, 1, 8, 5, 1, 't0')
  const a = body('a', 3, 2, 5, 3, 2, { parent: 't1', height: 1.8 }), b = body('b', 16, 2, 18, 3)
  const l = stepRoute([[5, 2.5], [16, 2.5]], a, b, map(t0, t1, a, b))
  assert.equal(steps(l).length, 1)
  const down = l.find((p, i) => i > 0 && p[2] !== l[i - 1][2])!
  assert.ok(Math.abs(down[0] - (12 + STEP_OFFSET)) < 1e-9)
  assert.ok(down[0] > t0.x1) // never inside a tray
})

test('crosses no tray: the step stands OFFSET out from the higher end', () => {
  const a = body('a', 0, 0, 2, 1, 0, { height: 2 }), b = body('b', 8, 0, 10, 1)
  const l = stepRoute([[2, .5], [8, .5]], a, b, map(a, b))
  assert.equal(steps(l).length, 1)
  assert.ok(Math.abs(l.find((p, i) => i > 0 && p[2] !== l[i - 1][2])![0] - (2 + STEP_OFFSET)) < 1e-9)
  // reversed: the higher end is the last
  const r = stepRoute([[8, .5], [2, .5]], b, a, map(a, b))
  assert.ok(Math.abs(r.find((p, i) => i > 0 && p[2] !== r[i - 1][2])![0] - (2 + STEP_OFFSET)) < 1e-9)
})

test('edge to a tray itself steps like any other', () => {
  const t = tray('t', 6, 0, 12, 4)
  const a = body('a', 0, 1, 2, 2, 0, { height: 1.2 })
  const l = stepRoute([[2, 1.5], [6, 1.5]], a, t, map(t, a))
  assert.equal(steps(l).length, 1)
  assert.equal(l[l.length - 1][2], endHeight(t))
})

const L = (...p: P3[]): P3[] => p
test('crossings: horizontal against vertical, not shared endpoints or overlaps', () => {
  const h = L([0, 0, .35], [10, 0, .35]), v = L([5, -3, .35], [5, 3, .35])
  assert.equal(findCrossings([h, v]).length, 1)
  assert.equal(findCrossings([h, L([5, 0, .35], [5, 3, .35])]).length, 0) // T-join
  assert.equal(findCrossings([h, L([10, -3, .35], [10, 3, .35])]).length, 0) // at an endpoint
  assert.equal(findCrossings([h, L([2, 0, .35], [6, 0, .35])]).length, 0) // overlap
  assert.equal(findCrossings([h, L([3, 1, 0], [3, 1, .5])]).length, 0) // a step has no plan length
  const c = findCrossings([h, v])[0]
  assert.deepEqual([c.h.edge, c.v.edge], [0, 1]) // the one along x changes
})

test('lines at clearly different heights are found but do not touch', () => {
  const [c] = findCrossings([L([0, 0, 1.4], [10, 0, 1.4]), L([5, -3, .35], [5, 3, .35])])
  assert.equal(c.touches, false)
  assert.equal(applyCrossings([L([0, 0, 1.4], [10, 0, 1.4]), L([5, -3, .35], [5, 3, .35])], 'bridge', []).stats.bridge, 0)
})

const X = (): P3[][] => [L([0, 0, .35], [10, 0, .35]), L([5, -3, .35], [5, 3, .35])]
test('style none leaves the lines alone', () => {
  const { plans } = applyCrossings(X(), 'none', [])
  assert.deepEqual(plans[0].parts, [X()[0]]); assert.deepEqual(plans[1].parts, [X()[1]])
})
test('bridge: only the horizontal line changes, hopping over by RISE; same plan footprint', () => {
  const { plans, stats } = applyCrossings(X(), 'bridge', [])
  assert.equal(stats.bridge, 1)
  assert.deepEqual(plans[1].parts, [X()[1]])
  const top = Math.max(...plans[0].parts[0].map(p => p[2]))
  assert.ok(Math.abs(top - (.35 + RISE)) < 1e-9)
  // the plan route is unchanged (flat view matches)
  assert.deepEqual([...new Set(plans[0].parts[0].map(p => p[1]))], [0])
  // never touches: at the crossing x the hop is above the other line
  assert.ok(plans[0].parts[0].filter(p => Math.abs(p[0] - 5) < .5 && p[0] !== 5).every(p => p[2] === .35 || p[2] >= .35 + RISE))
})
test('tunnel: an open slot along the dipped stretch; on a tray it is cut in the tray top and the line stays inside the tray', () => {
  const g = applyCrossings(X(), 'tunnel', []).plans[0]
  assert.equal(g.slots.length, 1)
  const s = g.slots[0]
  assert.equal(s.z0, s.z1) // one line: a stadium
  assert.ok(s.top === 0 && s.tray === undefined && s.x0 < 5 && s.x1 > 5 && s.depth === 0.4)
  assert.ok(Math.abs(Math.min(...g.parts[0].map(p => p[2])) - -DIP.ground) < 1e-9)
  const dipped = g.parts[0].filter(p => p[2] < 0).map(p => p[0])
  assert.ok(s.x0 < Math.min(...dipped) && s.x1 > Math.max(...dipped)) // spans the dip plus a little
  assert.equal(SLOT_W, 0.3)
  const t = tray('t', -1, -5, 12, 5, 0)
  const o = applyCrossings(X(), 'tunnel', [t]).plans[0]
  assert.ok(o.slots[0].top === TRAY && o.slots[0].tray === 't' && o.slots[0].depth < TRAY) // shallower than the tray is thick
  const low = Math.min(...o.parts[0].map(p => p[2]))
  assert.ok(low >= 0 && low < TRAY) // inside the tray: not out of its bottom
  assert.deepEqual(surfaceAt(5, 0, [t]).top, TRAY)
  assert.equal(surfaceAt(50, 0, [t]).top, 0)
})
test('troughs close together merge into one; far apart stay two; the tray ones merge only with their own tray', () => {
  const s = (x0: number, x1: number, z: number, tray?: string) => ({ x0, x1, z0: z, z1: z, top: 0, depth: 0.4, tray })
  const m = mergeSlots([s(0, 1, 0), s(0.5, 1.5, 0.5), s(9, 10, 0)])
  assert.equal(m.length, 2)
  assert.deepEqual([m[0].x0, m[0].x1, m[0].z0, m[0].z1], [0, 1.5, 0, 0.5]) // the union's bounding rectangle
  assert.equal(mergeSlots([s(0, 1, 0), s(0, 1, 3)]).length, 2)
  assert.equal(mergeSlots([s(0, 1, 0, 't'), s(0, 1, 0.1)]).length, 2)
  assert.equal(mergeSlots([s(0, 1, 0, 't'), s(0.2, 1, 0.1, 't')]).length, 1)
})

test('portal: the line is cut in two, a pair faces apart along the line, either direction', () => {
  const { plans } = applyCrossings(X(), 'portal', [])
  assert.equal(plans[0].parts.length, 2); assert.equal(plans[0].portals.length, 1)
  const p = plans[0].portals[0]
  assert.ok(p.a[0] < 5 && p.b[0] > 5 && p.dir[0] === 1)
  assert.deepEqual(plans[0].parts[0].at(-1), p.a); assert.deepEqual(plans[0].parts[1][0], p.b)
  const rev = applyCrossings([L([10, 0, .35], [0, 0, .35]), L([5, -3, .35], [5, 3, .35])], 'portal', []).plans[0].portals[0]
  assert.ok(rev.a[0] > 5 && rev.b[0] < 5 && rev.dir[0] === -1)
})
test('two crossings on one segment share the room', () => {
  const lines: P3[][] = [L([0, 0, .35], [10, 0, .35]), L([4, -3, .35], [4, 3, .35]), L([5, -3, .35], [5, 3, .35])]
  const { plans, stats } = applyCrossings(lines, 'portal', [])
  assert.equal(stats.portal, 2)
  const xs = plans[0].portals.flatMap(q => [q.a[0], q.b[0]])
  assert.deepEqual([...xs].sort((a, b) => a - b), xs)
})

const bx = (id: string, x: number, y: number, w = 100, h = 50, over: Partial<Box> = {}): Box => ({ id, label: id, kind: 'node', shape: 'rect', x, y, w, h, level: 0, ...over })
test('reroute ends at side midpoints in every case', () => {
  const cases: [Box, Box][] = [
    [bx('a', 0, 0), bx('b', 0, 200)], [bx('a', 0, 0), bx('b', 30, 200)], [bx('a', 0, 200), bx('b', 0, 0)],
    [bx('a', 0, 0), bx('b', 300, 0)], [bx('a', 0, 0), bx('b', 300, 20)], [bx('a', 300, 0), bx('b', 0, 10)],
    [bx('a', 0, 0), bx('b', 200, 300, 400, 300, { kind: 'group' })],
  ]
  for (const [a, b] of cases) {
    const r = reroute(a, b)
    const onMid = (p: [number, number], x: Box) => (['N', 'S', 'E', 'W'] as const).some(s => { const m = sideMid(x, s); return Math.abs(m[0] - p[0]) < 1e-9 && Math.abs(m[1] - p[1]) < 1e-9 })
    assert.ok(onMid(r[0], a) && onMid(r.at(-1)!, b), JSON.stringify([a, b, r]))
    r.slice(1).forEach((p, i) => assert.ok(Math.abs(p[0] - r[i][0]) < 1e-9 || Math.abs(p[1] - r[i][1]) < 1e-9)) // orthogonal
  }
})
test('dock puts a stray end on the side midpoint with an orthogonal dogleg', () => {
  const b = bx('b', 100, 100)
  const r = dock([[0, 0], [0, 60], [120, 60], [120, 100]], b, 'N', true)
  assert.deepEqual(r.at(-1), [150, 100])
  r.slice(1).forEach((p, i) => assert.ok(Math.abs(p[0] - r[i][0]) < 1e-9 || Math.abs(p[1] - r[i][1]) < 1e-9))
})

test('every route of a nested sample meets its boxes at a side midpoint (libavoid picks the side; ELK was placed with flow-side ports)', async () => {
  const src = `flowchart TD
  subgraph P["Payments"]
    subgraph R["Risk"]
      F{Fraud} -->|flag| V[Review]
    end
    A[Pay API] --> F
    V -->|approve| C[Charge]
    C --> V
  end
  Client --> A
  C --> L[(Ledger)]
  R --> Audit`
  for (const dir of ['TD', 'LR']) {
    const g = parse(src.replace('flowchart TD', 'flowchart ' + dir))
    const r = await layout(g)
    const by = new Map(r.boxes.map(b => [b.id, b]))
    assert.equal(r.stats?.route?.error, null)
    for (const e of r.routes) {
      const a = by.get(e.from)!, b = by.get(e.to)!
      const near = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5
      const any = (p: number[], bx: Box) => (['N', 'S', 'E', 'W'] as const).some(sd => near(p, sideMid(bx, sd)))
      assert.ok(any(e.points[0], a), `${dir} ${e.id} start`)
      assert.ok(any(e.points.at(-1)!, b), `${dir} ${e.id} end`)
    }
  }
})

test('spacing holds at every nesting level: siblings are NODE_GAP apart, children are PAD from their tray edge', async () => {
  const src = `flowchart TD
  subgraph A["A"]
    subgraph B["B"]
      subgraph C["C"]
        c1[One] --> c2[Two]
        c1 --> c3[Three]
      end
      b1[Four] --> c1
      b2[Five] --> c3
    end
    subgraph D["D"]
      d1[Six] --> d2[Seven]
      d1 --> d3[Eight]
    end
    a1[Nine] --> b1
    B --> D
  end
  x1[Ten] --> a1
  x2[Eleven] --> d3
  subgraph E["E"]
    e1[Twelve] --> e2[Thirteen]
  end
  x1 --> e1`
  const r = await layout(parse(src))
  const NODE = Number(SPACING['elk.spacing.nodeNode']), tol = 1.5
  const gap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h))
  const byId = new Map(r.boxes.map(b => [b.id, b]))
  let pairs = 0, levels = new Set<number>()
  for (const a of r.boxes) for (const b of r.boxes) {
    if (a.id >= b.id || a.parent !== b.parent) continue
    pairs++; levels.add(a.level)
    assert.ok(gap(a, b) >= NODE - tol, `${a.id}/${b.id} at level ${a.level}: gap ${gap(a, b)}`)
  }
  assert.ok(levels.size >= 3 && pairs > 10)
  for (const b of r.boxes) {
    const p = b.parent && byId.get(b.parent)
    if (!p) continue
    assert.ok(b.x - p.x >= PAD.side - tol && p.x + p.w - (b.x + b.w) >= PAD.side - tol && p.y + p.h - (b.y + b.h) >= PAD.side - tol, `${b.id} to ${p.id} edge`)
    assert.ok(b.y - p.y >= PAD.top - tol, `${b.id} below ${p.id} label`)
  }
})

test('routes of edges against the flow are direct, and every end still sits on a side midpoint', async () => {
  const r = await layout(parse(`flowchart TD
  A --> B --> C --> D
  D --> A
  C --> A
  subgraph T["T"]
    E --> F --> G
    G --> E
  end
  B --> E`))
  const by = new Map(r.boxes.map(b => [b.id, b]))
  const onMid = (p: number[], b: typeof r.boxes[0]) => (['N', 'S', 'E', 'W'] as const).some(s => { const m = sideMid(b, s); return Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.5 })
  for (const e of r.routes) {
    assert.ok(onMid(e.points[0], by.get(e.from)!) && onMid(e.points.at(-1)!, by.get(e.to)!), e.id)
    e.points.slice(1).forEach((p, i) => assert.ok(Math.abs(p[0] - e.points[i][0]) < 1e-6 || Math.abs(p[1] - e.points[i][1]) < 1e-6))
  }
})

test('one line crossing four others is the one that gets past: the four stay straight', () => {
  const y = 0.35
  const lines: P3[][] = [
    [[0, 0, y], [8, 0, y]], [[0, 1.5, y], [8, 1.5, y]], [[0, 3, y], [8, 3, y]], [[0, 4.5, y], [8, 4.5, y]], // four along x
    [[4, -2, y], [4, 7, y]], // one along z crossing all four
  ]
  const { plans, stats } = applyCrossings(lines, 'bridge', [])
  assert.equal(stats.touching, 4)
  for (let i = 0; i < 4; i++) assert.deepEqual(plans[i].parts, [lines[i]], `line ${i} stays straight`)
  assert.ok(plans[4].parts[0].length > 2, 'the crosser hops')
  assert.equal(stats.bridge, 4)
})

test('a line that runs along the side of a tray stays at its own height until it is about to enter, then steps', () => {
  const t = tray('t', 0, 0, 10, 4)
  const a = body('a', -3, 3.8, -1, 4.8), b = body('b', 7, 1, 9, 2, 1, { parent: 't' })
  // along the rim, 0.3 outside it (closer than the step offset), then in at x = 8 through the bottom rim (z = 4)
  const pts: [number, number][] = [[-1, 4.3], [8, 4.3], [8, 2]]
  const l = stepRoute(pts, a, b, map(t, a, b))
  assert.equal(steps(l).length, 1)
  const i = l.findIndex((p, k) => k > 0 && p[2] !== l[k - 1][2])
  const up = l[i]
  // it crosses the rim at (8, 4): the step is STEP_OFFSET of line before that, so on the run just before the turn, not at the first x within STEP_OFFSET of the tray
  assert.ok(Math.abs((8 - up[0]) + 0.3 - STEP_OFFSET) < 1e-9, `step at x ${up[0]}`)
  for (let k = 0; k < i; k++) assert.equal(l[k][2], endHeight(a), 'low until the step')
})

// The libavoid router (BON-99): side pins, tray closure, docks at a tray, a live drag. Hand-made layouts, so the expected routes are plain.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAvoid, createRouter, TUNE } from './avoid.ts'
import { layout } from './layout.ts'
import { parse } from './parser.ts'
import type { Box, LayoutResult, Route } from './model.ts'

const node = (id: string, x: number, y: number, parent?: string, level = 0): Box => ({ id, label: id, kind: 'node', shape: 'rect', x, y, w: 110, h: 56, level, parent })
const tray = (id: string, x: number, y: number, w: number, h: number): Box => ({ id, label: id, kind: 'group', shape: 'rect', x, y, w, h, level: 0 })
const edge = (id: string, from: string, to: string): Route => ({ id, from, to, points: [[0, 0], [1, 1]] })
const lay = (boxes: Box[], routes: Route[]): LayoutResult => ({ boxes, routes, width: 1200, height: 800 })
const mids = (b: Box): [number, number][] => [[b.x + b.w / 2, b.y], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2], [b.x + b.w, b.y + b.h / 2]]
const onMid = (p: number[], b: Box) => mids(b).some(m => Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.5)
const hits = (r: Route, b: Box, shrink = 0) => r.points.slice(1).some((q, i) => {
  const p = r.points[i]
  return Math.max(p[0], q[0]) > b.x + shrink && Math.min(p[0], q[0]) < b.x + b.w - shrink && Math.max(p[1], q[1]) > b.y + shrink && Math.min(p[1], q[1]) < b.y + b.h - shrink
})
const orthogonal = (r: Route) => r.points.slice(1).every((q, i) => Math.abs(q[0] - r.points[i][0]) < 1e-6 || Math.abs(q[1] - r.points[i][1]) < 1e-6)

const A = await loadAvoid()

test('both ends of every line sit on a side midpoint, and the line is orthogonal', () => {
  const d = lay([node('a', 100, 100), node('b', 500, 300), node('c', 100, 500)], [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'a', 'c')])
  const r = createRouter(A, d)
  const by = new Map(d.boxes.map(b => [b.id, b]))
  for (const e of r.routes) {
    assert.ok(onMid(e.points[0], by.get(e.from)!), `${e.id} start`)
    assert.ok(onMid(e.points.at(-1)!, by.get(e.to)!), `${e.id} end`)
    assert.ok(orthogonal(e), e.id)
  }
  assert.deepEqual(r.stats.failed, [])
  r.dispose()
})

test('a line goes around a block that stands in its way', () => {
  const d = lay([node('a', 100, 300), node('wall', 400, 280, undefined), node('b', 800, 300)], [edge('e', 'a', 'b')])
  d.boxes[1].h = 120
  const r = createRouter(A, d)
  assert.ok(!hits(r.routes[0], d.boxes[1]), 'does not cross the block')
  r.dispose()
})

test('a tray nobody enters is closed: a line between nodes outside goes around it', () => {
  const T = tray('T', 400, 200, 300, 400)
  const d = lay([T, node('in', 480, 380, 'T', 1), node('l', 100, 380), node('r', 900, 380)], [edge('across', 'l', 'r')])
  const r = createRouter(A, d)
  assert.ok(!hits(r.routes[0], T, 1), 'stays outside the tray')
  assert.deepEqual(r.stats.failed, [])
  r.dispose()
})

test('lines that belong to a tray enter and leave it, ending at side midpoints, crossing no node', () => {
  const T = tray('T', 400, 200, 300, 400)
  const d = lay([T, node('in', 480, 380, 'T', 1), node('l', 100, 380), node('far', 900, 100)], [edge('into', 'l', 'in'), edge('out', 'in', 'far')])
  const r = createRouter(A, d)
  const [into, out] = r.routes
  assert.ok(hits(into, T, 1) && hits(out, T, 1))
  assert.ok(onMid(into.points.at(-1)!, d.boxes[1]) && onMid(out.points[0], d.boxes[1]))
  assert.deepEqual(r.stats.failed, [])
  r.dispose()
})

test('openings leak, gates do not: a line aligned with another line\'s opening may pass through the tray; with gates it never does', () => {
  const T = tray('T', 400, 200, 300, 400)
  const boxes = () => [T, node('in', 480, 380, 'T', 1), node('l', 100, 380), node('r', 900, 380), node('far', 900, 100)]
  const routes = () => [edge('across', 'l', 'r'), edge('into', 'l', 'in'), edge('out', 'in', 'far')]
  const gated = createRouter(A, lay(boxes(), routes()), { ...TUNE, trays: 'gates' })
  assert.ok(!hits(gated.routes[0], T, 1), 'with gates the line past stays outside')
  assert.ok(hits(gated.routes[1], T, 1) && hits(gated.routes[2], T, 1), 'and the lines that belong enter and leave')
  assert.deepEqual(gated.stats.failed, [])
  gated.dispose()
})

test('an edge to a tray itself ends at a side midpoint of the tray', () => {
  const T = tray('T', 400, 200, 300, 400)
  const d = lay([T, node('in', 480, 380, 'T', 1), node('l', 100, 380)], [edge('toTray', 'l', 'T')])
  const r = createRouter(A, d)
  assert.ok(onMid(r.routes[0].points.at(-1)!, T), 'at a tray side midpoint')
  assert.ok(onMid(r.routes[0].points[0], d.boxes[2]))
  r.dispose()
})

test('dragging: the same router re-routes around the moved block, ends stay on midpoints', () => {
  const d = lay([node('a', 100, 300), node('b', 800, 300), node('m', 450, 100)], [edge('e', 'a', 'b')])
  const r = createRouter(A, d)
  const before = r.routes[0].points.length
  r.move('m', 0, 200) // into the line's way
  const m = { ...d.boxes[2], y: 300 }
  assert.ok(!hits(r.routes[0], m), 'goes around the block dropped on its path')
  assert.ok(onMid(r.routes[0].points[0], d.boxes[0]) && onMid(r.routes[0].points.at(-1)!, d.boxes[1]))
  assert.ok(r.routes[0].points.length > before, 'it bent')
  assert.deepEqual(r.at('m'), { x: 450, y: 300 })
  r.reset()
  assert.deepEqual(r.at('m'), { x: 450, y: 100 })
  assert.equal(r.routes[0].points.length, before)
  r.dispose()
})

test('layout routes with libavoid: no line through a block or a tray it does not enter, on a nested sample', async () => {
  const r = await layout(parse(`flowchart TD
  subgraph P["Payments"]
    subgraph R["Risk"]
      F{Fraud} -->|flag| V[Review]
    end
    A[Pay API] --> F
    V -->|approve| C[Charge]
    C --> V
  end
  subgraph Q["Other"]
    X[Ex] --> Y[Why]
  end
  Client --> A
  Client --> X
  C --> L[(Ledger)]
  R --> Audit`))
  assert.equal(r.stats?.route?.error, null)
  assert.deepEqual(r.stats?.route?.failed, [])
  const by = new Map(r.boxes.map(b => [b.id, b]))
  const anc = (id: string) => { const l: string[] = []; for (let p = by.get(id)?.parent; p; p = by.get(p)?.parent) l.push(p); return l }
  for (const e of r.routes) for (const b of r.boxes) {
    if (b.id === e.from || b.id === e.to) continue
    if (b.kind === 'node') assert.ok(!hits(e, b), `${e.id} through ${b.id}`)
    else if (!anc(e.from).includes(b.id) && !anc(e.to).includes(b.id)) assert.ok(!hits(e, b, 1), `${e.id} through tray ${b.id}`)
  }
})

test('the tuning keeps the router fast to move: no crossing cost while dragging', () => {
  assert.equal(TUNE.dragCrossing, 0)
})

test('routing basic: ELK\'s own routes, no libavoid; advanced keeps ELK\'s routes beside the new ones', async () => {
  const g = parse(`flowchart TD
  subgraph T["T"]
    A --> B
  end
  C --> B
  A --> C`)
  const basic = await layout(g, { routing: 'basic' })
  assert.equal(basic.stats?.route, undefined)
  assert.equal(basic.elkRoutes, undefined)
  const adv = await layout(g, { routing: 'advanced' })
  assert.equal(adv.stats?.route?.error, null)
  assert.deepEqual(adv.elkRoutes, basic.routes)
  assert.equal(adv.routes.length, basic.routes.length)
})

test('the routing option reads from frontmatter and props override it', async () => {
  const { prepare } = await import('./diagram.ts')
  const { mergeOptions } = await import('./options.ts')
  const src = '---\nconfig:\n  bonkei:\n    routing: basic\n---\nflowchart TD\nA --> B'
  const p = await prepare(src)
  assert.equal(p.options.routing, 'basic')
  assert.equal(p.data && 'elkRoutes' in p.data, false, 'basic from frontmatter: not routed by libavoid')
  assert.equal(mergeOptions({}, p.options).routing, 'basic')
  assert.equal(mergeOptions({ routing: 'advanced' }, p.options).routing, 'advanced')
  assert.equal(mergeOptions().routing, 'advanced')
})

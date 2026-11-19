import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCamera } from './camera.ts'
import { S } from './scale.ts'

test('setMode on one camera leaves another untouched', () => {
  const a = createCamera(), b = createCamera()
  const mode0 = b.mode, goal0 = structuredClone(b.goal)
  a.setMode('3d')
  assert.equal(a.mode, '3d')
  assert.deepEqual(b.mode, mode0)
  assert.deepEqual(b.goal, goal0)
})

test('focusOn on one camera leaves another untouched', () => {
  const a = createCamera(), b = createCamera()
  const { tx, tz, H } = b.goal
  a.focusOn(5, 5, 10, 10)
  assert.equal(a.goal.tx, 5)
  assert.equal(b.goal.tx, tx)
  assert.equal(b.goal.tz, tz)
  assert.equal(b.goal.H, H)
})

test('fresh cameras do not share goal or cur objects', () => {
  const a = createCamera(), b = createCamera()
  assert.notEqual(a.goal, b.goal)
  assert.notEqual(a.cur, b.cur)
  assert.notEqual(a.goal, a.cur)
})

test('fit frames the whole diagram at the origin, scaled to world units', () => {
  const a = createCamera(), b = createCamera()
  a.fit(800, 400)
  b.focusOn(0, 0, 800 * S, 400 * S)
  assert.deepEqual(a.focus, { cx: 0, cz: 0, X: 800 * S, Z: 400 * S })
  assert.deepEqual(a.goal, b.goal)
})

test('fit uses the current aspect', () => {
  const wide = createCamera(), tall = createCamera()
  wide.setMode('flat'); tall.setMode('flat')
  wide.aspect = 3; tall.aspect = 0.5
  wide.fit(1200, 400); tall.fit(1200, 400)
  assert.ok(tall.goal.H > wide.goal.H)
})

test('snap jumps cur to goal without sharing the object', () => {
  const a = createCamera()
  a.setMode('3d'); a.fit(600, 600)
  assert.notDeepEqual(a.cur, a.goal)
  a.snap()
  assert.deepEqual(a.cur, a.goal)
  assert.notEqual(a.cur, a.goal)
  a.goal.H += 5
  assert.notEqual(a.cur.H, a.goal.H)
})

// --- view stays put across layouts ---
import type { Frame } from './camera.ts'
const bx = (id: string, x: number, y: number, w = 100, h = 50, kind: 'node' | 'group' = 'node', parent?: string) => ({ id, kind, x, y, w, h, parent })
const frame = (width: number, height: number, boxes: Frame['boxes']): Frame => ({ width, height, boxes })
const A = () => frame(600, 400, [bx('g', 50, 50, 400, 300, 'group'), bx('h', 100, 100, 200, 150, 'group', 'g'), bx('a', 120, 130, 80, 40, 'node', 'h'), bx('b', 400, 300)])
const zoomed = () => {
  const c = createCamera(); c.fit(600, 400); c.adopt(A()); c.snap()
  c.goal.tx = (160 - 300) * S; c.goal.tz = (150 - 200) * S; c.goal.H = 5; c.snap() // looking at node a
  return c
}
const screen = (c: ReturnType<typeof createCamera>, f: Frame, id: string) => {
  const b = f.boxes.find(x => x.id === id)!
  return [(b.x + b.w / 2 - f.width / 2) * S - c.goal.tx, (b.y + b.h / 2 - f.height / 2) * S - c.goal.tz]
}

test('an identical second layout leaves goal and cur unchanged', () => {
  const c = zoomed(); const g = structuredClone(c.goal), u = structuredClone(c.cur)
  c.relayout(A())
  assert.deepEqual(c.goal, g); assert.deepEqual(c.cur, u)
})

test('a wider diagram does not slide what is on screen', () => {
  const c = zoomed(); const before = screen(c, A(), 'a')
  const wider = frame(1000, 400, A().boxes)
  c.relayout(wider)
  const after = screen(c, wider, 'a')
  assert.ok(Math.abs(after[0] - before[0]) < 1e-9 && Math.abs(after[1] - before[1]) < 1e-9)
  assert.equal(c.goal.H, 5)
})

test('with no shared node the origin shift is compensated', () => {
  const c = zoomed(); const k = c.relayout(frame(800, 400, [bx('z', 0, 0)]))
  assert.equal(k.anchor, 'origin'); assert.equal(c.goal.tx, (160 - 300) * S + (600 - 800) / 2 * S)
})

test('fit after an edit frames the new extent', () => {
  const c = zoomed(); const w = frame(1000, 700, A().boxes)
  c.relayout(w); c.fit(1000, 700)
  assert.deepEqual(c.focus, { cx: 0, cz: 0, X: 1000 * S, Z: 700 * S })
  assert.equal(c.focusId, undefined)
})

test('tray tracking survives an edit; mode switch frames the tray at its new size', () => {
  const c = zoomed(); c.focusOn((200 - 300) * S, (175 - 200) * S, 200 * S, 150 * S, 'h')
  const g = structuredClone(c.goal)
  const next = frame(600, 400, [bx('g', 50, 50, 400, 300, 'group'), bx('h', 100, 100, 260, 190, 'group', 'g'), bx('a', 120, 130, 80, 40, 'node', 'h')])
  const k = c.relayout(next)
  assert.equal(k.tray, 'found'); assert.equal(c.focusId, 'h')
  assert.deepEqual(c.goal, g) // camera did not move
  assert.equal(c.focus.X, 260 * S)
  c.setMode('flat')
  assert.equal(c.goal.tx, (230 - 300) * S) // now centred on the resized tray
  assert.equal(c.goal.H, Math.max(190 * S, 260 * S / c.aspect) * 1.12)
})

test('a deleted tray falls back to its parent, then to the whole diagram', () => {
  const c = zoomed(); c.focusOn(0, 0, 1, 1, 'h')
  const g = structuredClone(c.goal)
  let k = c.relayout(frame(600, 400, [bx('g', 50, 50, 400, 300, 'group'), bx('b', 400, 300)]))
  assert.equal(k.tray, 'parent'); assert.equal(c.focusId, 'g'); assert.deepEqual(c.goal, g)
  k = c.relayout(frame(600, 400, [bx('b', 400, 300)]))
  assert.equal(k.tray, 'diagram'); assert.equal(c.focusId, undefined)
  assert.deepEqual(c.focus, { cx: 0, cz: 0, X: 600 * S, Z: 400 * S })
})

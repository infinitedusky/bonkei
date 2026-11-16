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

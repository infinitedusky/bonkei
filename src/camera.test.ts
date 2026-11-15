import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCamera } from './camera.ts'

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

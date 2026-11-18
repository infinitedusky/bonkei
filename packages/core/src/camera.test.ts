import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCamera, nearestTurn, PRESET } from './camera.ts'
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

test('a tight fit frames the diagram closer than the default fit, in every mode', async () => {
  for (const m of ['flat', 'iso', '3d'] as const) {
    const loose = createCamera(), tight = createCamera()
    tight.tight = true
    for (const c of [loose, tight]) { c.setMode(m); c.aspect = 2; c.fit(1200, 500) }
    assert.ok(tight.goal.H < loose.goal.H, `${m}: ${tight.goal.H} < ${loose.goal.H}`)
  }
})

test('minLabel opens closer when the whole diagram would make labels too small, and Fit (whole) still shows it all', () => {
  const c = createCamera()
  c.setMode('flat'); c.aspect = 0.5; c.frameH = 300
  c.fit(3000, 1500)
  const all = c.goal.H
  c.minLabel = 11; c.whole = false
  c.fit(3000, 1500)
  assert.ok(c.goal.H < all)
  assert.ok(Math.abs((c.frameH / c.goal.H) * 0.36 - 11) < 1e-9) // a 0.36-unit label is 11 px
  c.whole = true
  c.fit(3000, 1500)
  assert.equal(c.goal.H, all)
})

test('biggestTray finds the largest top-level tray, in world units about the diagram centre', async () => {
  const { biggestTray } = await import('./camera.ts')
  const boxes = [
    { kind: 'group', level: 0, x: 0, y: 0, w: 100, h: 100 },
    { kind: 'group', level: 0, x: 200, y: 0, w: 300, h: 200 },
    { kind: 'group', level: 1, x: 210, y: 10, w: 1000, h: 1000 }, // nested: not a candidate
    { kind: 'node', level: 0, x: 0, y: 0, w: 2000, h: 2000 },
  ]
  assert.deepEqual(biggestTray(boxes, 600, 400), { cx: (350 - 300) * S, cz: (100 - 200) * S })
  assert.deepEqual(biggestTray([], 600, 400), { cx: 0, cz: 0 })
})

test('projectedFit centres the boxes the view shows and fits their projected extent', async () => {
  const { projectedFit, PRESET } = await import('./camera.ts')
  // flat: one box off-centre is looked at from straight above its middle
  const flat = projectedFit([{ x0: 2, z0: -1, x1: 6, z1: 3 }], 'flat', 2)
  assert.ok(Math.abs(flat.tx - 4) < 0.01 && Math.abs(flat.tz - 1) < 0.01, `${flat.tx}, ${flat.tz}`)
  assert.ok(Math.abs(flat.H - (4 + 1.2)) < 0.01) // 4 tall (z), 4 wide / aspect 2 = 2: the height decides, plus the margins
  // iso: the camera's target lands in the middle of the projected extent
  const rects = [{ x0: -10, z0: -1, x1: -6, z1: 1 }, { x0: 6, z0: 3, x1: 10, z1: 5 }]
  const iso = projectedFit(rects, 'iso', 1.6)
  const { yaw, pitch } = PRESET.iso
  const u = (x: number, z: number) => x * Math.cos(yaw) - z * Math.sin(yaw)
  const us = rects.flatMap(r => [u(r.x0, r.z0), u(r.x0, r.z1), u(r.x1, r.z0), u(r.x1, r.z1)])
  assert.ok(Math.abs(u(iso.tx, iso.tz) - (Math.min(...us) + Math.max(...us)) / 2) < 1e-9)
  void pitch
})

test('a tight fit of a diagonal diagram frames its boxes closer than its whole rectangle, and flying into a tray is unchanged', async () => {
  const { contentOf } = await import('./camera.ts')
  // two boxes at the front-left and back-right corners of a wide diagram: iso turns their band across the screen, much thinner than the turned rectangle
  const boxes = [{ level: 0, x: 0, y: 340, w: 100, h: 60 }, { level: 0, x: 900, y: 0, w: 100, h: 60 }, { level: 1, x: 10, y: 350, w: 20, h: 20 }]
  assert.equal(contentOf(boxes, 1000, 400).length, 2) // only the top level
  const rect = createCamera(), boxed = createCamera()
  for (const c of [rect, boxed]) { c.tight = true; c.aspect = 2.4 }
  boxed.content = contentOf(boxes, 1000, 400)
  rect.fit(1000, 400); boxed.fit(1000, 400)
  assert.ok(boxed.goal.H < rect.goal.H, `${boxed.goal.H} < ${rect.goal.H}`)
  boxed.focusOn(3, 3, 5, 5) // a tray flown into: no content framing
  rect.focusOn(3, 3, 5, 5)
  assert.deepEqual(boxed.goal, rect.goal)
})

test('content framing is only for a tight fit: the default fit ignores it', () => {
  const a = createCamera(), b = createCamera()
  a.content = [{ x0: 0, z0: 0, x1: 1, z1: 1 }]
  a.fit(800, 400); b.fit(800, 400)
  assert.deepEqual(a.goal, b.goal)
})

test('square() puts a turned and tilted view back on its own heading, the short way round (BON-78)', () => {
  const c = createCamera()
  c.setMode('3d')
  c.goal.yaw += 0.9; c.goal.pitch = 1.2
  c.square()
  assert.equal(c.goal.yaw, PRESET['3d'].yaw)
  assert.equal(c.goal.pitch, PRESET['3d'].pitch)
  // turned three and a bit full turns: no spinning back through all of them
  c.setMode('iso')
  c.goal.yaw = PRESET.iso.yaw + 6 * Math.PI + 0.4
  c.square()
  assert.ok(Math.abs(c.goal.yaw - (PRESET.iso.yaw + 6 * Math.PI)) < 1e-9)
})

test('fit() alone keeps a turned view turned: a new layout does not undo the reader\'s turn', () => {
  const c = createCamera()
  c.goal.yaw = PRESET.iso.yaw + Math.PI / 2
  c.fit(100, 80)
  assert.equal(c.goal.yaw, PRESET.iso.yaw + Math.PI / 2)
})

test('nearestTurn: the target heading plus whole turns, nearest the current one', () => {
  assert.equal(nearestTurn(0.1, 0), 0)
  assert.ok(Math.abs(nearestTurn(2 * Math.PI + 0.1, 0) - 2 * Math.PI) < 1e-9)
  assert.ok(Math.abs(nearestTurn(-7, 0) + 2 * Math.PI) < 1e-9)
})

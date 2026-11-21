import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCamera, nearestTurn, PRESET, type Frame } from './camera.ts'
import { S } from './scale.ts'
import { framed } from './stageZones.ts'

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

test('a fit shows a small stage\'s floating name whole, top letter and all, in flat and iso', () => {
  // made-up sample: a 1 m cube named "drive through window", too long a name for its zone or its sides, so it floats
  const body = { x0: -0.5, x1: 0.5, z0: -0.5, z1: 0.5, y0: 0, y1: 1 }
  const stage = framed({
    kind: 'stage', width: 1 / S, height: 1 / S, tall: 1, url: '/stages/cube.glb', model: null as never, floor: null,
    blockers: [{ x0: -0.5, x1: 0.5, z0: -0.5, z1: 0.5, h: 1, part: 0 }],
    parts: [{ id: 'p0', label: 'drive through window', x: 0, y: 0, w: 1 / S, h: 1 / S, top: 1, cx: 0, cz: 0, pieces: 0, body, solids: [body] }],
  })
  assert.equal(stage.zones![0]?.title, null)
  assert.equal(stage.sides![0], null)
  assert.equal(stage.upright!.length, 1)
  for (const mode of ['flat', 'iso'] as const) for (const aspect of [1.6, 0.6]) {
    const c = createCamera()
    c.aspect = aspect; c.top = 1.6 + 1.4 * stage.reach! // as SceneView sets it for the Classic theme
    c.upright = stage.upright!
    c.setMode(mode); c.fit(stage.width, stage.height)
    const { yaw, pitch } = PRESET[mode], u = stage.upright![0]
    // the column's top on the screen's up axis, from the point the view is centred on: the foot projected, then the letters at full height
    const top = -((u.x - c.goal.tx) * Math.sin(yaw) + (u.z - c.goal.tz) * Math.cos(yaw)) * Math.sin(pitch) + u.y * Math.cos(pitch) + u.h
    assert.ok(top <= c.goal.H / 2, `${mode} at ${aspect}: the name's top (${top.toFixed(2)}) is inside the view (${(c.goal.H / 2).toFixed(2)})`)
  }
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

// --- the view stays put across layouts (BON-195) ---
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

test('when everything on screen is deleted the origin shift is used, not a far-off survivor', () => {
  const c = zoomed() // H 5: looking at node a, which is about to go; b is far away
  const g = structuredClone(c.goal)
  const k = c.relayout(frame(800, 400, [bx('b', 400, 300)]))
  assert.equal(k.anchor, 'origin')
  assert.equal(c.goal.tx, g.tx + (600 - 800) / 2 * S)
})

test('with no node on screen, the tray the view is inside anchors it', () => {
  // look at an empty corner of tray g (no node near): g moves 100px right, so the view moves with it
  const c = createCamera(); c.fit(600, 400); c.adopt(A())
  c.goal.tx = (400 - 300) * S; c.goal.tz = (90 - 200) * S; c.goal.H = 2; c.snap()
  const moved = frame(600, 400, A().boxes.map(b => b.id === 'g' ? { ...b, x: 150 } : b))
  const before = c.goal.tx
  const k = c.relayout(moved)
  assert.equal(k.anchor, 'tray')
  assert.ok(Math.abs(c.goal.tx - (before + 100 * S)) < 1e-9)
  assert.equal(c.cur.tx, c.goal.tx) // no glide: cur moves with goal
})

test('without a tray flown into, a mode switch after an edit keeps the pan (as before the edit)', () => {
  const c = zoomed(); const tx = c.goal.tx
  c.relayout(A())
  c.setMode('3d')
  assert.equal(c.goal.tx, tx)
})

test('frameOf: a sequence diagram is lined up by its participants', async () => {
  const { frameOf } = await import('./camera.ts')
  const f = frameOf({ width: 390, height: 300, parts: [{ id: 'A', x: 45, y: 20, w: 110, h: 52 }] })
  assert.deepEqual(f.boxes, [{ id: 'A', kind: 'node', x: 45, y: 20, w: 110, h: 52 }])
  // a participant added on the right widens the diagram: A stays where it is on screen
  const c = createCamera(); c.fit(390, 300); c.adopt(f)
  c.goal.tx = (100 - 195) * S; c.goal.tz = (46 - 150) * S; c.goal.H = 4; c.snap()
  const wider = frameOf({ width: 580, height: 340, parts: [{ id: 'A', x: 45, y: 20, w: 110, h: 52 }, { id: 'B', x: 235, y: 20, w: 110, h: 52 }] })
  const k = c.relayout(wider)
  assert.equal(k.anchor, 'node')
  assert.ok(Math.abs(c.goal.tx - (100 - 290) * S) < 1e-9 && Math.abs(c.goal.tz - (46 - 170) * S) < 1e-9)
})

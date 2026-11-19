import { test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import {
  ALL_ON, chipAt, cursorFor, dragAction, fitUsed, gesture, gestureRows, guessInput, helpToggled, hintShown, hintText, holdChanged, holdable, insetRadii,
  isPinch, isSwapped, modKey, pairOf, settleYaw, swipeLatch, twoFingers, wheelAction, wheelInput, wheelPan, wheelPx, wheelTurn, wheelZoom, WHEEL_IDLE_MS,
} from './controls.ts'
import { resolveControls } from './options.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())
const controlSpans = () => exporter.getFinishedSpans().filter(s => s.name === 'bonkei.control')
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)

const off = resolveControls(false)
const MODES = ['flat', 'iso', '3d'] as const
const plain = { ctrlKey: false, metaKey: false }

// ---- the wheel ----

test('pinch (ctrl wheel) and cmd + wheel zoom in every view, held or not; with zoom off they are left to the page', () => {
  for (const mode of MODES) for (const k of [{ ctrlKey: true, metaKey: false }, { ctrlKey: false, metaKey: true }]) {
    assert.equal(wheelAction(ALL_ON, k, false, mode), 'zoom')
    assert.equal(wheelAction(ALL_ON, k, true, mode), 'zoom')
    assert.equal(wheelAction({ ...ALL_ON, zoom: false }, k, true, mode), 'pass')
  }
})

test('a plain wheel or two-finger drag moves a diagram that has the gestures, and asks for a hint otherwise', () => {
  for (const mode of MODES) {
    assert.equal(wheelAction(ALL_ON, plain, true, mode), 'pan')
    assert.equal(wheelAction(ALL_ON, plain, false, mode), 'hint')
    assert.equal(wheelAction({ ...ALL_ON, pan: false }, plain, true, mode), 'pass')
  }
})

test('a mostly sideways wheel over a diagram not held is stopped (no Back) and hinted; a mostly vertical one is left to the page', () => {
  for (const mode of MODES) {
    // a trackpad swipe sideways: small fractional px steps
    assert.equal(wheelAction(ALL_ON, { ...plain, deltaX: -0.5, deltaY: 0 }, false, mode), 'block')
    assert.equal(wheelAction(ALL_ON, { ...plain, deltaX: 3.25, deltaY: -1.5 }, false, mode), 'block')
    assert.equal(wheelAction(ALL_ON, { ...plain, deltaX: 1, deltaY: 4 }, false, mode), 'hint')
    assert.equal(wheelAction(ALL_ON, { ...plain, deltaX: 2, deltaY: -2 }, false, mode), 'hint')
    assert.equal(wheelAction(ALL_ON, { ...plain, deltaX: 0, deltaY: 0 }, false, mode), 'hint')
    // held, sideways moves as before; with pan off it is still the page's
    assert.equal(wheelAction(ALL_ON, { ...plain, deltaX: -0.5, deltaY: 0 }, true, mode), 'pan')
    assert.equal(wheelAction({ ...ALL_ON, pan: false }, { ...plain, deltaX: -0.5, deltaY: 0 }, false, mode), 'pass')
  }
})

test('a stopped sideways swipe stays stopped to its end, momentum and up-and-down jitter included; a new gesture is decided afresh', () => {
  const latch = swipeLatch()
  // a Mac trackpad swipe left over a diagram not held: mostly sideways, with an event or two that go more up or down
  const swipe = [[-3, 0.5], [-6, 1], [0, 1], [-8, -2], [0.5, -1.5], [-4, 0]]
  let t = 0
  for (const [deltaX, deltaY] of swipe) {
    assert.equal(latch(wheelAction(ALL_ON, { ...plain, deltaX, deltaY }, false, 'iso'), t), 'block')
    t += 16
  }
  // its momentum, after the fingers lift
  t += 40
  for (let i = 0; i < 10; i++, t += 16) assert.equal(latch(wheelAction(ALL_ON, { ...plain, deltaX: -1, deltaY: 0.2 * (i % 3) }, false, 'iso'), t), 'block')
  // the wheel has been still: a scroll down is the page's again
  t += WHEEL_IDLE_MS + 1
  assert.equal(latch(wheelAction(ALL_ON, { ...plain, deltaX: 0, deltaY: 5 }, false, 'iso'), t), 'hint')
  assert.equal(latch(wheelAction(ALL_ON, { ...plain, deltaX: -2, deltaY: 6 }, false, 'iso'), t + 16), 'hint')
  // a scroll down that starts the gesture is left to the page all the way (a sideways event in it is still stopped)
  assert.equal(latch(wheelAction(ALL_ON, { ...plain, deltaX: 0, deltaY: 4 }, false, 'iso'), t + 32), 'hint')
  // anything the diagram uses (held, zoom) is never changed, and ends the latch
  const latch2 = swipeLatch()
  assert.equal(latch2('block', 0), 'block')
  assert.equal(latch2('pan', 16), 'pan')
  assert.equal(latch2('hint', 32), 'hint')
  assert.equal(latch2('block', 48), 'block')
  assert.equal(latch2('zoom', 64), 'zoom')
  assert.equal(latch2('pass', 80), 'pass')
})

test('3d: Shift + wheel turns; flat and iso keep moving (sideways)', () => {
  const shift = { ...plain, shiftKey: true }
  assert.equal(wheelAction(ALL_ON, shift, true, '3d'), 'turn')
  assert.equal(wheelAction(ALL_ON, shift, true, 'iso'), 'pan')
  assert.equal(wheelAction(ALL_ON, shift, true, 'flat'), 'pan')
})

test('scrolling down moves the diagram up like a page; Shift + a mouse wheel moves it sideways', () => {
  assert.deepEqual(wheelPan(0, 40, false), [-0, -40])
  assert.deepEqual(wheelPan(12, 3, false), [-12, -3])
  assert.deepEqual(wheelPan(0, 40, true), [-40, 0])
  // the system already turned Shift + wheel into deltaX: used as it is
  assert.deepEqual(wheelPan(40, 0, true), [-40, -0])
})

test('wheel deltas in lines and pages become px', () => {
  assert.deepEqual(wheelPx({ deltaMode: 0, deltaX: 1.5, deltaY: -3 }, 500), { dx: 1.5, dy: -3 })
  assert.deepEqual(wheelPx({ deltaMode: 1, deltaX: 0, deltaY: 3 }, 500), { dx: 0, dy: 48 })
  assert.deepEqual(wheelPx({ deltaMode: 2, deltaX: 0, deltaY: 1 }, 500), { dx: 0, dy: 500 })
})

test('a wheel zoom: up zooms in, down out, and one mouse notch is capped', () => {
  assert.ok(wheelZoom(-5) < 1 && wheelZoom(5) > 1)
  assert.equal(wheelZoom(100), wheelZoom(60))
  assert.equal(wheelZoom(0), 1)
})

test('a turning wheel: sideways turns, up and down tilts', () => {
  const [yaw, pitch] = wheelTurn(100, 0)
  assert.ok(yaw < 0); near(pitch, 0)
  assert.ok(wheelTurn(0, 100)[1] > 0)
})

// ---- the drag ----

test('flat and iso: a background drag moves, Shift + drag or a right-drag turns', () => {
  for (const mode of ['flat', 'iso'] as const) {
    assert.equal(dragAction(ALL_ON, mode, 0, false), 'pan')
    assert.equal(dragAction(ALL_ON, mode, 0, true), 'turn')
    assert.equal(dragAction(ALL_ON, mode, 2, false), 'turn')
  }
})

test('3d: a background drag turns, Shift + drag or a right-drag moves', () => {
  assert.equal(dragAction(ALL_ON, '3d', 0, false), 'turn')
  assert.equal(dragAction(ALL_ON, '3d', 0, true), 'pan')
  assert.equal(dragAction(ALL_ON, '3d', 2, false), 'pan')
})

test('one finger on a touch screen moves in every view', () => {
  for (const mode of MODES) assert.equal(dragAction(ALL_ON, mode, 0, false, 'touch'), 'pan')
})

test('a background drag does nothing when pan is off', () => {
  for (const mode of MODES) for (const pt of ['mouse', 'touch']) assert.equal(dragAction({ ...ALL_ON, pan: false }, mode, 0, false, pt), 'none')
})

test('a click takes hold only when holding gives the diagram something: moving the view or a node', () => {
  assert.equal(holdable(ALL_ON), true)
  assert.equal(holdable({ ...ALL_ON, pan: false }), true) // one finger still drags a node
  assert.equal(holdable({ ...ALL_ON, move: false }), true)
  assert.equal(holdable({ ...ALL_ON, pan: false, move: false }), false) // zoom and drill-in work without holding
  assert.equal(holdable(off), false)
})

test('flat and iso settle on the nearest quarter turn from their own heading; 3d stays put', () => {
  const q = Math.PI / 2, iso = Math.PI / 4
  assert.equal(settleYaw('iso', iso + 0.3 * q, iso), iso)
  near(settleYaw('iso', iso + 0.7 * q, iso), iso + q)
  near(settleYaw('iso', iso - 2.6 * q, iso), iso - 3 * q)
  near(settleYaw('flat', -0.6 * q, 0), -q)
  assert.equal(settleYaw('3d', 1.234, 0.4), 1.234)
})

// ---- two fingers ----

test('two fingers: spreading zooms in, a twist turns, the middle moves; in 3d up and down tilts instead of moving', () => {
  const a = pairOf({ x: 100, y: 100 }, { x: 200, y: 100 })
  const spread = twoFingers(a, pairOf({ x: 50, y: 100 }, { x: 250, y: 100 }), 'iso')
  near(spread.zoom, 0.5); near(spread.yaw, 0); assert.deepEqual(spread.pan, [0, 0])
  const twist = twoFingers(a, pairOf({ x: 150, y: 50 }, { x: 150, y: 150 }), 'flat')
  near(twist.yaw, -Math.PI / 2); near(twist.zoom, 1)
  const down = pairOf({ x: 110, y: 140 }, { x: 210, y: 140 })
  assert.deepEqual(twoFingers(a, down, 'iso').pan, [10, 40]); assert.equal(twoFingers(a, down, 'iso').pitch, 0)
  const tilt = twoFingers(a, down, '3d')
  assert.deepEqual(tilt.pan, [10, 0]); assert.ok(tilt.pitch > 0)
})

test('a twist across the ±180° seam turns the short way', () => {
  const last = { x: 0, y: 0, d: 10, a: Math.PI - 0.01 }, now = { x: 0, y: 0, d: 10, a: -Math.PI + 0.01 }
  near(twoFingers(last, now, 'iso').yaw, -0.02)
})

// ---- which input, and the card ----

test('a wheel event tells a mouse from a trackpad', () => {
  assert.equal(wheelInput({ deltaMode: 1, deltaX: 0, deltaY: 3, ctrlKey: false }), 'mouse')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 0, deltaY: 100, ctrlKey: false }), 'mouse')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 0, deltaY: 4.5, ctrlKey: false }), 'trackpad')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 2, deltaY: 100, ctrlKey: false }), 'trackpad')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 0, deltaY: 100, ctrlKey: true }), 'trackpad')
})

test('a pinch is a ctrl wheel in small steps; ctrl + a mouse wheel and cmd + wheel are not', () => {
  assert.equal(isPinch({ ctrlKey: true, metaKey: false, deltaMode: 0, deltaY: -2.5 }), true)
  assert.equal(isPinch({ ctrlKey: true, metaKey: false, deltaMode: 0, deltaY: 100 }), false)
  assert.equal(isPinch({ ctrlKey: false, metaKey: true, deltaMode: 0, deltaY: -2.5 }), false)
})

test('before any input: touch on a coarse pointer, a trackpad on a Mac, else a mouse; the zoom key follows the platform', () => {
  assert.equal(guessInput(true, 'MacIntel'), 'touch')
  assert.equal(guessInput(false, 'MacIntel'), 'trackpad')
  assert.equal(guessInput(false, 'Win32'), 'mouse')
  assert.equal(modKey('MacIntel'), '⌘'); assert.equal(modKey('Linux x86_64'), 'Ctrl')
})

test('the card has a turn row for every input and view, a tilt row only for touch in 3d, and 3d rows differ', () => {
  for (const input of ['trackpad', 'mouse', 'touch'] as const) for (const mode of MODES) assert.ok(gestureRows(input, mode, '⌘').some(([, a]) => a.startsWith('Turn')), `${input} ${mode}`)
  assert.ok(gestureRows('touch', '3d', '⌘').some(([, a]) => a === 'Tilt'))
  assert.ok(!gestureRows('touch', 'iso', '⌘').some(([, a]) => a === 'Tilt'))
  assert.ok(gestureRows('mouse', 'flat', 'Ctrl').some(([g, a]) => g === 'Ctrl + scroll' && a === 'Zoom'))
  assert.deepEqual(gestureRows('trackpad', '3d', '⌘')[0], ['Drag', 'Turn and tilt'])
  assert.deepEqual(gestureRows('trackpad', 'iso', '⌘')[0], ['Two-finger drag', 'Move'])
  assert.notDeepEqual(gestureRows('mouse', '3d', '⌘'), gestureRows('mouse', 'iso', '⌘'))
})

test('the hint says how to take hold, and mentions zoom only when it is on', () => {
  assert.equal(hintText('mouse', true, 'Ctrl'), 'Click to move the diagram · Ctrl + scroll to zoom')
  assert.equal(hintText('trackpad', false, '⌘'), 'Click to move the diagram')
  assert.match(hintText('touch', true, '⌘'), /Tap/)
})

// ---- the held ring ----

test('the ring takes the clipping box\'s corners, less how far inside it the diagram sits', () => {
  const box = { left: 0, top: 0, right: 400, bottom: 300 }
  assert.deepEqual(insetRadii([12, 12, 12, 12], box, box), [12, 12, 12, 12])
  assert.deepEqual(insetRadii([0, 0, 0, 0], box, box), [0, 0, 0, 0])
  // a 1px border: the diagram sits 1px inside the box
  assert.deepEqual(insetRadii([8, 8, 8, 8], { left: 1, top: 1, right: 399, bottom: 299 }, box), [7, 7, 7, 7])
  // set 20px down inside a card with 12px corners: the top corners are square
  assert.deepEqual(insetRadii([12, 12, 12, 12], { left: 0, top: 20, right: 400, bottom: 300 }, box), [0, 0, 12, 12])
})

test('the "Esc to let go" chip moves in on a big corner, and sits 10px in otherwise', () => {
  assert.deepEqual(chipAt([0, 0, 0, 0]), [10, 10])
  assert.deepEqual(chipAt([8, 8, 8, 8]), [10, 10])
  const [l, t] = chipAt([40, 40, 40, 40])
  assert.ok(l > 10 && t > 10)
  // the chip's corner is inside the curve: (40 - l)² + (40 - t)² ≤ 40²
  assert.ok((40 - l) ** 2 + (40 - t) ** 2 <= 40 ** 2)
})

// ---- cursors ----

test('grab only when move is on, zoom-in only when drillIn is on', () => {
  assert.equal(cursorFor('node', ALL_ON, false), 'grab')
  assert.equal(cursorFor('node', { ...ALL_ON, move: false }, false), '')
  assert.equal(cursorFor('group', ALL_ON, false), 'zoom-in')
  assert.equal(cursorFor('group', { ...ALL_ON, drillIn: false }, false), '')
})

test('pointer when a click handler is given and no control claims the cursor', () => {
  assert.equal(cursorFor('node', off, true), 'pointer')
  assert.equal(cursorFor('group', off, true), 'pointer')
  assert.equal(cursorFor('participant', ALL_ON, true), 'pointer')
  assert.equal(cursorFor('participant', ALL_ON, false), '')
  assert.equal(cursorFor('node', ALL_ON, true), 'grab')
})

// ---- telemetry ----

test('a drag gesture is one span, however many moves', () => {
  const g = gesture('pan', { via: 'drag' })
  for (let i = 0; i < 20; i++) g.touch()
  assert.equal(controlSpans().length, 0)
  g.end()
  const spans = controlSpans()
  assert.equal(spans.length, 1)
  assert.equal(spans[0].attributes['bonkei.control'], 'pan')
})

test('a press with no move records nothing', () => {
  const g = gesture('move', { via: 'drag' })
  g.end()
  assert.equal(controlSpans().length, 0)
})

test('wheel events debounce into one span per gesture, ended after 300 ms idle', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    assert.equal(WHEEL_IDLE_MS, 300)
    const g = gesture('zoom', { idleMs: WHEEL_IDLE_MS })
    g.touch(); mock.timers.tick(100); g.touch(); mock.timers.tick(250); g.touch()
    assert.equal(controlSpans().length, 0)
    mock.timers.tick(299)
    assert.equal(controlSpans().length, 0)
    mock.timers.tick(1)
    assert.equal(controlSpans().length, 1)
    g.touch(); mock.timers.tick(300)
    const spans = controlSpans()
    assert.equal(spans.length, 2)
    assert.equal(spans[1].attributes['bonkei.control'], 'zoom')
  } finally {
    mock.timers.reset()
  }
})

test('a gesture span says how it arrived, in which view, and whether Shift or the right button swapped it', () => {
  let mode: '3d' | 'flat' = '3d'
  const s = gesture('turn', { via: 'drag', mode: () => mode, swapped: isSwapped(2, false) })
  s.touch(); mode = 'flat'; s.touch(); s.end()
  const a = controlSpans().at(-1)!.attributes
  assert.equal(a['bonkei.control'], 'turn')
  assert.equal(a['bonkei.control.via'], 'drag')
  assert.equal(a['bonkei.control.swapped'], true)
  assert.equal(a['bonkei.mode'], '3d') // read when the span opens
  const p = gesture('zoom', { via: 'pinch' }); p.touch(); p.end()
  assert.equal(controlSpans().at(-1)!.attributes['bonkei.control.via'], 'pinch')
  assert.equal(controlSpans().at(-1)!.attributes['bonkei.control.swapped'], false)
})

test('the hint, taking hold, the card and Fit each leave one span with what the reader did', () => {
  hintShown('mouse', 'iso')
  holdChanged(true, 'click', 'flat'); holdChanged(false, 'esc', 'flat')
  helpToggled(true, 'button', 'trackpad', '3d'); helpToggled(false, 'close', 'trackpad', '3d')
  fitUsed('iso')
  const by = (n: string) => exporter.getFinishedSpans().filter(s => s.name === n).map(s => s.attributes)
  assert.deepEqual(by('bonkei.control.hint'), [{ 'bonkei.input': 'mouse', 'bonkei.mode': 'iso' }])
  assert.deepEqual(by('bonkei.control.hold'), [
    { 'bonkei.hold': 'taken', 'bonkei.hold.how': 'click', 'bonkei.mode': 'flat' },
    { 'bonkei.hold': 'let_go', 'bonkei.hold.how': 'esc', 'bonkei.mode': 'flat' },
  ])
  assert.deepEqual(by('bonkei.help'), [
    { 'bonkei.help': 'open', 'bonkei.help.how': 'button', 'bonkei.input': 'trackpad', 'bonkei.mode': '3d' },
    { 'bonkei.help': 'close', 'bonkei.help.how': 'close', 'bonkei.input': 'trackpad', 'bonkei.mode': '3d' },
  ])
  assert.deepEqual(by('bonkei.fit'), [{ 'bonkei.mode': 'iso' }])
})

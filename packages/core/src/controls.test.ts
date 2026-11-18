import { test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ALL_ON, cursorFor, dragAction, gesture, gestureRows, settleYaw, wheelAction, wheelInput, WHEEL_IDLE_MS } from './controls.ts'
import { resolveControls } from './options.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())
const controlSpans = () => exporter.getFinishedSpans().filter(s => s.name === 'bonkei.control')

const off = resolveControls(false)

test('pinch and cmd/ctrl + wheel zoom when zoom is on', () => {
  for (const k of [{ ctrlKey: true, metaKey: false }, { ctrlKey: false, metaKey: true }]) {
    assert.equal(wheelAction(ALL_ON, k, false), 'zoom')
    assert.equal(wheelAction({ ...ALL_ON, zoom: false }, k, true), 'pass')
  }
})

test('a plain wheel moves an engaged diagram, and asks for a hint otherwise', () => {
  const plain = { ctrlKey: false, metaKey: false }
  assert.equal(wheelAction(ALL_ON, plain, true), 'pan')
  assert.equal(wheelAction(ALL_ON, plain, false), 'hint')
  assert.equal(wheelAction({ ...ALL_ON, pan: false }, plain, true), 'pass')
})

test('flat and iso: a ground drag pans, and turns with Shift or the secondary button', () => {
  for (const mode of ['flat', 'iso'] as const) {
    assert.equal(dragAction(ALL_ON, mode, 0, false), 'pan')
    assert.equal(dragAction(ALL_ON, mode, 0, true), 'turn')
    assert.equal(dragAction(ALL_ON, mode, 2, false), 'turn')
  }
})

test('3d: a ground drag turns, and pans with Shift or the secondary button', () => {
  assert.equal(dragAction(ALL_ON, '3d', 0, false), 'turn')
  assert.equal(dragAction(ALL_ON, '3d', 0, true), 'pan')
  assert.equal(dragAction(ALL_ON, '3d', 2, false), 'pan')
})

test('3d: Shift turns the wheel into turning; flat and iso keep panning', () => {
  const shift = { ctrlKey: false, metaKey: false, shiftKey: true }
  assert.equal(wheelAction(ALL_ON, shift, true, '3d'), 'turn')
  assert.equal(wheelAction(ALL_ON, shift, true, 'iso'), 'pan')
  assert.equal(wheelAction(ALL_ON, { ...shift, shiftKey: false }, true, '3d'), 'pan')
})

test('a ground drag does nothing when pan is off', () => {
  for (const mode of ['flat', 'iso', '3d'] as const) assert.equal(dragAction({ ...ALL_ON, pan: false }, mode, 0, false), 'none')
})

test('flat and iso settle on a quarter turn; 3d stays put', () => {
  const q = Math.PI / 2, iso = Math.PI / 4
  assert.equal(settleYaw('iso', iso + 0.3 * q, iso), iso)
  assert.ok(Math.abs(settleYaw('iso', iso + 0.7 * q, iso) - (iso + q)) < 1e-9)
  assert.ok(Math.abs(settleYaw('flat', -0.6 * q, 0) + q) < 1e-9)
  assert.equal(settleYaw('3d', 1.234, 0.4), 1.234)
})

test('a wheel event tells a mouse from a trackpad', () => {
  assert.equal(wheelInput({ deltaMode: 1, deltaX: 0, deltaY: 3, ctrlKey: false }), 'mouse')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 0, deltaY: 100, ctrlKey: false }), 'mouse')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 0, deltaY: 4.5, ctrlKey: false }), 'trackpad')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 2, deltaY: 100, ctrlKey: false }), 'trackpad')
  assert.equal(wheelInput({ deltaMode: 0, deltaX: 0, deltaY: 100, ctrlKey: true }), 'trackpad')
})

test('the card has a turn row for every input, and tilt only for touch in 3d', () => {
  for (const input of ['trackpad', 'mouse', 'touch'] as const) assert.ok(gestureRows(input, 'iso', '⌘').some(([, a]) => a.startsWith('Turn')))
  assert.ok(gestureRows('touch', '3d', '⌘').some(([, a]) => a === 'Tilt'))
  assert.ok(!gestureRows('touch', 'iso', '⌘').some(([, a]) => a === 'Tilt'))
  assert.ok(gestureRows('mouse', 'flat', 'Ctrl').some(([g]) => g === 'Ctrl + scroll'))
  assert.deepEqual(gestureRows('trackpad', '3d', '⌘')[0], ['Drag', 'Turn and tilt'])
})

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

test('a drag gesture is one span, however many moves', () => {
  const g = gesture('pan')
  for (let i = 0; i < 20; i++) g.touch()
  assert.equal(controlSpans().length, 0)
  g.end()
  const spans = controlSpans()
  assert.equal(spans.length, 1)
  assert.equal(spans[0].attributes['bonkei.control'], 'pan')
})

test('a press with no move records nothing', () => {
  const g = gesture('move')
  g.end()
  assert.equal(controlSpans().length, 0)
})

test('wheel events debounce into one span per gesture, ended after 300 ms idle', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    assert.equal(WHEEL_IDLE_MS, 300)
    const g = gesture('zoom', WHEEL_IDLE_MS)
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

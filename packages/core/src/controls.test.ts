import { test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ALL_ON, cursorFor, dragAction, gesture, wheelAction, WHEEL_IDLE_MS } from './controls.ts'
import { resolveControls } from './options.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())
const controlSpans = () => exporter.getFinishedSpans().filter(s => s.name === 'bonkei.control')

const off = resolveControls(false)

test('the wheel zooms only when zoom is on', () => {
  assert.equal(wheelAction(ALL_ON), 'zoom')
  assert.equal(wheelAction({ ...ALL_ON, zoom: false }), 'pass')
})

test('a ground drag orbits in 3d with the primary button and pans otherwise', () => {
  assert.equal(dragAction(ALL_ON, '3d', 0), 'orbit')
  assert.equal(dragAction(ALL_ON, '3d', 2), 'pan')
  assert.equal(dragAction(ALL_ON, 'iso', 0), 'pan')
  assert.equal(dragAction(ALL_ON, 'flat', 0), 'pan')
})

test('a ground drag does nothing when pan is off', () => {
  for (const mode of ['flat', 'iso', '3d'] as const) assert.equal(dragAction({ ...ALL_ON, pan: false }, mode, 0), 'none')
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

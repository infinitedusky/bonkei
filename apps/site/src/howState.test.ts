import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import type { BonkeiError, BonkeiWarning } from 'bonkei'
import { gateOf, startOf, stillNote } from './howGate.ts'
import { INITIAL, LOST, MAX, fallsBack, howReducer, isOver, noteOf, outcomeOf, sizeOf, type HowEvent, type HowStatus } from './howState.ts'
import { TRACER, track } from './track.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())

const from = (s: HowStatus, ...events: HowEvent[]) => events.reduce(howReducer, s)
const run = (...events: HowEvent[]) => from(INITIAL, ...events)
const dropped = (line: number, message = 'not a node or edge'): BonkeiWarning => ({ kind: 'dropped', message, line, text: '!!!' })
const noNodes: BonkeiError = { kind: 'parse', message: 'no nodes found' }

test('the section starts from the sample without a leading %% line', () => {
  assert.equal(startOf('%% a comment\nflowchart TD\n  A --> B\n'), 'flowchart TD\n  A --> B\n')
  assert.equal(startOf('flowchart TD\n  A --> B\n'), 'flowchart TD\n  A --> B\n')
})

test('the gate: live only on a wide, fine-pointer screen with WebGL 2', () => {
  assert.equal(gateOf({ narrow: false, coarse: false, webgl2: true }), 'live')
  assert.equal(gateOf({ narrow: true, coarse: false, webgl2: true }), 'phone')
  assert.equal(gateOf({ narrow: false, coarse: true, webgl2: true }), 'phone')
  assert.equal(gateOf({ narrow: false, coarse: false, webgl2: false }), 'no-webgl2')
})

test('a clean source: the note says the scene follows', () => {
  const s = run({ type: 'sent' }, { type: 'ready' })
  assert.deepEqual(noteOf(s), { tone: 'ok', text: 'Live: edit the text, the scene follows' })
  assert.equal(outcomeOf(s), 'drawn')
})

test('a line the scene cannot read is named once it draws, with a count of the others', () => {
  const s = run({ type: 'sent' }, { type: 'warning', warning: dropped(33) }, { type: 'ready' })
  assert.deepEqual(noteOf(s), { tone: 'warn', text: 'Skipped line 33: not a node or edge' })
  assert.equal(outcomeOf(s), 'skipped')
  const two = run({ type: 'sent' }, { type: 'warning', warning: dropped(33) }, { type: 'warning', warning: dropped(34) }, { type: 'ready' })
  assert.equal(noteOf(two).text, 'Skipped line 33: not a node or edge (+1 more)')
})

test('warnings of a source still being laid out do not replace the note of the one on screen', () => {
  const shown = run({ type: 'sent' }, { type: 'ready' })
  const s = run({ type: 'sent' }, { type: 'ready' }, { type: 'sent' }, { type: 'warning', warning: dropped(5) })
  assert.deepEqual(noteOf(s), noteOf(shown))
})

test('nothing readable keeps the last diagram with a note; a fixed text brings the updates back', () => {
  const bad = run({ type: 'sent' }, { type: 'ready' }, { type: 'sent' }, { type: 'error', error: noNodes })
  assert.deepEqual(noteOf(bad), { tone: 'warn', text: 'Not updated: no nodes found. Showing the last diagram that worked.' })
  assert.equal(outcomeOf(bad), 'not-updated')
  assert.equal(fallsBack(bad, noNodes), false, 'the last diagram stays')
  const fixed = from(bad, { type: 'sent' }, { type: 'ready' })
  assert.deepEqual(noteOf(fixed), { tone: 'ok', text: 'Live: edit the text, the scene follows' })
})

test('an error with a line names it, and a trailing full stop is not doubled', () => {
  const s = run({ type: 'sent' }, { type: 'ready' }, { type: 'error', error: { kind: 'parse', message: 'unclosed subgraph.', line: 4 } })
  assert.equal(noteOf(s).text, 'Not updated: line 4: unclosed subgraph. Showing the last diagram that worked.')
})

test('the still comes back when the sample never drew or drawing broke, not for a text that cannot be read', () => {
  assert.equal(fallsBack(INITIAL, noNodes), true)
  const drawn = run({ type: 'sent' }, { type: 'ready' })
  assert.equal(fallsBack(drawn, { kind: 'render', message: 'WebGL is unavailable' }), true)
  assert.equal(fallsBack(drawn, { kind: 'layout', message: 'x' }), false)
})

test('a lost WebGL context after the first draw brings the still back', () => {
  const drawn = run({ type: 'sent' }, { type: 'ready' })
  assert.equal(fallsBack(drawn, LOST), true)
})

test('a pasted wall of edges is over the size the scene is given; the sample is not', () => {
  const edges = (n: number) => 'flowchart TD\n' + Array.from({ length: n }, (_, i) => `  M${i % 40} --> M${(i * 7) % 40}`).join('\n')
  assert.equal(isOver(sizeOf(edges(1000))), true)
  assert.equal(isOver(sizeOf(edges(MAX.links))), false)
  assert.equal(isOver(sizeOf(edges(MAX.links + 1))), true)
  assert.equal(isOver(sizeOf('flowchart TD\n  A --> B -.-> C ==> D --- E\n')), false)
  assert.equal(sizeOf('flowchart TD\n  A --> B -.-> C ==> D --- E\n').links, 4)
  assert.equal(isOver(sizeOf('flowchart TD\n' + 'A-->'.repeat(MAX.links + 1) + 'Z')), true, 'one long line of links')
  assert.equal(isOver(sizeOf('flowchart TD\n' + '  A[x]\n'.repeat(MAX.lines))), true, 'lines alone')
})

test('a text over the size is not sent: the last diagram stays with a note, a smaller text brings updates back', () => {
  const over = from(run({ type: 'sent' }, { type: 'ready' }), { type: 'over', size: { lines: 1001, links: 1000 } })
  assert.deepEqual(noteOf(over), { tone: 'warn', text: 'Not updated: too big for the live scene, 1000 links (up to 150). Showing the last diagram that worked.' })
  assert.equal(outcomeOf(over), 'not-updated')
  assert.equal(noteOf(from(INITIAL, { type: 'over', size: { lines: 400, links: 3 } })).text, 'Not updated: too big for the live scene, 400 lines (up to 200). Showing the last diagram that worked.')
  assert.deepEqual(noteOf(from(over, { type: 'sent' }, { type: 'ready' })), { tone: 'ok', text: 'Live: edit the text, the scene follows' })
  assert.deepEqual(noteOf(from(over, { type: 'over', size: null })), { tone: 'ok', text: 'Live: edit the text, the scene follows' }, 'back to the text on screen')
})

test('the line under the still sends only a phone to a desktop', () => {
  assert.match(stillNote('phone', false), /Try it live on a desktop\.$/)
  assert.doesNotMatch(stillNote('no-webgl2', false), /desktop/)
  assert.match(stillNote('no-webgl2', false), /WebGL 2/)
  assert.doesNotMatch(stillNote('live', true), /desktop/)
  assert.match(stillNote('live', true), /stopped/)
  assert.doesNotMatch(stillNote(null, false), /desktop/)
})

test('track() ends one span on the site tracer with its attributes, ERROR when given a message', async () => {
  await track('site.how.update', { 'site.how.outcome': 'skipped', 'site.how.skipped': 1 })
  await track('site.how.fallback', { 'site.how.reason': 'scene-error' }, 'WebGL is unavailable')
  const [a, b] = exporter.getFinishedSpans()
  assert.equal(a.name, 'site.how.update')
  assert.equal(a.instrumentationScope.name, TRACER)
  assert.deepEqual(a.attributes, { 'site.how.outcome': 'skipped', 'site.how.skipped': 1 })
  assert.equal(a.status.code, SpanStatusCode.UNSET)
  assert.equal(b.status.code, SpanStatusCode.ERROR)
  assert.equal(b.status.message, 'WebGL is unavailable')
})

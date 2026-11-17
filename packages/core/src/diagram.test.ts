import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { prepare, isBonkeiError, type PrepareError } from './diagram.ts'
import type { GraphInput } from './model.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())

// prepare must resolve or reject, never throw synchronously
const rejection = async (p: () => Promise<unknown>): Promise<PrepareError> => {
  let call: Promise<unknown>
  assert.doesNotThrow(() => { call = p() })
  try { await call!; } catch (e) { return e as PrepareError }
  assert.fail('expected a rejection')
}

const FM = '---\nconfig:\n  bonkei:\n    mode: flat\n    nope: 1\n---\n'
const spans = (name: string) => exporter.getFinishedSpans().filter(s => s.name === name)

test('a source with no readable line rejects with kind parse at line 1', async () => {
  const e = await rejection(() => prepare('???\n!!!'))
  assert.equal(isBonkeiError(e), true)
  assert.equal(e.kind, 'parse')
  assert.equal(e.line, 1)
  assert.equal(e.text, '???')
  assert.equal(e.message, 'no nodes found; first unreadable line: 1: ???')
})

test('after frontmatter, line 1 of the diagram counts in the source as given', async () => {
  const e = await rejection(() => prepare(FM + '???\n!!!'))
  assert.equal(e.kind, 'parse')
  assert.equal(e.line, 7)
})

test('an empty source rejects with kind parse', async () => {
  assert.equal((await rejection(() => prepare(''))).kind, 'parse')
  assert.equal((await rejection(() => prepare('  \n\t'))).kind, 'parse')
})

test('a partly readable source resolves, with dropped warnings', async () => {
  const r = await prepare('flowchart TD\nA --> B\n???\nB --> C')
  assert.equal(r.ready.nodes, 3)
  assert.equal(r.ready.edges, 2)
  assert.equal(r.ready.dropped, 1)
  assert.equal(typeof r.ready.layoutMs, 'number')
  assert.deepEqual(r.warnings, [{ kind: 'dropped', message: 'not a node or edge', line: 3, text: '???' }])
  assert.ok('boxes' in r.data && r.data.boxes.length === 3)
})

test('a sequence diagram resolves, with its options from frontmatter', async () => {
  const r = await prepare(FM + 'sequenceDiagram\nA->>B: hi\nhuh')
  assert.deepEqual(r.options, { mode: 'flat' })
  assert.equal(r.ready.nodes, 2)
  assert.deepEqual(r.warnings.map(w => [w.kind, w.line]), [['frontmatter', 5], ['dropped', 9]])
})

test('a hand-built graph without direction or groups resolves', async () => {
  const g: GraphInput = {
    nodes: [{ id: 'a', label: 'A', shape: 'rect' }, { id: 'b', label: 'B', shape: 'round' }],
    edges: [{ id: 'e0', from: 'a', to: 'b' }],
  }
  const r = await prepare(g)
  assert.equal(r.ready.nodes, 2)
  assert.equal(r.ready.edges, 1)
  assert.deepEqual(r.warnings, [])
  assert.deepEqual(r.options, {})
  assert.equal('direction' in g, false) // the input is not mutated
})

test('a hand-built graph with a dangling edge rejects with kind graph', async () => {
  const e = await rejection(() => prepare({ nodes: [{ id: 'a', label: 'A', shape: 'rect' }], edges: [{ id: 'e0', from: 'a', to: 'ghost' }] }))
  assert.equal(e.kind, 'graph')
  assert.match(e.message, /ghost/)
})

test('a hand-built graph with no nodes rejects with kind graph', async () => {
  const e = await rejection(() => prepare({ nodes: [], edges: [] }))
  assert.equal(e.kind, 'graph')
})

test('frontmatter warnings survive a failure', async () => {
  const e = await rejection(() => prepare(FM + '???'))
  assert.equal(e.kind, 'parse')
  assert.deepEqual(e.warnings.map(w => [w.kind, w.line, w.text]), [['frontmatter', 5, 'nope: 1']])
})

test('isBonkeiError tells errors from other values', () => {
  assert.equal(isBonkeiError({ kind: 'layout', message: 'x' }), true)
  assert.equal(isBonkeiError({ kind: 'oops', message: 'x' }), false)
  assert.equal(isBonkeiError(new Error('x')), false)
  assert.equal(isBonkeiError(null), false)
})

test('prepare emits a bonkei.prepare span with a bonkei.layout child', async () => {
  await prepare(FM + 'flowchart TD\nA --> B\n???\nclassDef x fill:#f00\n!!!')
  const [p] = spans('bonkei.prepare'), [l] = spans('bonkei.layout')
  assert.ok(p && l)
  assert.equal(l.parentSpanContext?.spanId, p.spanContext().spanId)
  assert.equal(p.attributes['bonkei.input'], 'mermaid')
  assert.equal(p.attributes['bonkei.diagram'], 'flowchart')
  assert.equal(p.attributes['bonkei.nodes'], 2)
  assert.equal(p.attributes['bonkei.edges'], 1)
  assert.equal(p.attributes['bonkei.dropped'], 3)
  assert.equal(typeof p.attributes['bonkei.layout_ms'], 'number')
  assert.notEqual(p.status.code, SpanStatusCode.ERROR)
  const dropped = p.events.find(e => e.name === 'bonkei.dropped_lines')
  assert.deepEqual(dropped?.attributes, { 'bonkei.dropped.not_a_node_or_edge': 2, 'bonkei.dropped.not_supported_yet': 1 })
  const fm = p.events.filter(e => e.name === 'bonkei.frontmatter_warning')
  assert.equal(fm.length, 1)
  assert.equal(fm[0].attributes?.['bonkei.line'], 5)
})

test('the lines are routed under a bonkei.route span with the crossing level and how the routing went (BON-100)', async () => {
  await prepare('flowchart TD\nA --> B\nA --> C\nB --> C', { avoidCrossings: 'strong' })
  const [p] = spans('bonkei.prepare'), [r] = spans('bonkei.route')
  assert.ok(p && r)
  assert.equal(r.parentSpanContext?.spanId, p.spanContext().spanId)
  assert.equal(r.attributes['bonkei.avoid_crossings'], 'strong')
  assert.equal(r.attributes['bonkei.edges'], 3)
  assert.equal(r.attributes['bonkei.unroutable'], 0)
  assert.equal(typeof r.attributes['bonkei.route_ms'], 'number')
  assert.equal(typeof r.attributes['bonkei.straightened'], 'number')
  assert.equal(r.events.length, 0, 'no fallback to ELK routes')
})

test('a hand-built graph is traced as input graph', async () => {
  await prepare({ nodes: [{ id: 'a', label: 'A', shape: 'rect' }], edges: [] })
  const [p] = spans('bonkei.prepare')
  assert.equal(p.attributes['bonkei.input'], 'graph')
  assert.equal(p.attributes['bonkei.diagram'], 'flowchart')
})

test('a failure sets status ERROR with the error kind and line', async () => {
  await rejection(() => prepare('???\n!!!'))
  const [p] = spans('bonkei.prepare')
  assert.equal(p.status.code, SpanStatusCode.ERROR)
  assert.equal(p.attributes['bonkei.error.kind'], 'parse')
  assert.equal(p.attributes['bonkei.error.line'], 1)
  assert.equal(spans('bonkei.layout').length, 0)
})

test('the theme a diagram names is handed on with the layout, and its frontmatter warnings are traced with their kind', async () => {
  const p = await prepare('---\nconfig:\n  theme: nope\n  themeVariables:\n    edge.flat: true\n---\nflowchart TD\nA --> B')
  assert.deepEqual(p.theme, { name: 'nope', variables: { 'edge.flat': true } })
  assert.deepEqual(p.warnings.map(w => [w.kind, w.line]), [['theme', 3]])
  const [span] = spans('bonkei.prepare')
  assert.equal(span.attributes['bonkei.theme.requested'], 'nope')
  assert.equal(span.attributes['bonkei.theme.variables'], 1)
  assert.deepEqual(span.events.map(e => [e.name, e.attributes?.['bonkei.warning.kind']]), [['bonkei.frontmatter_warning', 'theme']])
})

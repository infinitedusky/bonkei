import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFrontmatter, mergeOptions, resolveControls } from './options.ts'
import { parse } from './parser.ts'
import { prepare } from './diagram.ts'
import { createCamera } from './camera.ts'

const fm = (body: string) => `---\nconfig:\n  bonkei:\n${body}\n---\nflowchart TD\n  A --> B\n`

test('frontmatter: real YAML, stripped, line offset kept', () => {
  const r = readFrontmatter(fm('    mode: flat\n    labels: billboard\n    toolbar: false\n    controls:\n      zoom: false'))
  assert.deepEqual(r.options, { mode: 'flat', labels: 'billboard', toolbar: false, controls: { zoom: false } })
  assert.ok(r.body.startsWith('flowchart TD'))
  assert.equal(r.lineOffset, 9)
  assert.deepEqual(r.warnings, [])
})

test('frontmatter: theme keys are left alone, unknown bonkei keys warn', () => {
  const r = readFrontmatter('---\nconfig:\n  theme: dark\n  themeVariables:\n    primaryColor: "#fff"\n  bonkei:\n    mode: nope\n    wat: 1\n---\nflowchart TD\nA-->B')
  assert.deepEqual(r.options, {})
  assert.equal(r.warnings.length, 2)
})

test('frontmatter: broken YAML warns instead of throwing', () => {
  const r = readFrontmatter('---\nconfig: [oops\n---\nflowchart TD\nA-->B')
  assert.equal(r.warnings.length, 1)
  assert.ok(r.body.startsWith('flowchart'))
})

test('props override frontmatter key by key', () => {
  const o = mergeOptions({ mode: 'flat', labels: 'billboard' }, { mode: '3d', labels: undefined })
  assert.equal(o.mode, '3d'); assert.equal(o.labels, 'billboard'); assert.equal(o.toolbar, true); assert.equal(o.mode, '3d')
})

test('controls: true, false, object', () => {
  assert.deepEqual(resolveControls(undefined), { zoom: true, pan: true, move: true, drillIn: true })
  assert.deepEqual(resolveControls(false), { zoom: false, pan: false, move: false, drillIn: false })
  assert.deepEqual(resolveControls({ zoom: false }), { zoom: false, pan: true, move: true, drillIn: true })
})

test('parser reports dropped lines with line numbers and keeps its return shape', () => {
  const g = parse('flowchart TD\n  A --> B\n  ???\n  B --> C extra stuff\n  subgraph S\n  X')
  assert.equal(g.nodes.length >= 3, true)
  assert.deepEqual(g.dropped.map(d => d.line), [3, 4, 6])
})

test('prepare: nothing parsed rejects with a line; dropped lines only warn; offset counts frontmatter', async () => {
  await assert.rejects(prepare('flowchart TD\n???'), (e: any) => e.severity === 'error' && e.line === 2)
  const ok = await prepare(fm('    mode: flat') + '  ???\n')
  assert.equal(ok.options.mode, 'flat')
  assert.deepEqual(ok.warnings.map(w => w.line), [8])
})

test('two instances share no state: options, cameras and prepared data are independent', async () => {
  const a = mergeOptions({}, {}), b = mergeOptions({}, {})
  assert.notEqual(a.controls, b.controls)
  const [ca, cb] = [createCamera(), createCamera()]
  ca.setMode('3d'); ca.goal.tx = 99
  assert.equal(cb.mode, 'iso'); assert.equal(cb.goal.tx, 0)
  const [pa, pb] = await Promise.all([prepare('flowchart TD\nA-->B'), prepare('flowchart TD\nA-->B')])
  assert.notEqual(pa.data, pb.data)
})

test('prepare accepts a hand-built graph, and rejects a dangling edge', async () => {
  const g = { direction: 'TD' as const, nodes: [{ id: 'a', label: 'A', shape: 'rect' as const }, { id: 'b', label: 'B', shape: 'round' as const }], groups: [], edges: [{ id: 'e0', from: 'a', to: 'b' }], dropped: [] }
  const p = await prepare(g)
  assert.equal(p.ready.nodes, 2)
  await assert.rejects(prepare({ ...g, edges: [{ id: 'e1', from: 'a', to: 'zzz' }] }), (e: any) => e.severity === 'error')
})

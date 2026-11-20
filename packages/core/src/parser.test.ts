import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from './parser.ts'
import { parseSeq } from './seq.ts'

test('dropped lines carry their reason and 1-based line number', () => {
  const g = parse([
    'flowchart TD',
    '  A --> B',
    '  classDef hot fill:#f00',
    '  class A hot',
    '  style B fill:#0f0',
    '  click A callback',
    '  ??? what',
    '  B --> C',
  ].join('\n'))
  assert.deepEqual(g.nodes.map(n => n.id), ['A', 'B', 'C'])
  assert.deepEqual(g.dropped, [
    { line: 6, text: 'click A callback', reason: 'not supported yet' },
    { line: 7, text: '??? what', reason: 'not a node or edge' },
  ])
})

test('style, classDef, class and ::: give a node its colour; a fill that is not a colour is dropped', () => {
  const g = parse([
    'flowchart LR',
    '  A --> B & C',
    '  C:::cool --> D',
    '  style A fill:#ff3b3b,stroke:#000',
    '  class B,D cool',
    '  classDef cool fill:#2ff0ff,color:#fff',
    '  style D fill:notacolour',
    '  style C stroke:#000',
  ].join('\n'))
  assert.deepEqual(Object.fromEntries(g.nodes.map(n => [n.id, n.color])), { A: '#ff3b3b', B: '#2ff0ff', C: '#2ff0ff', D: '#2ff0ff' })
  assert.deepEqual(g.dropped, [{ line: 7, text: 'style D fill:notacolour', reason: 'not a colour' }])
})

test('the line offset shifts every reported line', () => {
  const g = parse('flowchart TD\nA --> B\n!!!', 4)
  assert.deepEqual(g.dropped, [{ line: 7, text: '!!!', reason: 'not a node or edge' }])
})

test('a trailing ; is stripped', () => {
  const g = parse('flowchart LR;\nA-->B;\nB --> C;;')
  assert.equal(g.direction, 'LR')
  assert.deepEqual(g.edges.map(e => [e.from, e.to]), [['A', 'B'], ['B', 'C']])
  assert.deepEqual(g.dropped, [])
})

test('a stray end is dropped', () => {
  const g = parse('flowchart TD\nsubgraph S\nA\nend\nend\nB')
  assert.deepEqual(g.dropped, [{ line: 5, text: 'end', reason: 'stray end' }])
  assert.equal(g.nodes.find(n => n.id === 'B')!.parent, undefined)
})

test('a subgraph still open at the end is reported at its opening line', () => {
  const g = parse('flowchart TD\nsubgraph Outer\nsubgraph Inner\nA\nend\nB')
  assert.deepEqual(g.groups.map(x => x.id), ['Outer', 'Inner'])
  assert.deepEqual(g.dropped, [{ line: 2, text: 'subgraph Outer', reason: 'unclosed subgraph' }])
})

test('an %%{arch}%% line is now an ordinary comment', () => {
  const g = parse('%%{arch: {view: "iso", nav: "drill"}}%%\nflowchart TD\nA --> B')
  assert.equal('arch' in g, false)
  assert.deepEqual(g.dropped, [])
  assert.equal(g.nodes.length, 2)
})

test('an unreadable first line is dropped at line 1, not taken as a header', () => {
  const g = parse('???\n!!!')
  assert.deepEqual(g.dropped, [
    { line: 1, text: '???', reason: 'not a node or edge' },
    { line: 2, text: '!!!', reason: 'not a node or edge' },
  ])
})

test('ids may contain - but an arrow right after an id is still an arrow', () => {
  const g = parse('my-node-->B\nB-.->C')
  assert.deepEqual(g.edges.map(e => [e.from, e.to]), [['my-node', 'B'], ['B', 'C']])
})

test('a sequence diagram drops a line it cannot read', () => {
  const doc = parseSeq('sequenceDiagram\nA->>B: hi\nthis is not a message\nB-->>A: ok', 2)
  assert.deepEqual(doc.parts.map(p => p.id), ['A', 'B'])
  assert.equal(doc.items.length, 2)
  assert.deepEqual(doc.dropped, [{ line: 5, text: 'this is not a message', reason: 'not a node or edge' }])
})

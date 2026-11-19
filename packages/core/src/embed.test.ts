import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_HEIGHT, cssHeight, dedent, isSupported } from './embed.ts'

// The same cases are in packages/vitepress/src/index.test.js, whose isSupported() is a copy of this one.
const SUPPORTED = [
  'flowchart TD\n A-->B',
  'graph LR\n A-->B',
  'sequenceDiagram\n A->>B: hi',
  '  \n  flowchart TD\n A-->B',
  '%% a comment\nflowchart TD\n A-->B',
  '---\nconfig:\n  bonkei:\n    mode: 3d\n---\nflowchart TD\n A-->B',
  '---\ntitle: Login\n---\n%% note\nsequenceDiagram\n A->>B: hi',
]
const UNSUPPORTED = [
  'pie title Pets\n "Dogs": 386',
  '---\ntitle: x\n---\npie\n "a": 1',
  'classDiagram\n A <|-- B',
  'gantt\n title x',
  'flowchartish\n A-->B',
  '',
]

test('isSupported: flowcharts and sequence diagrams, after frontmatter and comments', () => {
  for (const s of SUPPORTED) assert.equal(isSupported(s), true, JSON.stringify(s))
  for (const s of UNSUPPORTED) assert.equal(isSupported(s), false, JSON.stringify(s))
})

test('dedent: drops the indent the page put round the source', () => {
  assert.equal(dedent('\n    flowchart TD\n      A --> B\n    B --> C\n  '), 'flowchart TD\n  A --> B\nB --> C')
  assert.equal(dedent('\r\n\tsequenceDiagram\r\n\t\tA->>B: hi\r\n'), 'sequenceDiagram\n\tA->>B: hi')
  assert.equal(dedent('flowchart TD\n  A'), 'flowchart TD\n  A')
  assert.equal(dedent('  \n \n'), '')
})

test('cssHeight: a number is px, a CSS length is kept, junk is null', () => {
  assert.equal(cssHeight('600'), '600px')
  assert.equal(cssHeight(' 12.5 '), '12.5px')
  assert.equal(cssHeight('50vh'), '50vh')
  assert.equal(cssHeight('tall'), null)
  assert.equal(cssHeight(''), null)
  assert.equal(cssHeight(null), null)
  assert.equal(DEFAULT_HEIGHT, 420)
})

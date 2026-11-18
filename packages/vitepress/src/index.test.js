import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import { createMarkdownRenderer } from 'vitepress'
import { DEFAULT_HEIGHT, bonkeiMarkdown, isSupported, parseInfo } from './index.js'

const render = (src, options) => {
  const md = new MarkdownIt()
  const seen = []
  bonkeiMarkdown(md, { ...options, onFence: e => seen.push(e) })
  return { html: md.render(src), seen }
}
const fence = (body, info = 'mermaid') => '```' + info + '\n' + body + '\n```\n'

// The same cases as packages/core/src/embed.test.ts: this isSupported() is a copy of bonkei's.
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

test('claims a flowchart with the default height, the source percent-encoded', () => {
  const { html, seen } = render(fence('flowchart TD\n A-->B'))
  assert.equal(html, '<BonkeiDiagram source="flowchart%20TD%0A%20A--%3EB%0A" height="420" />\n')
  assert.deepEqual(seen, [{ claimed: true, reason: 'supported', file: undefined }])
  assert.equal(DEFAULT_HEIGHT, 420)
})

test('claims a sequence diagram, and one after frontmatter', () => {
  assert.match(render(fence('sequenceDiagram\n A->>B: hi')).html, /^<BonkeiDiagram /)
  assert.match(render(fence('---\nconfig:\n  bonkei:\n    mode: 3d\n---\nflowchart TD\n A-->B')).html, /^<BonkeiDiagram /)
})

test('height: the site option sets the default, a fence sets its own, a bad one falls back and is reported', () => {
  assert.match(render(fence('graph LR\n A-->B'), { height: 300 }).html, /height="300"/)
  assert.match(render(fence('sequenceDiagram\n A->>B: hi', 'mermaid {height=600}'), { height: 300 }).html, /height="600"/)
  const bad = render(fence('graph LR\n A-->B', 'mermaid {height=tall}'), { height: 300 })
  assert.match(bad.html, /height="300"/)
  assert.match(bad.seen[0].reason, /height "tall" is not a positive number/)
})

test('mode and theme from the site and the fence; an unknown mode is left out', () => {
  assert.match(render(fence('graph LR\n A-->B'), { mode: 'flat', theme: 'bonkei' }).html, /mode="flat" theme="bonkei"/)
  assert.match(render(fence('graph LR\n A-->B', 'mermaid {mode=3d}'), { mode: 'flat' }).html, /mode="3d"/)
  assert.doesNotMatch(render(fence('graph LR\n A-->B', 'mermaid {mode=side}')).html, /mode=/)
})

test('a source with quotes, < and {{ }} survives as one attribute', () => {
  const src = 'flowchart TD\n A["say {{hi}} & <b>"] --> B'
  const html = render(fence(src)).html
  assert.equal(decodeURIComponent(/source="([^"]*)"/.exec(html)[1]), src + '\n')
})

test('other types and other languages go to the previous renderer', () => {
  const md = new MarkdownIt()
  md.renderer.rules.fence = () => '<previous/>'
  const seen = []
  bonkeiMarkdown(md, { onFence: e => seen.push(e) })
  assert.equal(md.render(fence('pie\n "a": 1')), '<previous/>')
  assert.equal(md.render(fence('x', 'js')), '<previous/>')
  assert.deepEqual(seen.map(e => e.reason), ['unsupported diagram type', 'not mermaid'])
})

test('with no previous rule, markdown-it renders the fence as a code block', () => {
  assert.match(render(fence('pie\n "a": 1')).html, /^<pre><code class="language-mermaid">pie/)
})

test('parseInfo', () => {
  assert.deepEqual(parseInfo('mermaid {height=600 mode=3d}'), { height: '600', mode: '3d' })
  assert.deepEqual(parseInfo('mermaid {height="600"}'), { height: '600' })
  assert.deepEqual(parseInfo('mermaid'), {})
  assert.equal(parseInfo('js'), null)
  assert.equal(parseInfo('mermaidish'), null)
})

// VitePress's own renderer: markdown-it-attrs moves {height=600} into token.attrs, and the pie stays VitePress's code block.
test('inside VitePress\'s markdown renderer', async () => {
  const md = await createMarkdownRenderer(process.cwd(), { config: md => bonkeiMarkdown(md, { height: 420 }) }, '/')
  const html = await md.renderAsync?.(fence('flowchart TD\n A-->B', 'mermaid {height=600}') + fence('pie\n "a": 1'))
    ?? md.render(fence('flowchart TD\n A-->B', 'mermaid {height=600}') + fence('pie\n "a": 1'))
  assert.match(html, /<BonkeiDiagram source="flowchart%20TD%0A%20A--%3EB%0A" height="600" \/>/)
  assert.match(html, /<div class="language-mermaid[^"]*"/)
  assert.doesNotMatch(html, /BonkeiDiagram source="pie/)
})

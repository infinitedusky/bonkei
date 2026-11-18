import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import { bonkeiMarkdown, isSupported, parseInfo } from './index.js'

const render = (src, options) => {
  const md = new MarkdownIt()
  const seen = []
  bonkeiMarkdown(md, { ...options, onFence: e => seen.push(e) })
  return { html: md.render(src), seen }
}

test('claims flowcharts and sequence diagrams, with the site height', () => {
  const { html, seen } = render('```mermaid\nflowchart TD\n A-->B\n```\n')
  assert.match(html, /<BonkeiDiagram source="flowchart%20TD%0A%20A--%3EB%0A" height="420" \/>/)
  assert.equal(seen[0].claimed, true)
})
test('fence info sets its own height; site option sets the default', () => {
  assert.match(render('```mermaid {height=600}\nsequenceDiagram\n A->>B: hi\n```\n').html, /height="600"/)
  assert.match(render('```mermaid\ngraph LR\n A-->B\n```\n', { height: 300 }).html, /height="300"/)
})
test('detects the type after frontmatter', () => {
  assert.ok(isSupported('---\nconfig:\n  bonkei:\n    mode: 3d\n---\nflowchart TD\n A-->B'))
  assert.ok(!isSupported('---\ntitle: x\n---\npie\n "a": 1'))
})
test('passes other types and other languages to the previous renderer', () => {
  const md = new MarkdownIt()
  md.renderer.rules.fence = () => '<previous/>'
  bonkeiMarkdown(md)
  assert.equal(md.render('```mermaid\npie\n "a": 1\n```\n'), '<previous/>')
  assert.equal(md.render('```js\nx\n```\n'), '<previous/>')
})
test('parseInfo', () => { assert.deepEqual(parseInfo('mermaid {height=600 mode=3d}'), { height: '600', mode: '3d' }); assert.equal(parseInfo('js'), null) })

test('reads {height=600} from token.attrs, where VitePress (markdown-it-attrs) puts it', async () => {
  const { default: attrs } = await import('markdown-it-attrs').catch(() => ({ default: null }))
  if (!attrs) return
  const md = new MarkdownIt().use(attrs)
  bonkeiMarkdown(md)
  assert.match(md.render('```mermaid {height=600}\nflowchart TD\n A-->B\n```\n'), /height="600"/)
})

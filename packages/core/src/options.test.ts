import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFrontmatter, mergeOptions, resolveControls, DEFAULTS } from './options.ts'

const FM = [
  '---',
  'title: Checkout',
  'config:',
  '  theme: dark',
  '  themeVariables:',
  '    primaryColor: "#ff0000"',
  '  bonkei:',
  '    mode: flat',
  '    labels: top',
  '    toolbar: false',
  '    controls:',
  '      zoom: false',
  '---',
  'flowchart TD',
  'A --> B',
].join('\n')

test('real YAML frontmatter is stripped and the line offset kept', () => {
  const fm = readFrontmatter(FM)
  assert.equal(fm.body, 'flowchart TD\nA --> B')
  assert.equal(fm.lineOffset, 13)
  assert.deepEqual(fm.options, { mode: 'flat', labels: 'top', toolbar: false, controls: { zoom: false } })
  assert.deepEqual(fm.warnings, [])
})

test('a source without frontmatter is returned as is', () => {
  const src = 'flowchart TD\nA --> B'
  assert.deepEqual(readFrontmatter(src), { body: src, lineOffset: 0, options: {}, warnings: [] })
})

test('theme and themeVariables are left untouched', () => {
  const fm = readFrontmatter('---\nconfig:\n  theme: dark\n  themeVariables:\n    primaryColor: red\n---\nA')
  assert.deepEqual(fm.options, {})
  assert.deepEqual(fm.warnings, [])
  assert.equal(fm.body, 'A')
})

test('an unknown key or a bad value gives a frontmatter warning with its line', () => {
  const fm = readFrontmatter('---\nconfig:\n  bonkei:\n    zoomy: true\n    mode: sideways\n---\nA')
  assert.deepEqual(fm.options, {})
  assert.equal(fm.warnings.length, 2)
  assert.deepEqual(fm.warnings.map(w => [w.kind, w.line, w.text]), [
    ['frontmatter', 4, 'zoomy: true'],
    ['frontmatter', 5, 'mode: sideways'],
  ])
  assert.match(fm.warnings[0].message, /unknown option config\.bonkei\.zoomy/)
  assert.match(fm.warnings[1].message, /mode must be one of flat, iso, 3d/)
})

test('invalid YAML gives a warning and the body is still stripped', () => {
  const fm = readFrontmatter('---\nconfig: [\n---\nA')
  assert.equal(fm.body, 'A')
  assert.equal(fm.warnings.length, 1)
  assert.equal(fm.warnings[0].kind, 'frontmatter')
  assert.equal(fm.warnings[0].line, 2)
})

test('props override frontmatter key by key', () => {
  const fm = { mode: 'flat', labels: 'top', toolbar: false, controls: false } as const
  assert.equal(mergeOptions({ mode: '3d' }, fm).mode, '3d')
  assert.equal(mergeOptions({}, fm).mode, 'flat')
  assert.equal(mergeOptions({ labels: 'billboard' }, fm).labels, 'billboard')
  assert.equal(mergeOptions({ toolbar: true }, fm).toolbar, true)
  assert.equal(mergeOptions({ controls: true }, fm).controls, true)
  // a prop for one key leaves the others to the frontmatter
  assert.deepEqual(mergeOptions({ mode: '3d' }, fm), { mode: '3d', labels: 'top', toolbar: false, controls: false, crossings: 'none', avoidCrossings: 'some', routing: 'advanced' })
  // nothing set anywhere: the defaults
  assert.deepEqual(mergeOptions(), { mode: 'iso', labels: 'top', toolbar: true, controls: true, crossings: 'none', avoidCrossings: 'some', routing: 'advanced' })
})

test('a controls object in props replaces the frontmatter one whole', () => {
  const merged = mergeOptions({ controls: { pan: false } }, { controls: { zoom: false, move: false } })
  assert.deepEqual(merged.controls, { pan: false })
  assert.deepEqual(resolveControls(merged.controls), { zoom: true, pan: false, move: true, drillIn: true })
})

test('resolveControls: true, false and an object with a key left out', () => {
  assert.deepEqual(resolveControls(true), { zoom: true, pan: true, move: true, drillIn: true })
  assert.deepEqual(resolveControls(false), { zoom: false, pan: false, move: false, drillIn: false })
  assert.deepEqual(resolveControls({ zoom: false }), { zoom: false, pan: true, move: true, drillIn: true })
})

test('two mergeOptions results share no objects', () => {
  const props = { controls: { zoom: false } }
  const a = mergeOptions(props), b = mergeOptions(props)
  assert.notEqual(a, b)
  assert.notEqual(a.controls, b.controls)
  assert.notEqual(a.controls, props.controls)
  assert.notEqual(mergeOptions(), mergeOptions())
  assert.notEqual(mergeOptions(), DEFAULTS)
})

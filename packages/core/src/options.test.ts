import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFrontmatter, mergeOptions, resolveControls, DEFAULTS } from './options.ts'

const FM = [
  '---',
  'title: Checkout',
  'config:',
  '  theme: bonkei',
  '  themeVariables:',
  '    node.form: landscape',
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
  assert.deepEqual(readFrontmatter(src), { body: src, lineOffset: 0, options: {}, theme: {}, warnings: [] })
})

test('theme and themeVariables are read, and a good one gives no warning', () => {
  const fm = readFrontmatter('---\nconfig:\n  theme: bonkei\n  themeVariables:\n    node.form: landscape\n    tray:\n      outline: "#000000"\n---\nA')
  assert.deepEqual(fm.options, {})
  assert.deepEqual(fm.theme, { name: 'bonkei', variables: { 'node.form': 'landscape', 'tray.outline': '#000000' } })
  assert.deepEqual(fm.warnings, [])
  assert.equal(fm.body, 'A')
})

test('an unknown theme name and an unknown or mistyped variable warn with their line', () => {
  const fm = readFrontmatter('---\nconfig:\n  theme: dark\n  themeVariables:\n    primaryColor: red\n    edge.width: wide\n---\nA')
  assert.deepEqual(fm.warnings.map(w => [w.kind, w.line]), [['theme', 3], ['theme', 5], ['theme', 6]])
  assert.match(fm.warnings[0].message, /unknown theme "dark"/)
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
  assert.deepEqual(mergeOptions({ mode: '3d' }, fm), { mode: '3d', labels: 'top', toolbar: false, controls: false, crossings: 'none', avoidCrossings: 'some', crossingControls: false })
  // nothing set anywhere: the defaults (iso; no crossing controls)
  assert.deepEqual(mergeOptions(), { mode: 'iso', labels: 'top', toolbar: true, controls: true, crossings: 'none', avoidCrossings: 'some', crossingControls: false })
})

test('the default mode is iso, and flat is set by a prop or by the frontmatter', () => {
  assert.equal(DEFAULTS.mode, 'iso')
  assert.equal(mergeOptions().mode, 'iso')
  assert.equal(mergeOptions({ mode: 'flat' }).mode, 'flat')
  const fm = readFrontmatter('---\nconfig:\n  bonkei:\n    mode: flat\n---\nA')
  assert.deepEqual(fm.warnings, [])
  assert.equal(mergeOptions({}, fm.options).mode, 'flat')
})

test('crossingControls is read from frontmatter, and a non-boolean warns with its line', () => {
  const fm = readFrontmatter('---\nconfig:\n  bonkei:\n    crossingControls: true\n    crossings: bridge\n---\nA')
  assert.deepEqual(fm.options, { crossingControls: true, crossings: 'bridge' })
  assert.deepEqual(fm.warnings, [])
  const bad = readFrontmatter('---\nconfig:\n  bonkei:\n    crossingControls: yes\n---\nA')
  assert.deepEqual(bad.options, {})
  assert.deepEqual(bad.warnings.map(w => [w.kind, w.line, w.text]), [['frontmatter', 4, 'crossingControls: yes']])
})

test('crossingControls: a prop beats the frontmatter, and a crossing style alone does not turn it on', () => {
  assert.equal(mergeOptions({ crossingControls: false }, { crossingControls: true }).crossingControls, false)
  assert.equal(mergeOptions({}, { crossingControls: true }).crossingControls, true)
  assert.equal(mergeOptions({ crossings: 'bridge' }).crossingControls, false)
  assert.equal(mergeOptions({ crossings: 'bridge' }).crossings, 'bridge')
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

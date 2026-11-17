import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BONKEI, CLASSIC, BONKEI_LANDSCAPE, themeByName, withVariables } from './theme.ts'

test('presets are plain JSON: they survive a round trip', () => {
  for (const t of [CLASSIC, BONKEI, BONKEI_LANDSCAPE]) assert.deepEqual(JSON.parse(JSON.stringify(t)), t)
})

test('landscape is Bonkei with two tokens changed: the form, and how far its label is pulled forward', () => {
  assert.equal(BONKEI_LANDSCAPE.node.form, 'landscape')
  assert.deepEqual({ ...BONKEI_LANDSCAPE, name: '', node: { ...BONKEI_LANDSCAPE.node, form: 'block' }, label: { ...BONKEI_LANDSCAPE.label, toward: 0 } }, { ...BONKEI, name: '' })
})

test('an unknown name is Classic with a problem; no name is Classic without one', () => {
  const r = themeByName('nope')
  assert.equal(r.theme, CLASSIC)
  assert.match(r.problem!.message, /unknown theme "nope"/)
  assert.equal(themeByName(undefined).problem, undefined)
  assert.equal(themeByName('Bonkei').theme, BONKEI)
})

test('variables override single tokens on a copy, and bad ones are reported', () => {
  const r = withVariables(BONKEI, { 'edge.width': 4, 'tray.colors.0': '#fff', 'node.nope': 1, 'edge.color': 3, 'node': 'x' })
  assert.equal(r.theme.edge.width, 4)
  assert.equal(r.theme.tray.colors[0], '#fff')
  assert.equal(BONKEI.edge.width, 2)
  assert.deepEqual(r.problems.map(p => p.key), ['node.nope', 'edge.color', 'node'])
})

test('the names a diagram can use are classic, bonkei and bonkei-landscape, and each preset is named for its key', async () => {
  const { PRESETS, THEME_NAMES } = await import('./theme.ts')
  assert.deepEqual(THEME_NAMES, ['classic', 'bonkei', 'bonkei-landscape'])
  for (const n of THEME_NAMES) assert.equal(PRESETS[n].name, n)
  assert.equal(themeByName('bonkei-landscape').theme, BONKEI_LANDSCAPE)
})

test('the presets are frozen, so one diagram cannot change another one\'s look', () => {
  assert.throws(() => { (CLASSIC.edge as { width: number }).width = 9 })
  assert.throws(() => { (BONKEI.tray.colors as string[])[0] = '#000' })
  assert.equal(CLASSIC.edge.width, 2)
})

test('a variable must be one of a token\'s words, and a nullable token takes null or its type', () => {
  const ok = withVariables(BONKEI, { 'node.form': 'landscape', 'tray.sides.1': 'stone', 'node.outline': null, 'edge.rim': '#123456', 'label.font': null })
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.theme.node.form, 'landscape')
  assert.equal(ok.theme.tray.sides[1], 'stone')
  assert.equal(ok.theme.node.outline, null)
  const bad = withVariables(CLASSIC, { 'node.form': 'castle', 'tray.sides.0': 'tartan', 'node.outline': 3, 'edge.width': null, 'name': 'mine', 'tray.titles': 'middle', 'edge.width ': 1 })
  assert.deepEqual(bad.problems.map(p => p.key), ['node.form', 'tray.sides.0', 'node.outline', 'edge.width', 'name', 'tray.titles', 'edge.width '])
  assert.match(bad.problems[0].message, /one of block, landscape/)
  assert.match(bad.problems[2].message, /must be a string or null/)
  assert.equal(bad.theme.node.form, 'block') // a bad variable is skipped
})

test('resolveTheme: the prop beats the frontmatter name, and the frontmatter variables apply on top of either', async () => {
  const { resolveTheme } = await import('./theme.ts')
  const none = resolveTheme(undefined)
  assert.equal(none.theme, CLASSIC)
  assert.equal(none.source, 'default')
  const fm = resolveTheme(undefined, { name: 'bonkei' })
  assert.equal(fm.theme, BONKEI)
  assert.equal(fm.source, 'frontmatter')
  assert.equal(fm.problem, undefined) // a bad frontmatter name is reported by readFrontmatter, with its line
  const prop = resolveTheme('bonkei-landscape', { name: 'classic', variables: { 'edge.flat': true } })
  assert.equal(prop.theme.name, 'bonkei-landscape')
  assert.equal(prop.theme.edge.flat, true)
  assert.equal(prop.source, 'prop')
  assert.equal(prop.variables, 1)
  assert.equal(BONKEI_LANDSCAPE.edge.flat, false)
  const unknown = resolveTheme('nope')
  assert.equal(unknown.theme, CLASSIC)
  assert.match(unknown.problem!.message, /unknown theme "nope"/)
  const object = resolveTheme({ ...BONKEI, name: 'mine' })
  assert.equal(object.theme.name, 'mine')
  assert.equal(object.requested, undefined)
})

test('one diagram\'s override leaves the same theme in another diagram as it was', async () => {
  const { resolveTheme } = await import('./theme.ts')
  const a = resolveTheme(undefined, { name: 'bonkei', variables: { 'edge.flat': true } })
  const b = resolveTheme(undefined, { name: 'bonkei' })
  assert.equal(a.theme.edge.flat, true)
  assert.equal(b.theme.edge.flat, false)
  assert.equal(b.theme, BONKEI)
})

test('inkPx: Classic keeps fixed widths; Bonkei ink follows the scale between its minimum and the token width', async () => {
  const { inkPx } = await import('./theme.ts')
  assert.equal(inkPx(CLASSIC, 2, 5), 2)
  assert.equal(inkPx(CLASSIC, 2, 500), 2)
  const w = BONKEI.node.outlineWidth, ref = BONKEI.ink.ref!
  assert.equal(inkPx(BONKEI, w, ref * 4), w) // zoomed in: never wider than the token
  assert.equal(inkPx(BONKEI, w, ref / 100), BONKEI.ink.min) // far out: never thinner than the minimum
  assert.ok(Math.abs(inkPx(BONKEI, w, ref * 0.8) - w * 0.8) < 1e-9) // in between: in proportion
  assert.equal(inkPx(BONKEI, 2 * w, ref / 100), 2 * BONKEI.ink.min) // a line twice an outline keeps twice the minimum
})

test('only a theme\'s own tokens can be set: an array\'s length and inherited names are unknown, and nothing changes', () => {
  const r = withVariables(BONKEI, { 'tray.colors.length': 0, 'tray.sides.length': 1, 'node.toString': 'x', 'constructor': 'x', '__proto__.x': 1, 'tray.colors.3': '#fff' })
  assert.deepEqual(r.problems.map(p => p.message), [
    'unknown theme variable tray.colors.length', 'unknown theme variable tray.sides.length', 'unknown theme variable node.toString',
    'unknown theme variable constructor', 'unknown theme variable __proto__.x', 'unknown theme variable tray.colors.3',
  ])
  assert.deepEqual(r.theme.tray.colors, BONKEI.tray.colors)
  assert.deepEqual(r.theme.tray.sides, BONKEI.tray.sides)
})

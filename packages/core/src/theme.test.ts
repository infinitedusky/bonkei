import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BONKEI, CLASSIC, LANDSCAPE, themeByName, withVariables } from './theme.ts'

test('presets are plain JSON: they survive a round trip', () => {
  for (const t of [CLASSIC, BONKEI, LANDSCAPE]) assert.deepEqual(JSON.parse(JSON.stringify(t)), t)
})

test('landscape is Bonkei with two tokens changed: the form, and how far its label is pulled forward', () => {
  assert.equal(LANDSCAPE.node.form, 'landscape')
  assert.deepEqual({ ...LANDSCAPE, name: '', node: { ...LANDSCAPE.node, form: 'block' }, label: { ...LANDSCAPE.label, toward: 0 } }, { ...BONKEI, name: '' })
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
  assert.equal(BONKEI.edge.width, 2.4)
  assert.deepEqual(r.problems.map(p => p.key), ['node.nope', 'edge.color', 'node'])
})

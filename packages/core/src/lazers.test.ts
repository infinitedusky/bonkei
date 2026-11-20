import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LAZERS, PRESETS, withVariables } from './theme.ts'
import { findBends, laserColours, roles, type V } from './lasers.ts'

const L = (pts: V[], ci = 0) => ({ pts, ci })

test('a 90° bend gets a mirror at 45° to both beams: its normal is b - a, equally off each', () => {
  const r = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 2]])])
  assert.equal(r.mirrors.length, 1)
  const { a, b } = r.mirrors[0]
  const n = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...n)
  const cosA = -(n[0] * a[0] + n[1] * a[1] + n[2] * a[2]) / l, cosB = (n[0] * b[0] + n[1] * b[1] + n[2] * b[2]) / l
  assert.ok(Math.abs(cosA - Math.SQRT1_2) < 1e-9 && Math.abs(cosB - Math.SQRT1_2) < 1e-9)
})

test('a straight run has none; a tray step (a jog 0.25 high, same direction either side) is one periscope, not two mirrors', () => {
  assert.equal(findBends([L([[0, 0, 0], [1, 0, 0], [2, 0, 0]])]).mirrors.length, 0)
  const r = findBends([L([[0, 0.25, 0], [1, 0.25, 0], [1, 0.5, 0], [2, 0.5, 0]])])
  assert.equal(r.periscopes.length, 1)
  assert.equal(r.mirrors.length, 0)
})

test('two close bends that do not form a jog get smaller mirrors, down to 40%', () => {
  const r = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 0.2], [0.5, 0, 0.2]])])
  assert.equal(r.periscopes.length, 0)
  assert.equal(r.mirrors.length, 2)
  assert.ok(r.mirrors.every(m => m.size >= 0.4 && m.size <= 0.5))
})

test('one beam splitting, one straight on and one turning, is one half-silvered plate at 45°: no mirror, no prism', () => {
  const r = findBends([L([[0, 0, 0], [4, 0, 0]]), L([[0, 0, 0], [2, 0, 0], [2, 0, 2]], 1)])
  assert.equal(r.halves.length, 1)
  assert.equal(r.mirrors.length + r.prisms.length, 0)
  assert.deepEqual(r.halves[0].a, [1, 0, 0]) // the way in and the straight way on
  assert.deepEqual(r.halves[0].b, [0, 0, 1]) // the turning beam's way out
})

test('two beams that part in opposite directions (a T) get one prism, not two plates', () => {
  const r = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 2]]), L([[0, 0, 0], [2, 0, 0], [2, 0, -2]], 1)])
  assert.equal(r.prisms.length, 1)
  assert.equal(r.halves.length + r.mirrors.length, 0)
})

test('three beams parting at one point (straight, left, right) get one prism', () => {
  const r = findBends([L([[0, 0, 0], [4, 0, 0]]), L([[0, 0, 0], [2, 0, 0], [2, 0, 2]], 1), L([[0, 0, 0], [2, 0, 0], [2, 0, -2]], 2)])
  assert.equal(r.prisms.length, 1)
  assert.equal(r.halves.length, 0)
})

test('two beams joining, one straight on and one arriving from the side, is one half-silvered plate', () => {
  const r = findBends([L([[0, 0, 0], [4, 0, 0]]), L([[2, 0, 2], [2, 0, 0], [4, 0, 0]], 1)])
  assert.equal(r.halves.length, 1)
  assert.deepEqual(r.halves[0].a, [0, 0, -1])
  assert.deepEqual(r.halves[0].b, [1, 0, 0])
})

test('a beam through a portal carries on: each part is its own line with no bend at the join', () => {
  assert.equal(findBends([L([[0, 0, 0], [1, 0, 0]]), L([[3, 0, 0], [4, 0, 0]])]).mirrors.length, 0)
})

test('roles come from the edges', () => {
  const r = roles(['a', 'b', 'c', 'd'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])
  assert.deepEqual([...r.values()], ['emitter', 'relay', 'detector', 'idle'])
})

test('laser colours: the text wins, a relay has its own, nearby nodes differ', () => {
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }, { from: 'c', to: 'd' }]
  const { colours, auto } = laserColours(edges, { a: '#123456' }, LAZERS.node.lasers)
  assert.equal(colours.get('a'), '#123456')
  assert.equal(auto, 2)
  assert.notEqual(colours.get('b'), colours.get('a'))
  assert.notEqual(colours.get('b'), colours.get('c'))
  assert.equal(colours.get('d'), undefined) // d fires nothing
})

test('edge.beam and edge.optics take themeVariables like the trench light: tune, off, or skipped with a problem', () => {
  const tuned = withVariables(LAZERS, { 'edge.beam.haloWidth': 20, 'edge.beam.halo': '#00ff00' })
  assert.deepEqual(tuned.problems, [])
  assert.equal(tuned.theme.edge.beam.haloWidth, 20)
  assert.equal(tuned.theme.edge.beam.halo, '#00ff00')
  const off = withVariables(LAZERS, { 'edge.beam': 'off', 'edge.optics': 'off' })
  assert.equal(off.theme.edge.beam.on, false)
  assert.equal(off.theme.edge.optics.on, false)
  assert.equal(LAZERS.edge.beam.on, true) // the preset is untouched
  const bad = withVariables(LAZERS, { 'edge.beam.halo': 'not-a-colour', 'edge.beam.haloWidth': -1, 'edge.arrow': 'cone', 'node.form': 'ring', 'node.lasers.0': 'nope', 'edge.beam': 7 })
  assert.equal(bad.problems.length, 6)
  assert.equal(bad.theme.edge.beam.halo, null)
})

test('every preset carries the same Lazers tokens', () => {
  for (const t of Object.values(PRESETS)) { assert.equal(typeof t.edge.beam.on, 'boolean'); assert.equal(typeof t.edge.optics.on, 'boolean'); assert.ok(t.node.lasers.length) }
})

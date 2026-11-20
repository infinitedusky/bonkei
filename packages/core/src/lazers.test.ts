import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LAZERS, PRESETS, withVariables } from './theme.ts'
import fs from 'node:fs'
import { findBends, laserColours, pieceGap, roles, type Bends, type Line, type V } from './lasers.ts'
import { prepare } from './diagram.ts'
import { planEdges, type Body, type CrossingStyle } from './edges3d.ts'
import { NODE_H, S } from './scale.ts'
import type { LayoutResult } from './model.ts'

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

test('two close bends that do not form a jog get smaller mirrors that clear each other', () => {
  const r = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 0.2], [0.5, 0, 0.2]])])
  assert.equal(r.periscopes.length, 0)
  assert.equal(r.mirrors.length, 2)
  assert.ok(r.mirrors.every(m => !m.slim && m.size >= 0.3 && m.size < 0.5))
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

test('two edges that run together and bend alike (a bundle dipping into a tunnel, a step onto a tray) are one beam: one periscope, no prism, no second piece', () => {
  const dip: V[] = [[0, 0.5, 0], [1, 0.5, 0], [1, 0.25, 0], [2, 0.25, 0], [2, 0.5, 0], [3, 0.5, 0]]
  const r = findBends([L(dip), L([...dip.slice(0, 5), [3, 0.5, 0]], 1)])
  assert.equal(r.prisms.length + r.halves.length, 0)
  assert.equal(r.periscopes.length, 2)
  const bend = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 2]]), L([[0, 0, 0], [2, 0, 0], [2, 0, 2]], 1)])
  assert.equal(bend.mirrors.length, 1)
  assert.equal(bend.halves.length + bend.prisms.length, 0)
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

test('a lone turn that another beam only passes near is still a plain mirror', () => {
  const r = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 2]]), L([[0, 0, 0.5], [4, 0, 0.5]], 1)])
  assert.equal(r.mirrors.length, 1)
  assert.equal(r.halves.length + r.doubles.length + r.prisms.length, 0)
})

test('beams on one line in opposite directions with one turning: a half-silvered plate, not a prism', () => {
  const r = findBends([L([[0, 0, 0], [4, 0, 0]]), L([[4, 0, 0], [0, 0, 0]], 1), L([[0, 0, 0], [2, 0, 0], [2, 0, 2]], 2)])
  assert.equal(r.halves.length, 1)
  assert.equal(r.prisms.length + r.mirrors.length, 0)
})

test('two beams turning in one plane from opposite sides: one plate silvered both sides', () => {
  const r = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 2]]), L([[2, 0, -2], [2, 0, 0], [4, 0, 0]], 1)])
  // +x -> +z and +z -> +x turn in one plane (normal -x + z / x - z): one double-sided plate
  assert.equal(r.doubles.length, 1)
  assert.equal(r.prisms.length + r.halves.length + r.mirrors.length, 0)
  const t = findBends([L([[0, 0, 0], [2, 0, 0], [2, 0, 2]]), L([[0, 0, 0], [2, 0, 0], [2, 0, -2]], 1)]) // a true T: two ways, none shared
  assert.equal(t.prisms.length, 1)
  assert.equal(t.prisms[0].kind, 't')
})

test('a jog on a run other beams pass straight through is one half-silvered periscope, not two stacked pieces', () => {
  const r = findBends([L([[0, 0.5, 0], [1, 0.5, 0], [1, 0.25, 0], [2, 0.25, 0]]), L([[0, 0.5, 0], [3, 0.5, 0]], 1), L([[0, 0.25, 0], [3, 0.25, 0]], 2)])
  assert.equal(r.periscopes.length, 1)
  assert.equal(r.periscopes[0].glass, true)
  assert.equal(r.prisms.length + r.halves.length + r.mirrors.length, 0)
})

// ---- pieces never touch: on the large sample's own plans, in every crossing style, and on a dense bundle
const text = (name: string) => {
  const src = fs.readFileSync(new URL('../../../apps/playground/src/samples.ts', import.meta.url), 'utf8')
  const at = src.indexOf('const ' + name + ' = `') + ('const ' + name + ' = `').length
  const body = src.slice(at, src.indexOf('\n`\n', at) + 1)
  const srcs = Array.from({ length: 30 }, (_, i) => `S${i + 1}[Source ${i + 1}]`) // as samples.ts makes them
  return new Function('srcs', 'return `' + body + '`')(srcs) as string
}
async function drawn(src: string, style: CrossingStyle): Promise<Line[]> {
  const d = (await prepare(src, { theme: 'lazers' })).data as LayoutResult
  const W = d.width, H = d.height
  const bodies: Body[] = d.boxes.map(b => ({ id: b.id, kind: b.kind, x0: (b.x - W / 2) * S, z0: (b.y - H / 2) * S, x1: (b.x + b.w - W / 2) * S, z1: (b.y + b.h - H / 2) * S, level: b.level, parent: b.parent, height: b.kind === 'node' ? (b.height ?? NODE_H) : b.height, tray: 0.25 }))
  const { plans } = planEdges(bodies, d.routes.map(r => ({ id: r.id, from: r.from, to: r.to, points: r.points.map(([x, y]) => [(x - W / 2) * S, (y - H / 2) * S] as [number, number]) })), style)
  return [...plans.values()].flatMap((p, ci) => p.parts.map(part => ({ ci, pts: part.map(([x, z, y]) => [x, y, z] as V) })))
}
function pieces(b: Bends) {
  const bound = (r: number, s: number, slim: boolean) => (slim ? 0.07 : r * s)
  return [
    ...[...b.mirrors, ...b.halves, ...b.doubles].map(m => ({ p: m.at, q: m.at, r: bound(0.26, m.size, m.slim) })),
    ...b.periscopes.map(m => ({ p: m.from, q: m.to, r: bound(0.215, m.size, m.slim) })),
    ...b.prisms.map(m => ({ p: m.at, q: m.at, r: bound(0.25, m.size, m.slim) })),
  ]
}
function overlaps(b: Bends) {
  const ps = pieces(b), bad: string[] = []
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (pieceGap(ps[i], ps[j]) < ps[i].r + ps[j].r) bad.push(`${i}:${j} ${pieceGap(ps[i], ps[j]).toFixed(3)} < ${(ps[i].r + ps[j].r).toFixed(3)}`)
  return bad
}

test('no two pieces touch on the large and wide samples, in every crossing style, and on a dense K3,3 bundle', async () => {
  const k33 = 'flowchart LR\n' + [...'ABC'].flatMap(a => [...'DEF'].map(b => `  ${a} --> ${b}`)).join('\n')
  for (const [name, src] of [['large', text('large')], ['wide', text('wide')], ['K3,3', k33]] as const) {
    for (const style of ['none', 'bridge', 'tunnel', 'portal'] as const) {
      const b = findBends(await drawn(src, style))
      assert.ok(pieces(b).length > 10 || name === 'K3,3', `${name} ${style} has pieces`)
      assert.deepEqual(overlaps(b), [], `${name} ${style}`)
      // none is drawn too big for the room: every piece is a scale in 0.3..1, or slim
      for (const m of [...b.mirrors, ...b.halves, ...b.doubles, ...b.periscopes, ...b.prisms]) assert.ok(m.slim || (m.size >= 0.3 && m.size <= 1), `${name} ${style} size ${m.size}`)
    }
  }
})

test('the new counts on the large and wide samples and K3,3', async () => {
  const k33 = 'flowchart LR\n' + [...'ABC'].flatMap(a => [...'DEF'].map(b => `  ${a} --> ${b}`)).join('\n')
  const out: Record<string, unknown> = {}
  for (const [name, src] of [['large', text('large')], ['wide', text('wide')], ['K3,3', k33]] as const) {
    const b = findBends(await drawn(src, 'none'))
    const all = [...b.mirrors, ...b.halves, ...b.doubles, ...b.periscopes, ...b.prisms]
    out[name] = { mirrors: b.mirrors.length, periscopes: b.periscopes.length, halves: b.halves.length, doubles: b.doubles.length, prisms: b.prisms.length, ts: b.prisms.filter(p => p.kind === 't').length, slim: all.filter(x => x.slim).length, merged: b.merged }
  }
  console.log(JSON.stringify(out))
})

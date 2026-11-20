// Cloud Cartography (BON-235): the other themes are unchanged, and what the new theme needs from the parser, the layout and the scene's
// plain helpers. fixtures/cloud-layouts-main.json was written by main's own prepare() on fixtures/snapshot-first.mmd (the playground's
// first sample) and fixtures/snapshot-dotted.mmd (dotted links and <br> labels), the same for Classic, Bonkei and Bonkei · landscape.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CLASSIC, BONKEI, BONKEI_LANDSCAPE, BLUEPRINT, CLOUD_CARTOGRAPHY, PRESETS, drawnCounts, resolveTheme, themeFonts, withVariables } from './theme.ts'
import { parse } from './parser.ts'
import { prepare } from './diagram.ts'
import { GROUND_ROOM, PAD, trimToIcons } from './layout.ts'
import { arcPath, ARC_POINTS } from './arcs.ts'
import { zoneColors } from './zones.ts'
import { FONT_NAMES, fontFileUrl } from './fonts.ts'
import { headroom } from './scale.ts'
import type { Box, LayoutResult } from './model.ts'

const json = (f: string) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const dotted = fs.readFileSync(new URL('./fixtures/snapshot-dotted.mmd', import.meta.url), 'utf8')
const first = fs.readFileSync(new URL('./fixtures/snapshot-first.mmd', import.meta.url), 'utf8')

// every token main had has the value it had; the tokens added since are the ones listed here, and say nothing in the older themes
function sameAsMain(now: any, main: any, path: string) {
  if (main !== null && typeof main === 'object') for (const k of Object.keys(main)) sameAsMain(now[k], main[k], `${path}.${k}`)
  else assert.deepEqual(now, main, path)
}
test('Classic, Bonkei and Bonkei · landscape keep every token main gave them', () => {
  const main = json('./fixtures/themes-main.json')
  for (const [k, t] of Object.entries({ classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': BONKEI_LANDSCAPE })) sameAsMain(t, main[k], k)
  assert.equal(PRESETS.blueprint.edge.dotted, 'line')
})
test('the tokens added for Cloud Cartography are off in the older themes', () => {
  for (const t of [CLASSIC, BONKEI, BONKEI_LANDSCAPE]) {
    assert.equal(t.tray.colorBy, 'level'); assert.notEqual(t.tray.titles, 'ground'); assert.equal(t.node.form === 'icon', false)
    assert.equal(t.edge.arrow, 'end'); assert.equal(t.edge.dotted, 'line'); assert.equal(t.label.pill, null); assert.equal(t.label.node.style === 'card', false); assert.equal(t.tray.radius, 0)
  }
})
test('cloud-cartography is a preset, by name and by frontmatter', () => {
  assert.equal(PRESETS['cloud-cartography'], CLOUD_CARTOGRAPHY)
  assert.equal(resolveTheme(undefined, { name: 'cloud-cartography' }).theme.name, 'cloud-cartography')
  assert.equal(resolveTheme('Cloud-Cartography').theme, CLOUD_CARTOGRAPHY)
})

const geometry = (d: any) => JSON.parse(JSON.stringify({ width: d.width, height: d.height, boxes: d.boxes.map((b: any) => ({ id: b.id, label: b.label, kind: b.kind, shape: b.shape, x: b.x, y: b.y, w: b.w, h: b.h, level: b.level, parent: b.parent })), routes: d.routes.map((r: any) => ({ id: r.id, from: r.from, to: r.to, label: r.label, points: r.points })) }))
test('the layout of the other themes is main\'s, on the first sample and on one with dotted links and <br> labels', async () => {
  const main = json('./fixtures/cloud-layouts-main.json')
  for (const t of ['classic', 'bonkei', 'bonkei-landscape']) {
    assert.deepEqual(geometry((await prepare(first, { theme: t })).data), main.first, t + ' first')
    assert.deepEqual(geometry((await prepare(dotted, { theme: t })).data), main.dotted, t + ' dotted')
  }
})

test('the parser keeps a dotted link and a two-line label, and the one-line reading is as before', () => {
  const g = parse('flowchart LR\n  A["Order API<br>Go · 3 pods"] -.->|pay| B[One line]\n  A --> B\n  B -.- C')
  assert.deepEqual(g.edges.map(e => !!e.dotted), [true, false, true])
  const a = g.nodes.find(n => n.id === 'A')!
  assert.equal(a.label, 'Order API Go · 3 pods'); assert.equal(a.title, 'Order API'); assert.equal(a.sub, 'Go · 3 pods')
  assert.equal(g.nodes.find(n => n.id === 'B')!.sub, undefined)
})

test('with the arcs option the dotted links leave the layout and come back as arcs', async () => {
  const p = await prepare(dotted, { theme: 'cloud-cartography' })
  const d: any = p.data
  assert.equal(p.arcs, true)
  assert.deepEqual(d.arcs.map((a: any) => [a.from, a.to, a.label]), [['queue', 'papi', 'pay'], ['ledger', 'browser', 'receipt']])
  assert.equal(d.routes.length, 9) // 11 links written, 2 of them dotted
  const f: any = await prepare('---\nconfig:\n  theme: cloud-cartography\n---\n' + dotted)
  assert.equal(f.arcs, true); assert.equal(f.data.arcs.length, 2)
  assert.equal((await prepare(dotted)).arcs, false)
})

test('a two-line label reaches the layout\'s boxes as name and subtitle; a one-line label has neither, and is sized as before', async () => {
  const d = (await prepare(dotted, { theme: 'cloud-cartography' })).data as LayoutResult
  const by = new Map(d.boxes.map(b => [b.id, b]))
  assert.deepEqual([by.get('oapi')!.title, by.get('oapi')!.sub, by.get('oapi')!.label], ['Order API', 'Go · 3 pods', 'Order API Go · 3 pods'])
  assert.equal(by.get('valid')!.title, undefined); assert.equal(by.get('valid')!.sub, undefined)
  const classic = (await prepare(dotted)).data as LayoutResult
  assert.equal(classic.boxes.find(b => b.id === 'oapi')!.label, 'Order API Go · 3 pods')
})

test('a ground title gets room at the bottom of every tray: no node stands in it, and the other themes get none', async () => {
  const d = (await prepare(dotted, { theme: 'cloud-cartography' })).data as LayoutResult
  assert.equal(d.groundRoom, true)
  const by = new Map(d.boxes.map(b => [b.id, b]))
  for (const b of d.boxes) {
    const p = b.parent && by.get(b.parent)
    if (p) assert.ok(b.y + b.h <= p.y + p.h - GROUND_ROOM - PAD.side + 0.5, `${b.id} stays above ${p.id}'s title room`)
  }
  assert.equal(((await prepare(dotted)).data as LayoutResult).groundRoom, undefined)
})

test('a dotted link from a node to itself, or to a tray, is an arc too', async () => {
  const d = (await prepare('flowchart LR\n  subgraph Z[Zone]\n    A\n  end\n  A -.-> A\n  A -.-> Z\n  A --> B', { theme: 'cloud-cartography' })).data as LayoutResult
  assert.deepEqual(d.arcs!.map(a => [a.from, a.to]), [['A', 'A'], ['A', 'Z']])
  assert.equal(d.routes.length, 1)
})

test('an arc rises to a quarter of its span at its middle and lands on its ends; a self-link loops over its node', () => {
  const p = arcPath([0, 1, 0], [8, 1, 0], 0.25)
  assert.equal(p.length, ARC_POINTS)
  assert.deepEqual(p[0], [0, 1, 0]); assert.deepEqual(p[p.length - 1], [8, 1, 0])
  assert.ok(Math.abs(p[(ARC_POINTS - 1) / 2][1] - 3) < 1e-9, 'peak 1 + 8 x 0.25')
  const loop = arcPath([2, 1, 3], [2, 1, 3], 0.25)
  assert.ok(Math.max(...loop.map(q => q[1])) > 2, 'it stands over the node')
  assert.ok(loop.every(q => q.every(Number.isFinite)))
  const [a, b] = [loop[loop.length - 3], loop[loop.length - 1]]
  assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 0, 'its end has a direction for the arrowhead')
})

const box = (id: string, kind: 'node' | 'group', x: number, y: number, w: number, h: number, level: number, parent?: string): Box => ({ id, label: id, kind, shape: 'rect', x, y, w, h, level, parent })
test('each top-level tray takes the next zone colour; a nested tray its top-level ancestor\'s, marked nested; colour by level gives none', () => {
  const boxes = new Map([box('a', 'group', 0, 0, 100, 100, 0), box('b', 'group', 200, 0, 100, 100, 0), box('c', 'group', 400, 0, 100, 100, 0), box('d', 'group', 410, 10, 50, 50, 1, 'c'), box('e', 'group', 415, 15, 20, 20, 2, 'd'), box('n', 'node', 10, 10, 20, 20, 1, 'a')].map(b => [b.id, b]))
  const z = zoneColors(boxes, CLOUD_CARTOGRAPHY.tray)
  const [g, o, gr] = CLOUD_CARTOGRAPHY.tray.zones
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map(id => z.get(id)), [{ color: g, nested: false }, { color: o, nested: false }, { color: gr, nested: false }, { color: gr, nested: true }, { color: gr, nested: true }])
  assert.equal(z.has('n'), false)
  assert.equal(new Set(['a', 'b', 'c'].map(id => z.get(id)!.color)).size, 3)
  assert.equal(zoneColors(boxes, CLASSIC.tray).size, 0)
  assert.equal(zoneColors(boxes, { colorBy: 'zone', zones: [] }).size, 0)
})

test('a line that leaves a box\'s side straight out is lengthened in to the icon; a line along the side is left alone', () => {
  const boxes = new Map([box('a', 'node', 0, 0, 120, 60, 0), box('b', 'node', 300, 0, 120, 60, 0)].map(b => [b.id, b]))
  const [r] = trimToIcons([{ id: 'e', from: 'a', to: 'b', points: [[120, 30], [300, 30]] }], boxes, 20)
  assert.deepEqual(r.points, [[80, 30], [340, 30]])
  const [s] = trimToIcons([{ id: 'e', from: 'a', to: 'b', points: [[120, 30], [120, 30.2], [300, 30]] }], boxes, 20)
  assert.deepEqual(s.points[0], [120, 30], 'its first run does not leave the side')
  const [t] = trimToIcons([{ id: 'e', from: 'a', to: 'b', points: [[120, 30], [300, 30]] }], boxes, 100)
  assert.deepEqual(t.points, [[120, 30], [300, 30]], 'an icon wider than the box keeps the ends')
})

test('the fonts a theme draws with: Cloud Cartography\'s ground and card font is bundled; the older themes name only their label font', () => {
  assert.deepEqual(themeFonts(CLOUD_CARTOGRAPHY), ['archivo'])
  assert.ok((FONT_NAMES as readonly string[]).includes('archivo'))
  assert.match(fontFileUrl('archivo') ?? '', /ArchivoBlack-latin\.ttf$/)
  assert.ok(fs.statSync(new URL('./fonts/ArchivoBlack-latin.ttf', import.meta.url)).size > 1000)
  assert.deepEqual([CLASSIC, BONKEI, BONKEI_LANDSCAPE, BLUEPRINT].map(themeFonts), [[], ['mincho'], ['mincho'], ['architect']])
})

test('the bonkei.first_frame counts: arcs, subtitled cards and icons by shape, only for a theme with icons', async () => {
  const d = (await prepare(dotted, { theme: 'cloud-cartography' })).data as LayoutResult
  assert.deepEqual(drawnCounts(CLOUD_CARTOGRAPHY, d), { 'bonkei.theme.arcs': 2, 'bonkei.theme.subtitled': 8, 'bonkei.theme.icons.round': 2, 'bonkei.theme.icons.rect': 4, 'bonkei.theme.icons.diamond': 2, 'bonkei.theme.icons.cylinder': 2 })
  assert.deepEqual(drawnCounts(CLASSIC, d), {})
  assert.deepEqual(drawnCounts(CLOUD_CARTOGRAPHY, undefined), {})
})

test('the fit leaves room for an icon with its card above it; the older themes keep the landscape height', () => {
  assert.equal(headroom(CLASSIC), 1.6); assert.equal(headroom(BONKEI_LANDSCAPE), 1.6)
  assert.ok(headroom(CLOUD_CARTOGRAPHY) > 3)
})

test('the new tokens take their words as variables, and a wrong word is reported', () => {
  const ok = withVariables(CLOUD_CARTOGRAPHY, { 'edge.dotted': 'line', 'edge.arrow': 'end', 'tray.colorBy': 'level', 'label.pill': null, 'tray.groundFont': 'mincho' })
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.theme.edge.dotted, 'line'); assert.equal(ok.theme.label.pill, null)
  const bad = withVariables(CLOUD_CARTOGRAPHY, { 'edge.dotted': 'curve', 'node.form': 'sprite', 'tray.groundFont': 'comic' })
  assert.deepEqual(bad.problems.map(p => p.key), ['edge.dotted', 'node.form', 'tray.groundFont'])
})

test('a diagram drawn with dotted links as lines (themeVariables edge.dotted: line) routes them like any link', async () => {
  const p = await prepare('---\nconfig:\n  theme: cloud-cartography\n  themeVariables:\n    edge.dotted: line\n---\n' + dotted)
  assert.equal(p.arcs, false)
  assert.equal((p.data as LayoutResult).routes.length, 11)
})

test('a sequence diagram in Cloud Cartography still prepares, with no arcs', async () => {
  const p = await prepare('---\nconfig:\n  theme: cloud-cartography\n---\nsequenceDiagram\n  participant U as User\n  participant A as API\n  U->>A: login\n  A-->>U: token')
  assert.equal(p.arcs, false); assert.equal(p.warnings.length, 0)
  assert.ok('msgs' in p.data)
})

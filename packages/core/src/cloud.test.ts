// Cloud Cartography (BON-235): the other themes are unchanged, and what the new theme needs from the parser and the layout.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CLASSIC, BONKEI, BONKEI_LANDSCAPE, CLOUD_CARTOGRAPHY, PRESETS, resolveTheme } from './theme.ts'
import { parse } from './parser.ts'
import { prepare } from './diagram.ts'

const json = (f: string) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const dotted = fs.readFileSync(new URL('./snapshot-dotted.mmd', import.meta.url), 'utf8')
const first = fs.readFileSync(new URL('./snapshot-first.mmd', import.meta.url), 'utf8')

// every token main had has the value it had; the tokens added since are the ones listed here, and say nothing in the older themes
function sameAsMain(now: any, main: any, path: string) {
  if (main !== null && typeof main === 'object') for (const k of Object.keys(main)) sameAsMain(now[k], main[k], `${path}.${k}`)
  else assert.deepEqual(now, main, path)
}
test('Classic, Bonkei and Bonkei · landscape keep every token main gave them', () => {
  const main = json('./theme-main.json')
  for (const [k, t] of Object.entries({ classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': BONKEI_LANDSCAPE })) sameAsMain(t, main[k], k)
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
  const main = json('./layout-main.json')
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

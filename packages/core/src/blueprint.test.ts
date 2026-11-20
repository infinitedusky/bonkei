// Blueprint (BON-234): its settings, the room its off-tray titles get, its font's fallback, and Classic, Bonkei and Bonkei · landscape
// exactly as main had them. fixtures/themes-main.json and fixtures/layouts-main.json were written by main's own code (PRESETS, and
// prepare() on the diagrams in layout-samples.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import type { Box, LayoutResult, Route } from './model.ts'
import { BLUEPRINT, BONKEI, CLASSIC, BONKEI_LANDSCAPE, PRESETS, themeByName, withVariables } from './theme.ts'
import { FONT_NAMES, fontFileUrl, findFont } from './fonts.ts'
import { layout } from './layout.ts'
import { prepare, wantsTitleRoom } from './diagram.ts'
import { parse } from './parser.ts'
import { unblock } from './monotone.ts'
import { offTitleBoxes, offTitleWidth, titleWidth, OFF_TITLE, TITLE_ROOM } from './titles.ts'
import { SRC } from './layout-samples.ts'

const read = (f: string) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))
const THEMES_MAIN = read('./fixtures/themes-main.json'), LAYOUTS_MAIN = read('./fixtures/layouts-main.json')
const shape = (d: LayoutResult) => ({
  width: d.width, height: d.height,
  boxes: JSON.parse(JSON.stringify(d.boxes.map(b => ({ id: b.id, kind: b.kind, x: b.x, y: b.y, w: b.w, h: b.h, level: b.level, parent: b.parent })))),
  routes: d.routes.map(r => ({ id: r.id, points: r.points })),
})
const withTheme = (name: string, src: string) => `---\nconfig:\n  theme: ${name}\n---\n${src}`

test('Classic, Bonkei and Bonkei · landscape have exactly the settings main had, and the heavier grid line off', () => {
  for (const [name, t] of Object.entries({ classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': BONKEI_LANDSCAPE })) {
    const { major, majorColor, ...ground } = t.ground
    assert.equal(major, 0, `${name} keeps a single-weight grid`)
    assert.equal(typeof majorColor, 'string')
    // the tokens Cloud Cartography added (BON-235) are not main's; cloud.test.ts holds that they are off here
    const j = JSON.parse(JSON.stringify(t))
    delete j.node.icon; delete j.label.card; delete j.label.pill
    for (const k of ['colorBy', 'zones', 'zoneMix', 'radius', 'groundFont', 'groundInk']) delete j.tray[k]
    for (const k of ['arrow', 'dotted', 'arc']) delete j.edge[k]
    assert.deepEqual({ ...j, ground }, THEMES_MAIN[name], name)
  }
})

test('the same diagram gets the same trays, blocks and lines in Classic, Bonkei and Bonkei · landscape as on main, by prop or frontmatter', async () => {
  for (const [k, src] of Object.entries(SRC)) {
    for (const theme of ['classic', 'bonkei', 'bonkei-landscape']) {
      const byProp = (await prepare(src, { theme })).data as LayoutResult
      assert.deepEqual(shape(byProp), LAYOUTS_MAIN[k], `${k} ${theme} (prop)`)
      assert.equal(byProp.titleRoom, undefined)
      assert.deepEqual(shape((await prepare(withTheme(theme, src))).data as LayoutResult), LAYOUTS_MAIN[k], `${k} ${theme} (frontmatter)`)
    }
    assert.deepEqual(shape((await prepare(src)).data as LayoutResult), LAYOUTS_MAIN[k], `${k} with no theme`)
  }
})

test('Blueprint is a built-in theme: off-tray titles, a heavier grid line every 5, hatched sides, flat shading and the lettering font', () => {
  assert.equal(PRESETS.blueprint, BLUEPRINT)
  assert.equal(themeByName('Blueprint').theme, BLUEPRINT)
  assert.ok(Object.isFrozen(BLUEPRINT.ground))
  assert.equal(BLUEPRINT.tray.titles, 'off')
  assert.equal(BLUEPRINT.ground.major, 5)
  assert.ok(BLUEPRINT.ground.grid)
  assert.deepEqual(BLUEPRINT.tray.sides, ['hatch', 'hatch', 'hatch'])
  assert.equal(BLUEPRINT.label.font, 'architect')
  assert.equal(BLUEPRINT.light.shading, 'toon')
  assert.equal(BLUEPRINT.ground.lit, false)
  assert.ok((FONT_NAMES as readonly string[]).includes('architect'))
  assert.match(fontFileUrl('architect')!, /\/fonts\/ArchitectsDaughter-Regular-latin\.ttf$/)
})

test('themeVariables take the new settings in any theme and keep their types and words', () => {
  const ok = withVariables(BONKEI, { 'tray.sides.0': 'hatch', 'tray.titles': 'off', 'ground.major': 4, 'ground.majorColor': '#fff', 'label.font': 'architect' })
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.theme.tray.sides[0], 'hatch')
  assert.equal(ok.theme.tray.titles, 'off')
  assert.equal(ok.theme.ground.major, 4)
  const bad = withVariables(BLUEPRINT, { 'ground.major': 'five', 'tray.sides.1': 'tartan', 'label.font': 'comic', 'tray.titles': 'floating', 'ground.major ': 1 })
  assert.deepEqual(bad.problems.map(p => p.key), ['ground.major', 'tray.sides.1', 'label.font', 'tray.titles', 'ground.major '])
  assert.equal(bad.theme.ground.major, 5)
  assert.equal(withVariables(BLUEPRINT, { 'ground.major': -1 }).problems.length, 1)
})

test('room for the titles is asked for by the look drawn: the theme prop over the frontmatter, with its themeVariables', () => {
  assert.equal(wantsTitleRoom('blueprint'), true)
  assert.equal(wantsTitleRoom(undefined, { name: 'blueprint' }), true)
  assert.equal(wantsTitleRoom('classic', { name: 'blueprint' }), false)
  assert.equal(wantsTitleRoom('blueprint', { name: 'classic' }), true)
  assert.equal(wantsTitleRoom(undefined, { name: 'bonkei', variables: { 'tray.titles': 'off' } }), true)
  assert.equal(wantsTitleRoom(undefined, { name: 'blueprint', variables: { 'tray.titles': 'fixed' } }), false)
  assert.equal(wantsTitleRoom({ ...CLASSIC, tray: { ...CLASSIC.tray, titles: 'off' } }), true)
  assert.equal(wantsTitleRoom(undefined), false)
})

// Every title box (as the scene draws it and the router sees it) checked against the rest of the diagram.
function titleProblems(d: LayoutResult): string[] {
  const out: string[] = []
  const by = new Map(d.boxes.map(b => [b.id, b]))
  const ancestors = (id?: string) => { const l: string[] = []; for (let p = id; p; p = by.get(p)?.parent) l.push(p); return l }
  const hits = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  for (const t of offTitleBoxes(d.boxes)) {
    const tray = by.get(t.title)!, parent = tray.parent ? by.get(tray.parent)! : null
    if (t.w <= 0) out.push(`${t.title}: no room for a title at all`)
    if (t.x < tray.x || t.x + t.w > tray.x + tray.w / 2) out.push(`${t.title}: title not under the tray's left half`)
    if (parent) {
      if (t.y + t.h > parent.y + parent.h || t.x + t.w > parent.x + parent.w) out.push(`${t.title}: title ends outside ${parent.id}`)
    } else if (t.y + t.h > d.height - 10) out.push(`${t.title}: title off the paper`)
    const own = new Set([t.title, ...ancestors(tray.parent)])
    for (const o of d.boxes) if (!own.has(o.id) && hits(t, o)) out.push(`${o.id} touches ${t.title}'s title`)
    for (const r of d.routes) for (let i = 1; i < r.points.length; i++) {
      const [a, b] = [r.points[i - 1], r.points[i]]
      const seg = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) || 1e-6, h: Math.abs(a[1] - b[1]) || 1e-6 }
      if (hits(seg, t)) { out.push(`line ${r.id} runs over ${t.title}'s title`); break }
    }
  }
  return out
}

test('Blueprint leaves room for every title: on the paper or in the parent tray, touching no tray, block or line', async () => {
  for (const [k, src] of Object.entries(SRC)) {
    const d = (await prepare(src, { theme: 'blueprint' })).data as LayoutResult
    assert.equal(d.titleRoom, true)
    assert.ok(d.height > LAYOUTS_MAIN[k].height, `${k} is laid out with more room`)
    assert.deepEqual(titleProblems(d), [], k)
    assert.deepEqual(d.stats?.route?.failed, [], `${k}: every line routed`)
    assert.equal(d.stats?.route?.error, null)
    // the same from the frontmatter
    assert.deepEqual(shape((await prepare(withTheme('blueprint', src))).data as LayoutResult), shape(d), `${k} (frontmatter)`)
    // a sub-tray's title lies on its parent's top: the parent reaches TITLE_ROOM past the sub-tray
    const by = new Map(d.boxes.map(b => [b.id, b]))
    for (const b of d.boxes) if (b.kind === 'group' && b.parent) {
      const p = by.get(b.parent)!
      assert.ok(p.y + p.h - (b.y + b.h) >= TITLE_ROOM, `${k}: ${b.id} has room for its title inside ${p.id}`)
    }
  }
  // without the room the same diagram's titles would lie on what is in front of its trays
  const plain = await layout(parse(SRC.sample, 0))
  assert.notDeepEqual(titleProblems(plain), [])
})

test('a title box is the title and its padding, kept left of the middle of the tray\'s front edge; a long one is drawn smaller', () => {
  assert.equal(offTitleWidth('Billing', 12), titleWidth('Billing', OFF_TITLE.size) + OFF_TITLE.pad * 2)
  const long = 'Customer accounts and their invoices'
  assert.ok(offTitleWidth(long, 6) <= 6 / 2 - 18 / 40 - OFF_TITLE.inset + 1e-9)
  assert.equal(offTitleWidth('A', 0.2), 0, 'a tray too small for one has none, never a negative box')
  const [t] = offTitleBoxes([{ id: 'T', label: 'Billing', kind: 'group', shape: 'rect', x: 100, y: 200, w: 480, h: 160, level: 1, parent: 'P' }])
  assert.deepEqual({ ...t }, { id: '\u0000title:T', title: 'T', label: 'Billing', kind: 'node', shape: 'rect', level: 1, parent: 'P', x: 100 + OFF_TITLE.inset * 40, y: 360 + OFF_TITLE.gap * 40, w: offTitleWidth('Billing', 12) * 40, h: OFF_TITLE.depth * 40 })
  assert.ok(OFF_TITLE.gap * 40 + OFF_TITLE.depth * 40 < TITLE_ROOM, 'the room in front of a tray holds its title box')
})

test('a block slid so its line can go direct never lands on a title (unblock keepOff)', () => {
  const node = (id: string, x: number, y: number, parent?: string, level = 0): Box => ({ id, label: id, kind: 'node', shape: 'rect', x, y, w: 110, h: 56, level, parent })
  const tray = (id: string, x: number, y: number, w: number, h: number): Box => ({ id, label: id, kind: 'group', shape: 'rect', x, y, w, h, level: 0 })
  const W = tray('W', 100, 200, 400, 200), T = tray('T', 0, 500, 900, 200)
  const a = node('a', 245, 50), b = node('b', 245, 580, 'T', 1)
  const r: Route = { id: 'e', from: 'a', to: 'b', points: [[300, 106], [300, 150], [520, 150], [520, 540], [300, 540], [300, 580]] }
  const area = { x0: 245, y0: 0, x1: 355, y1: 800 }
  const free = unblock([W, T, a, b], [r], 10, 0, 32, 40, area).boxes.find(x => x.id === 'b')!
  // a title lying where b would have gone: b does not go there (here it has nowhere else within reach, so it stays)
  const title: Box = { ...node('\u0000title:X', free.x - 20, 560), w: 150, h: 29 }
  const clear = (n: Box) => n.x + n.w + 32 <= title.x || n.x >= title.x + title.w + 32
  assert.ok(!clear(free), 'without keepOff, b slides onto the title')
  const u = unblock([W, T, a, b], [r], 10, 0, 32, 40, area, [title])
  assert.ok(clear(u.boxes.find(x => x.id === 'b')!), 'with it, b keeps clear of the title')
  assert.ok(!u.boxes.some(x => x.id === title.id), 'the title is not one of the diagram\'s boxes')
  // a title out of the way changes nothing
  const away: Box = { ...title, x: 700, y: 650 }
  assert.deepEqual(unblock([W, T, a, b], [r], 10, 0, 32, 40, area, [away]).boxes.find(x => x.id === 'b')!.x, free.x)
})

test('if the lettering font cannot be loaded, labels use the default font and the reason is reported', async () => {
  const f = await findFont('architect', 'http://x/fonts/ArchitectsDaughter-Regular-latin.ttf', async () => { throw new Error('404 Not Found') })
  assert.equal(f.url, undefined)
  assert.match(f.problem!, /^font architect could not be loaded from .* \(404 Not Found\); labels use the default font$/)
  const html = await findFont('architect', 'http://x/a.ttf', async () => new TextEncoder().encode('<!doctype html>'))
  assert.match(html.problem!, /not a font file/)
  const ttf = fs.readFileSync(new URL('./fonts/ArchitectsDaughter-Regular-latin.ttf', import.meta.url))
  assert.equal((await findFont('architect', 'http://x/a.ttf', async () => new Uint8Array(ttf))).problem, undefined)
  assert.match(fs.readFileSync(new URL('./fonts/OFL-ArchitectsDaughter.txt', import.meta.url), 'utf8'), /SIL Open Font License, Version 1\.1/)
})

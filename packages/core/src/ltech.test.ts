// LTech (BON-247): its settings, the settings any theme can take, Blueprint and the rest unchanged by them, the section numbers and the font.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LTECH, BLUEPRINT, BONKEI, CLASSIC, BONKEI_LANDSCAPE, PRESETS, themeByName, withVariables } from './theme.ts'
import { FONT_NAMES, fontFileUrl, findFont } from './fonts.ts'
import { sectionNumbers, sectionTitle } from './titles.ts'
import { SRC } from './layout-samples.ts'
import { prepare } from './diagram.ts'
import type { LayoutResult } from './model.ts'

test('LTech is a built-in theme: white, navy and small pink marks, nothing glowing', () => {
  assert.equal(PRESETS.ltech, LTECH)
  assert.equal(themeByName('LTech').theme, LTECH)
  assert.ok(Object.isFrozen(LTECH.ground))
  assert.equal(LTECH.ground.bg, '#ffffff')
  assert.equal(LTECH.ground.gridStyle, 'dots')
  assert.ok(LTECH.ground.haze)
  assert.equal(LTECH.edge.head, 'chevron')
  assert.equal(LTECH.edge.headColor, '#ff42e6')
  assert.equal(LTECH.tray.titleStyle, 'section')
  assert.deepEqual(LTECH.tray.sides, ['dither', 'dither', 'dither'])
  assert.equal(LTECH.label.shapeText.round, '#ffffff')
  assert.equal(LTECH.label.font, 'inter')
  assert.equal(LTECH.light.shading, 'toon')
  assert.deepEqual([LTECH.edge.glow.core, LTECH.edge.glow.halo, LTECH.edge.glow.wash], [null, null, null], 'no light in the trench')
  assert.match(fontFileUrl('inter')!, /\/fonts\/InterDisplay-Regular-latin\.ttf$/)
  assert.ok((FONT_NAMES as readonly string[]).includes('inter'))
})

test('the other themes have the new settings off', () => {
  for (const t of [CLASSIC, BONKEI, BONKEI_LANDSCAPE, BLUEPRINT]) {
    assert.deepEqual([t.ground.gridStyle, t.ground.haze, t.edge.head, t.edge.headColor, t.tray.titleStyle, t.tray.mark, t.seq.block, t.seq.partFill, t.seq.partText, ...Object.values(t.label.shapeText)],
      ['lines', null, 'cone', null, 'plain', null, null, null, null, null, null, null, null], t.name)
    assert.ok(!t.tray.sides.includes('dither'))
  }
})

test('every new setting can be set on any other theme, and a bad value is reported', () => {
  const ok = withVariables(BLUEPRINT, {
    'ground.gridStyle': 'dots', 'ground.haze': '#f6c8f0', 'ground.hazeWidth': 0.2, 'edge.head': 'chevron', 'edge.headColor': '#ff42e6', 'tray.titleStyle': 'section', 'tray.mark': 'hotpink',
    'tray.sides.2': 'dither', 'label.shapeText.rect': '#fff', 'label.shapeText.diamond': null, 'seq.partFill': '#111', 'seq.block': '#999', 'seq.partText': '#fff', 'label.font': 'inter',
  })
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.theme.ground.gridStyle, 'dots')
  assert.equal(ok.theme.edge.head, 'chevron')
  assert.equal(ok.theme.tray.sides[2], 'dither')
  assert.equal(ok.theme.label.shapeText.rect, '#fff')
  assert.equal(BLUEPRINT.edge.head, 'cone', 'the preset is untouched')
  // and they can be turned off in LTech
  const off = withVariables(LTECH, { 'ground.haze': null, 'edge.headColor': null, 'tray.mark': null, 'label.shapeText.round': null, 'seq.partFill': null })
  assert.deepEqual(off.problems, [])
  assert.equal(off.theme.ground.haze, null)
  const bad = withVariables(BONKEI, {
    'ground.gridStyle': 'squares', 'edge.head': 'arrow', 'tray.titleStyle': 'banner', 'tray.sides.0': 'dots', 'ground.haze': 'pinkish', 'ground.hazeWidth': -1, 'edge.headColor': 5,
    'tray.mark': 'nope', 'label.shapeText.round': 'blorp', 'seq.partFill': 7, 'seq.block': 'blorp', 'label.shapeText': 'white', 'label.font': 'comic',
  })
  assert.deepEqual(bad.problems.map(p => p.key), ['ground.gridStyle', 'edge.head', 'tray.titleStyle', 'tray.sides.0', 'ground.haze', 'ground.hazeWidth', 'edge.headColor', 'tray.mark', 'label.shapeText.round', 'seq.partFill', 'seq.block', 'label.shapeText', 'label.font'])
  assert.equal(bad.theme.edge.head, 'cone')
})

test('an unknown theme name still falls back to Classic', () => {
  const r = themeByName('ltec')
  assert.equal(r.theme, CLASSIC)
  assert.match(r.problem!.message, /known: classic, bonkei, bonkei-landscape, blueprint, ltech/)
})

test('section titles are numbered in reading order: a tray, the trays in it, then the next beside it', async () => {
  const p = await prepare(SRC[Object.keys(SRC).find(k => /nested|subgraph/i.test(SRC[k]))!] ?? Object.values(SRC)[0], { theme: 'ltech' })
  const boxes = (p.data as LayoutResult).boxes
  const nums = sectionNumbers(boxes)
  const trays = boxes.filter(b => b.kind === 'group')
  assert.equal(nums.size, trays.length)
  assert.deepEqual([...nums.values()].sort((a, b) => a - b), trays.map((_, i) => i + 1))
  for (const t of trays) if (t.parent && nums.has(t.parent)) assert.ok(nums.get(t.parent)! < nums.get(t.id)!, `${t.id} follows its tray`)
  assert.equal(sectionTitle(1, 'Storefront'), '01 · STOREFRONT')
  assert.equal(sectionTitle(12, 'a b'), '12 · A B')
})

test('LTech lays out exactly as Classic does: no room made for titles', async () => {
  for (const src of Object.values(SRC)) {
    const a = (await prepare(src, { theme: 'ltech' })).data as LayoutResult, b = (await prepare(src, { theme: 'classic' })).data as LayoutResult
    assert.deepEqual([a.width, a.height, a.titleRoom], [b.width, b.height, b.titleRoom])
  }
})

test('Inter Display falls back like the other fonts when its file is missing', async () => {
  const f = await findFont('inter', fontFileUrl('inter'), async () => { throw new Error('404 Not Found') })
  assert.equal(f.url, undefined)
  assert.match(f.problem!, /font inter could not be loaded/)
})

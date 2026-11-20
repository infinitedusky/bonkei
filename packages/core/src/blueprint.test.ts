// Blueprint (BON-234): the new settings are in the presets, and Classic, Bonkei and Bonkei · landscape are what main drew.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { BLUEPRINT, BONKEI, CLASSIC, BONKEI_LANDSCAPE, PRESETS, themeByName, withVariables } from './theme.ts'
import { FONT_NAMES, fontFileUrl, findFont } from './fonts.ts'
import { layout } from './layout.ts'
import { prepare } from './diagram.ts'
import { parse } from './parser.ts'
import { SRC } from './layout-samples.ts'

const read = (f: string) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))

test('Classic, Bonkei and Bonkei · landscape are exactly the settings main had, plus the heavier-grid settings switched off', () => {
  const main = read('./theme-main.json')
  for (const [name, t] of Object.entries({ classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': BONKEI_LANDSCAPE })) {
    const { major, majorColor, ...ground } = t.ground
    assert.equal(major, 0, `${name} keeps a single-weight grid`)
    assert.equal(typeof majorColor, 'string')
    assert.deepEqual({ ...JSON.parse(JSON.stringify(t)), ground }, main[name], name)
  }
})

test('the same diagram gets the same tray sizes, positions and lines in Classic, Bonkei and Bonkei · landscape as on main', async () => {
  const main = read('./layout-main.json')
  for (const [k, src] of Object.entries(SRC)) {
    for (const theme of ['classic', 'bonkei', 'bonkei-landscape']) {
      const p = await prepare(src, { theme })
      const d = p.data as Awaited<ReturnType<typeof layout>>
      assert.equal(d.width, main[k].width, `${k} ${theme} width`)
      assert.equal(d.height, main[k].height, `${k} ${theme} height`)
      assert.deepEqual(JSON.parse(JSON.stringify(d.boxes.map(b => ({ id: b.id, kind: b.kind, x: b.x, y: b.y, w: b.w, h: b.h, level: b.level, parent: b.parent })))), main[k].boxes, `${k} ${theme} boxes`)
      assert.deepEqual(d.routes.map(r => ({ id: r.id, points: r.points })), main[k].routes, `${k} ${theme} lines`)
    }
  }
})

test('Blueprint asks for off-tray titles, a heavier grid line every 5, hatched sides and the lettering font', () => {
  assert.equal(PRESETS.blueprint, BLUEPRINT)
  assert.equal(themeByName('Blueprint').theme, BLUEPRINT)
  assert.equal(BLUEPRINT.tray.titles, 'off')
  assert.equal(BLUEPRINT.ground.major, 5)
  assert.deepEqual(BLUEPRINT.tray.sides, ['hatch', 'hatch', 'hatch'])
  assert.equal(BLUEPRINT.label.font, 'architect')
  assert.equal(BLUEPRINT.light.shading, 'toon')
  assert.ok((FONT_NAMES as readonly string[]).includes('architect'))
  assert.match(fontFileUrl('architect')!, /ArchitectsDaughter-Regular-latin\.ttf$/)
  for (const t of [CLASSIC, BONKEI, BONKEI_LANDSCAPE]) assert.notEqual(t.tray.titles, 'off')
})

test('themeVariables take the new settings and keep their types', () => {
  const ok = withVariables(BONKEI, { 'tray.sides.0': 'hatch', 'tray.titles': 'off', 'ground.major': 4, 'ground.majorColor': '#fff', 'label.font': 'architect' })
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.theme.tray.sides[0], 'hatch')
  assert.equal(ok.theme.ground.major, 4)
  const bad = withVariables(BLUEPRINT, { 'ground.major': 'five', 'tray.sides.1': 'tartan', 'label.font': 'comic' })
  assert.deepEqual(bad.problems.map(p => p.key), ['ground.major', 'tray.sides.1', 'label.font'])
})

test('room for the titles: only a theme that asks for it gets it, and it is made below every tray and under a sub-tray', async () => {
  for (const [k, src] of Object.entries(SRC)) {
    const plain = await layout(parse(src, 0)), roomy = await layout(parse(src, 0), { titleRoom: true })
    assert.ok(roomy.height > plain.height, `${k} is taller`)
    const by = new Map(roomy.boxes.map(b => [b.id, b]))
    const flow = parse(src, 0).direction
    const groups = roomy.boxes.filter(b => b.kind === 'group')
    const TITLE_ROOM = 48
    for (const b of groups) {
      const p = b.parent ? by.get(b.parent)! : null
      // a sub-tray's title lies on its parent's top below it: the parent reaches TITLE_ROOM past the sub-tray, so the title ends inside it
      if (p) assert.ok(p.y + p.h - (b.y + b.h) >= TITLE_ROOM, `${k}: ${b.id} has room for its title inside ${p.id}`)
      else assert.ok(roomy.height - (b.y + b.h) >= TITLE_ROOM, `${k}: ${b.id} has room for its title on the paper`)
      // no other tray or node starts inside the strip below this tray where its title lies
      for (const o of roomy.boxes) {
        if (o.id === b.id || o.parent === b.id || (p && o.id === p.id)) continue
        const sx = o.x < b.x + b.w && o.x + o.w > b.x, sy = o.y < b.y + b.h + TITLE_ROOM && o.y + o.h > b.y + b.h
        if (sx && sy && o.parent === b.parent) assert.fail(`${k} ${flow}: ${o.id} sits in ${b.id}'s title strip`)
      }
    }
  }
})

test('if the lettering font cannot be loaded, labels use the default font and the reason is reported', async () => {
  const f = await findFont('architect', 'http://x/fonts/ArchitectsDaughter-Regular-latin.ttf', async () => { throw new Error('404 Not Found') })
  assert.equal(f.url, undefined)
  assert.match(f.problem!, /font architect could not be loaded.*labels use the default font/)
  const ttf = fs.readFileSync(new URL('./fonts/ArchitectsDaughter-Regular-latin.ttf', import.meta.url))
  assert.equal((await findFont('architect', 'http://x/a.ttf', async () => new Uint8Array(ttf))).problem, undefined)
})

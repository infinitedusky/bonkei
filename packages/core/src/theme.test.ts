import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BLUEPRINT, BONKEI, CLASSIC, BONKEI_LANDSCAPE, themeByName, trenchParts, withVariables } from './theme.ts'

test('presets are plain JSON: they survive a round trip', () => {
  for (const t of [CLASSIC, BONKEI, BONKEI_LANDSCAPE, BLUEPRINT]) assert.deepEqual(JSON.parse(JSON.stringify(t)), t)
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

test('the names a diagram can use are classic, bonkei, bonkei-landscape, blueprint and cloud-cartography, and each preset is named for its key', async () => {
  const { PRESETS, THEME_NAMES } = await import('./theme.ts')
  assert.deepEqual(THEME_NAMES, ['classic', 'bonkei', 'bonkei-landscape', 'blueprint', 'cloud-cartography'])
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

test('a negative number is skipped and reported (a tray -2 thick draws nothing); zero is allowed', () => {
  const r = withVariables(BONKEI, { 'tray.thickness': -2, 'edge.width': -1, 'node.outlineWidth': 0 })
  assert.deepEqual(r.problems.map(p => p.message), ['tray.thickness must be 0 or more; got -2', 'edge.width must be 0 or more; got -1'])
  assert.equal(r.theme.tray.thickness, BONKEI.tray.thickness)
  assert.equal(r.theme.edge.width, BONKEI.edge.width)
  assert.equal(r.theme.node.outlineWidth, 0)
})

test('no preset has a negative number, so the rule above takes nothing a preset uses', async () => {
  const { PRESETS } = await import('./theme.ts')
  const nums = (o: unknown): number[] => (typeof o === 'number' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(nums) : [])
  for (const t of Object.values(PRESETS)) assert.ok(nums(t).every(n => n >= 0), t.name)
})

test('the trench light is theme data: Classic lights its trench in grey-white at 30% with no rim; the Bonkei looks leave it off', () => {
  assert.deepEqual(CLASSIC.edge.glow, { core: '#e0e0e0', coreWidth: 2.1, halo: '#e0e0e0', haloWidth: 6.6, haloOpacity: 0.17, wash: '#e0e0e0', washIntensity: 0.18 })
  assert.equal(CLASSIC.edge.rim, 'none')
  // Bonkei and Bonkei · landscape: no light, and the dark rim they always had
  for (const t of [BONKEI, BONKEI_LANDSCAPE]) {
    assert.deepEqual([t.edge.glow.core, t.edge.glow.halo, t.edge.glow.wash], [null, null, null])
    assert.equal(t.edge.rim, '#2A2622'); assert.equal(t.edge.rimWidth, 2)
  }
  assert.equal(trenchParts(CLASSIC), 'core,halo,wash')
  assert.equal(trenchParts(BONKEI), 'rim')
  // a hand-made theme from before the light (no edge.glow) is reported as unlit, not an error
  const { glow: _, ...old } = BONKEI.edge
  assert.equal(trenchParts({ ...BONKEI, edge: old } as never), 'rim')
})

test('a diagram sets its own rim and the parts of its light, and the diagram\'s values win over the theme\'s', () => {
  const r = withVariables(BONKEI, { 'edge.rim': '#3fd0c0', 'edge.rimWidth': 1.5, 'edge.glow.core': '#ffffff', 'edge.glow.haloWidth': 5 })
  assert.deepEqual(r.problems, [])
  assert.equal(r.theme.edge.rim, '#3fd0c0'); assert.equal(r.theme.edge.rimWidth, 1.5)
  assert.equal(r.theme.edge.glow.core, '#ffffff'); assert.equal(r.theme.edge.glow.haloWidth, 5)
  // a Classic diagram can put a rim back
  assert.equal(withVariables(CLASSIC, { 'edge.rim': '#e0e0e0' }).theme.edge.rim, '#e0e0e0')
  assert.equal(BONKEI.edge.rim, '#2A2622') // the preset is untouched
})

test('each part of the trench light can be turned off: null for the core, halo or wash, edge.glow: off for all three, edge.rim: none for the rim', () => {
  const one = withVariables(CLASSIC, { 'edge.glow.wash': null })
  assert.deepEqual(one.problems, [])
  assert.equal(one.theme.edge.glow.wash, null); assert.equal(one.theme.edge.glow.core, '#e0e0e0')
  assert.equal(trenchParts(one.theme), 'core,halo')
  // light only: the light from the floor, no wash, no rim
  const floorOnly = withVariables(BONKEI, { 'edge.glow.core': '#ffc873', 'edge.glow.halo': '#ffc873', 'edge.rim': 'none' })
  assert.deepEqual(floorOnly.problems, [])
  assert.equal(trenchParts(floorOnly.theme), 'core,halo')
  for (const off of ['off', false]) {
    const all = withVariables(CLASSIC, { 'edge.glow': off })
    assert.deepEqual(all.problems, [])
    assert.deepEqual([all.theme.edge.glow.core, all.theme.edge.glow.halo, all.theme.edge.glow.wash], [null, null, null])
    assert.equal(all.theme.edge.glow.coreWidth, 2.1) // only the colours go; the sizes stay for a later colour
  }
  assert.equal(trenchParts(withVariables(BONKEI, { 'edge.rim': 'none' }).theme), 'off')
  assert.deepEqual(CLASSIC.edge.glow.core, '#e0e0e0') // the preset is untouched
})

test('other values for the trench light are validated: a bad one is skipped and reported', () => {
  const bad = withVariables(BONKEI, { 'edge.glow': 'dim', 'edge.glow.core': 3, 'edge.glow.coreWidth': null, 'edge.glow.haloOpacity': -1, 'edge.rim': 5, 'edge.glow.spark': '#fff', 'edge.glow.wash': true })
  assert.deepEqual(bad.problems.map(p => p.key), ['edge.glow', 'edge.glow.core', 'edge.glow.coreWidth', 'edge.glow.haloOpacity', 'edge.rim', 'edge.glow.spark', 'edge.glow.wash'])
  assert.match(bad.problems[0].message, /group of tokens; turn it off with off/)
  assert.match(bad.problems[1].message, /must be a string or null/)
  assert.match(bad.problems[5].message, /unknown theme variable/)
  assert.deepEqual(bad.theme.edge.glow, BONKEI.edge.glow)
  assert.equal(bad.theme.edge.rim, '#2A2622')
  // `off` is a word for edge.glow only: another group still says it is a group
  assert.match(withVariables(BONKEI, { 'edge': 'off' }).problems[0].message, /^edge is a group of tokens; set one/)
})

test('edge.rim: null is a dark shade of the surface, in every theme (Classic\'s own rim is none)', () => {
  for (const t of [CLASSIC, BONKEI, BONKEI_LANDSCAPE]) {
    const r = withVariables(t, { 'edge.rim': null })
    assert.deepEqual(r.problems, [])
    assert.equal(r.theme.edge.rim, null)
    assert.equal(trenchParts(r.theme), t === CLASSIC ? 'core,halo,wash,rim' : 'rim')
  }
})

test('sequence tokens: every preset but Cloud Cartography keeps its sequence look exactly (text at its usual size, plain block titles)', async () => {
  const { CLOUD_CARTOGRAPHY, PRESETS, themeFonts } = await import('./theme.ts')
  const SEQ = {
    classic: { lifeline: '#5c6b8a', activation: '#f2c14e', note: '#e9d98a', noteText: '#2a2a1a', blockText: '#e8edf7', blockSub: '#cfd8ea', cross: '#ff6b6b', crossLine: '#ff9b9b', textScale: 1, blockTitles: 'plain' },
    bonkei: { lifeline: '#8a7f6c', activation: '#C9A24A', note: '#f6efdd', noteText: '#2A2622', blockText: '#2A2622', blockSub: '#4a4238', cross: '#C8452C', crossLine: '#C8452C', textScale: 1, blockTitles: 'plain' },
    'bonkei-landscape': { lifeline: '#8a7f6c', activation: '#C9A24A', note: '#f6efdd', noteText: '#2A2622', blockText: '#2A2622', blockSub: '#4a4238', cross: '#C8452C', crossLine: '#C8452C', textScale: 1, blockTitles: 'plain' },
    blueprint: { lifeline: '#8fb6e0', activation: '#2e6db0', note: '#22599a', noteText: '#eef6ff', blockText: '#eef6ff', blockSub: '#bcdcff', cross: '#ffd479', crossLine: '#ffd479', textScale: 1, blockTitles: 'plain' },
  }
  for (const [name, seq] of Object.entries(SEQ)) assert.deepEqual(PRESETS[name].seq, seq, name)
  // Cloud Cartography: text about 1.4 times larger, block titles in its zone lettering
  assert.equal(CLOUD_CARTOGRAPHY.seq.textScale, 1.4)
  assert.equal(CLOUD_CARTOGRAPHY.seq.blockTitles, 'ground')
  assert.equal(CLOUD_CARTOGRAPHY.tray.groundFont, 'archivo')
  // a theme whose block titles alone are in ground lettering still names the ground font for the missing-font warning
  assert.deepEqual(themeFonts(withVariables(BONKEI, { 'seq.blockTitles': 'ground', 'tray.groundFont': 'archivo' }).theme), ['mincho', 'archivo'])
  assert.deepEqual(themeFonts(BONKEI), ['mincho'])
})

test('the sequence tokens are checked like the others: a word not known, a wrong type or a negative scale is skipped and reported', () => {
  const ok = withVariables(CLASSIC, { 'seq.textScale': 1.2, 'seq.blockTitles': 'ground' })
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.theme.seq.textScale, 1.2); assert.equal(ok.theme.seq.blockTitles, 'ground')
  const bad = withVariables(CLASSIC, { 'seq.textScale': -1, 'seq.blockTitles': 'bold', 'seq.textScale ': 2, 'seq.blockTitles.x': 'ground' })
  assert.deepEqual(bad.problems.map(p => p.key), ['seq.textScale', 'seq.blockTitles', 'seq.textScale ', 'seq.blockTitles.x'])
  assert.match(bad.problems[0].message, /0 or more/)
  assert.match(bad.problems[1].message, /one of plain, ground/)
  assert.equal(withVariables(CLASSIC, { 'seq.textScale': '2' }).problems[0].message, 'seq.textScale must be a number; got "2"')
  assert.deepEqual(bad.theme.seq, CLASSIC.seq)
})

test('a trench colour must be a colour: a word three.js does not know is reported, not drawn in white', () => {
  const words = ['off', 'None', 'NONE', 'banana', 'false', '', '#12', '#12345', 'rgb(1,2)']
  for (const w of words) {
    const r = withVariables(CLASSIC, { 'edge.rim': w })
    assert.equal(r.problems.length, 1, `edge.rim ${JSON.stringify(w)}`)
    assert.equal(r.problems[0].message, `edge.rim must be a colour, none or null; got ${JSON.stringify(w)}`)
    assert.equal(r.theme.edge.rim, 'none') // skipped: Classic keeps its own
    for (const k of ['edge.glow.core', 'edge.glow.halo', 'edge.glow.wash']) {
      const g = withVariables(CLASSIC, { [k]: w })
      assert.equal(g.problems[0]?.message, `${k} must be a colour or null; got ${JSON.stringify(w)}`)
      assert.deepEqual(g.theme.edge.glow, CLASSIC.edge.glow)
    }
  }
  // none is a word for the rim only: the light's parts are left out with null
  assert.equal(withVariables(CLASSIC, { 'edge.glow.core': 'none' }).problems[0].message, 'edge.glow.core must be a colour or null; got "none"')
  // every way three.js reads a colour is taken, for the rim and each part of the light
  const colours = ['#fff', '#E0E0E0', 'rgb(255, 200, 115)', 'rgba(255,200,115,0.5)', 'rgb(100%, 50%, 0%)', 'hsl(40, 100%, 70%)', 'hsla(40,100%,70%,1)', 'white', 'Gold', 'rebeccapurple']
  for (const c of colours) {
    const r = withVariables(BONKEI, { 'edge.rim': c, 'edge.glow.core': c, 'edge.glow.halo': c, 'edge.glow.wash': c })
    assert.deepEqual(r.problems, [], c)
    assert.equal(r.theme.edge.rim, c); assert.equal(r.theme.edge.glow.wash, c)
  }
  assert.deepEqual(withVariables(BONKEI, { 'edge.rim': 'none' }).problems, [])
})

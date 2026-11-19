// The trench light controls' rules (trench.ts): each setting writes themeVariables that bonkei's theme accepts and that draw what
// the control says. Laid over the real presets with bonkei's own withVariables (packages/core), so a renamed token fails here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PRESETS, trenchParts, withVariables } from '../../../packages/core/src/theme.ts'
import { TRENCH_THEMES, own, preset, trenchSource, trenchVariables, type TrenchState, type TrenchTheme } from './trench.ts'

const draw = (t: TrenchTheme, s: TrenchState) => {
  const r = withVariables(PRESETS[t], Object.fromEntries(trenchVariables(t, s)))
  assert.deepEqual(r.problems, [], `${t} ${JSON.stringify(s)}`)
  return r.theme
}

test("each theme's default writes no themeVariables, and the controls start from what the theme draws", () => {
  for (const t of TRENCH_THEMES) {
    assert.deepEqual(trenchVariables(t, own(t)), [])
    assert.doesNotMatch(trenchSource(t, own(t)), /themeVariables/)
    assert.equal(trenchParts(draw(t, own(t))), trenchParts(PRESETS[t]))
  }
  assert.deepEqual(own('classic'), { floor: true, wash: true, rim: false, colour: null, strength: 30 })
  assert.deepEqual(own('bonkei'), { floor: false, wash: false, rim: true, colour: null, strength: 50 })
})

test('Light only leaves only the floor light: no wall wash and no rim, in every theme', () => {
  for (const t of TRENCH_THEMES) {
    const s = preset(t, 'light-only', own(t))
    const th = draw(t, s)
    assert.equal(trenchParts(th), 'core,halo', t)
    assert.equal(th.edge.rim, 'none')
  }
})

test('All off is no light and no rim; switching one part off writes null for it', () => {
  for (const t of TRENCH_THEMES) {
    assert.deepEqual(trenchVariables(t, preset(t, 'off', own(t))), [['edge.glow', 'off'], ['edge.rim', 'none']])
    assert.equal(trenchParts(draw(t, preset(t, 'off', own(t)))), 'off')
  }
  assert.equal(trenchParts(draw('classic', { ...own('classic'), wash: false })), 'core,halo')
  assert.equal(trenchParts(draw('classic', { ...own('classic'), floor: false })), 'wash')
})

test('colour and strength reach the light: 50% is the standard sizes, 100% twice them; Classic at 30% is its own light', () => {
  const c = draw('classic', { ...own('classic'), colour: '#ff8a00', strength: 100 }).edge.glow
  assert.deepEqual(c, { core: '#ff8a00', coreWidth: 7, halo: '#ff8a00', haloWidth: 22, haloOpacity: 0.56, wash: '#ff8a00', washIntensity: 0.6 })
  // the numbers Classic's own 30% writes are its preset's
  assert.deepEqual(draw('classic', { ...own('classic'), colour: '#e0e0e0' }).edge.glow, PRESETS.classic.edge.glow)
  // a Bonkei diagram turning its light on gets the warm light
  assert.equal(draw('bonkei', { ...own('bonkei'), floor: true, wash: true }).edge.glow.core, '#ffc873')
})

test("a rim switched on: Bonkei keeps its own dark rim unless a colour is picked; Classic's takes the light's colour", () => {
  assert.equal(draw('bonkei', { ...own('bonkei'), floor: true }).edge.rim, '#2A2622')
  assert.equal(draw('bonkei', { ...own('bonkei'), colour: '#3fd0c0' }).edge.rim, '#3fd0c0')
  assert.equal(draw('classic', { ...own('classic'), rim: true }).edge.rim, '#e0e0e0')
})

test('the source is a tunnel diagram whose frontmatter carries the variables as YAML', () => {
  const src = trenchSource('classic', preset('classic', 'light-only', own('classic')))
  assert.match(src, /crossings: tunnel/)
  assert.match(src, /    edge\.glow\.core: "#e0e0e0"\n/)
  assert.match(src, /    edge\.glow\.wash: null\n/)
  assert.match(src, /    edge\.rim: none\n/)
})

test("Edge styles' Markdown stands for the demo (BON-197): under the trench light heading, the source Light only on Classic writes, word for word", () => {
  // the page's .md (llms.txt, llms-full.txt, Copy page) drops <TrenchLight />; this fence is what a reader or an agent gets in its place
  const md = fs.readFileSync(new URL('../../guide/edge-styles.md', import.meta.url), 'utf8')
  const after = md.slice(md.indexOf('\n### The trench light\n'))
  assert.ok(md.includes('\n### The trench light\n'), 'the heading the demo is marked with (data-bonkei-demo in TrenchLight.vue)')
  assert.match(fs.readFileSync(new URL('./TrenchLight.vue', import.meta.url), 'utf8'), /data-bonkei-demo="The trench light"/)
  const fence = /<TrenchLight \/>[\s\S]*?\n```yaml\n([\s\S]*?)\n```\n/.exec(after)
  assert.ok(fence, 'a yaml fence after <TrenchLight />')
  assert.equal(fence[1], trenchSource('classic', preset('classic', 'light-only', own('classic'))))
})

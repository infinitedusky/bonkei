import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadStage, normaliseName } from './stage.ts'

const file = (name: string) => readFileSync(new URL(`./fixtures/stages/${name}`, import.meta.url))
const serve = (status = 200, type = 'model/gltf-binary'): typeof fetch => async (url: any) => {
  const name = String(url).split('/').pop()!
  let body: Buffer
  try { body = file(name) } catch { return new Response('<html>', { status: 404, headers: { 'content-type': 'text/html' } }) }
  return new Response(new Uint8Array(body), { status, headers: { 'content-type': type } })
}
const labels = async (name: string) => (await loadStage(`/stages/${name}`, undefined, serve())).layout.parts.map(p => p.label)
const stageError = (name: string, f = serve()) => loadStage(`/stages/${name}`, undefined, f).then(() => assert.fail('should reject'), (e: any) => e)

test('normaliser: case, spaces, underscores and dashes are the same; the ends do not count', () => {
  for (const s of ['Prep Line', 'prep_line', 'PREP-LINE', '  prep  line ', 'prep _ line']) assert.equal(normaliseName(s), 'prep line')
  assert.notEqual(normaliseName('prepline'), 'prep line')
})

test('the kitchen: four top-level named parts, labelled as written, pieces and the unnamed fridge not parts', async () => {
  assert.deepEqual(await labels('kitchen.glb'), ['grill', 'prep line', 'wrap station', 'register'])
  const k = (await loadStage('/stages/kitchen.glb', undefined, serve())).layout
  assert.equal(k.parts.find(p => p.label === 'grill')!.pieces, 6)
  assert.ok(k.width > 0 && k.height > 0)
})

test('the house: five parts; walls and road are not', async () => {
  assert.deepEqual(await labels('house.glb'), ['phone', 'router', 'telephone pole', 'exchange', 'server'])
})

test('a lone wrapper node is looked through', async () => {
  assert.deepEqual(await labels('wrapped.glb'), ['phone', 'router', 'telephone pole', 'exchange', 'server'])
})

test('two parts with one name: both kept, one warning', async () => {
  const r = await loadStage('/stages/duplicate.glb', undefined, serve())
  assert.deepEqual(r.layout.parts.map(p => p.label), ['grill', 'Grill', 'register'])
  assert.equal(r.warnings.length, 1)
  assert.equal(r.warnings[0].kind, 'stage')
})

test('no named top-level parts, a missing file, a page instead of a file, a text file, compression, no network: each one stage error', async () => {
  assert.match((await stageError('blob.glb')).message, /none of its top-level objects has a name/)
  assert.match((await stageError('nope.glb')).message, /wasn't found \(404\)/)
  assert.match((await stageError('nope.glb', serve(200, 'text/html'))).message, /wasn't found/)
  assert.match((await stageError('not-a-model.glb')).message, /isn't a glTF/)
  assert.match((await stageError('kitchen-draco.glb')).message, /KHR_draco_mesh_compression/)
  assert.match((await stageError('kitchen-ktx2.glb')).message, /KHR_texture_basisu/)
  const down = async () => { throw new TypeError('Failed to fetch') }
  const e = await stageError('kitchen.glb', down as any)
  assert.equal(e.kind, 'stage'); assert.match(e.message, /CORS/)
})

import { readFrontmatter } from './options.ts'
import { prepare } from './diagram.ts'

test('config.bonkei.stage is read from the frontmatter; a bad value is a warning', () => {
  assert.equal(readFrontmatter('---\nconfig:\n  bonkei:\n    stage: kitchen.glb\n---\n').options.stage, 'kitchen.glb')
  const bad = readFrontmatter('---\nconfig:\n  bonkei:\n    stage: 3\n---\n')
  assert.equal(bad.options.stage, undefined)
  assert.match(bad.warnings[0].message, /config\.bonkei\.stage must be/)
})

test('a stage that cannot be fetched rejects prepare with one stage error naming the frontmatter line', async () => {
  const e: any = await prepare('---\nconfig:\n  bonkei:\n    stage: nowhere.glb\n---\n').then(() => assert.fail('should reject'), x => x)
  assert.equal(e.kind, 'stage')
  assert.equal(e.line, 4)
})

test('labels accepts base, sign and diamond beside top and billboard', () => {
  for (const l of ['top', 'billboard', 'base', 'sign', 'diamond']) assert.equal(readFrontmatter(`---\nconfig:\n  bonkei:\n    labels: ${l}\n---\n`).options.labels, l)
  assert.match(readFrontmatter('---\nconfig:\n  bonkei:\n    labels: arrow\n---\n').warnings[0].message, /labels must be one of/)
})

import { FLOOR_SIZE, framed } from './stageZones.ts'

// how each part is named in `auto`: on its floor, on its sides, or floating
const how = (l: Awaited<ReturnType<typeof loadStage>>['layout'], mode: 'auto' | 'zone' = 'auto') => {
  const g = framed(l, mode)
  return Object.fromEntries(l.parts.map((p, i) => [p.label, g.zones![i]?.title ? 'floor' : g.sides![i] ? 'side' : 'float']))
}

test('auto: `auto` writes a name on the part\'s sides if it fits, else floats, with no areas', async () => {
  const k = (await loadStage('/stages/kitchen.glb', undefined, serve())).layout, h = (await loadStage('/stages/house.glb', undefined, serve())).layout
  for (const l of [k, h]) for (const z of framed(l, 'auto').zones!) if (z?.title) assert.equal(z.title.size, FLOOR_SIZE)
  assert.deepEqual(how(k), { grill: 'side', 'prep line': 'side', 'wrap station': 'side', register: 'side' })
  assert.deepEqual(how(h), { phone: 'float', router: 'float', 'telephone pole': 'float', exchange: 'side', server: 'side' })
  for (const l of [k, h]) assert.ok(framed(l, 'auto').zones!.every(z => z === null), 'no areas in auto')
})

test('zones never overlap each other or another part, and the model\'s own floor is the one grown to hold them', async () => {
  for (const f of ['kitchen.glb', 'house.glb']) for (const mode of ['zone'] as const) { // (`zone`, the Cloud Cartography way, is the one with areas: where it has a clear place it overlaps nothing)
    const l = (await loadStage(`/stages/${f}`, undefined, serve())).layout
    const g = framed(l, mode), zs = g.zones!
    zs.forEach((z, i) => {
      if (!z) return
      if (!z.clear) return // (`zone` draws the least bad place for a part with none)
      zs.forEach((o, k) => { if (o && k !== i) assert.ok(z.x1 <= o.x0 + 1e-6 || o.x1 <= z.x0 + 1e-6 || z.z1 <= o.z0 + 1e-6 || o.z1 <= z.z0 + 1e-6, `${f} ${mode}: zones ${i} and ${k} apart`) })
      l.parts.forEach((p, k) => { if (k !== i) assert.ok(z.x1 <= p.cx - p.w / 80 + 1e-6 || p.cx + p.w / 80 <= z.x0 + 1e-6 || z.z1 <= p.cz - p.h / 80 + 1e-6 || p.cz + p.h / 80 <= z.z0 + 1e-6, `${f} ${mode}: zone ${i} clear of part ${k}`) })
    })
    assert.ok(g.floor, 'both samples bring a floor of their own, so none is added')
    assert.equal(g.base, null)
    if (g.floorTo) for (const z of zs) if (z) assert.ok(z.x0 >= g.floorTo.x0 - 1e-6 && z.x1 <= g.floorTo.x1 + 1e-6 && z.z0 >= g.floorTo.z0 - 1e-6 && z.z1 <= g.floorTo.z1 + 1e-6)
  }
})

test('where a zone runs past the model\'s own floor, that floor is the one grown (same mesh), and fit frames it', async () => {
  const l = (await loadStage('/stages/kitchen.glb', undefined, serve())).layout
  // a floor a little smaller than the kitchen's: the zones reach past it
  const f = l.floor!.rect, small = { x0: f.x0 + 1.5, x1: f.x1 - 1.5, z0: f.z0 + 1.2, z1: f.z1 - 1.2 }
  const g = framed({ ...l, floor: { ...l.floor!, rect: small } }, 'zone')
  assert.ok(g.floorTo && g.floorTo.x0 <= small.x0 && g.floorTo.x1 >= small.x1 && g.base === null)
  for (const z of g.zones!) if (z) assert.ok(z.x0 >= g.floorTo!.x0 - 1e-6 && z.x1 <= g.floorTo!.x1 + 1e-6 && z.z0 >= g.floorTo!.z0 - 1e-6 && z.z1 <= g.floorTo!.z1 + 1e-6)
  // a model with no floor of its own gets one in the theme's style (base) only when a zone runs past it
  const none = framed({ ...l, floor: null }, 'zone')
  assert.equal(none.floorTo, null)
})

test('the model\'s own floor keeps an even padding round everything on it: a part hanging off its edge makes the floor grow, never shrink', async () => {
  const l = (await loadStage('/stages/kitchen.glb', undefined, serve())).layout
  const g = framed(l, 'auto')
  assert.ok(g.floorTo, 'the sample\'s grill overhangs the floor, so the floor is grown')
  const f = g.floorTo!, o = l.floor!.rect
  assert.ok(f.x0 <= o.x0 && f.x1 >= o.x1 && f.z0 <= o.z0 && f.z1 >= o.z1, 'never smaller')
  for (const p of l.parts) assert.ok(p.cx - p.w / 80 >= f.x0 + 0.6 - 1e-6 && p.cx + p.w / 80 <= f.x1 - 0.6 + 1e-6 && p.cz - p.h / 80 >= f.z0 + 0.6 - 1e-6 && p.cz + p.h / 80 <= f.z1 - 0.6 + 1e-6, `${p.label} has the padding`)
  // a floor that already has the padding is left as it is
  const roomy = { x0: -50, x1: 50, z0: -50, z1: 50 }
  assert.equal(framed({ ...l, floor: { ...l.floor!, rect: roomy } }, 'auto').floorTo, null)
})

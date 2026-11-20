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
  assert.equal(k.parts.find(p => p.label === 'grill')!.pieces, 5)
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

import { zoneOf, framed } from './stageZones.ts'

test('auto: a part whose name cannot read on its zone floor is small and floats; the others get a zone', async () => {
  const small = async (f: string) => { const l = (await loadStage(`/stages/${f}`, undefined, serve())).layout; return l.parts.filter(p => zoneOf(p, l.blockers).small).map(p => p.label) }
  assert.deepEqual(await small('house.glb'), ['phone', 'router', 'telephone pole'])
  assert.deepEqual(await small('kitchen.glb'), ['wrap station'])
})

test('every zone lies wholly on the floor: where it runs past the model a base is grown to hold it, centred, with an even margin; none when nothing runs past', async () => {
  const l = (await loadStage('/stages/kitchen.glb', undefined, serve())).layout
  const sign = framed(l, 'sign'), zone = framed(l, 'zone')
  assert.equal(sign.base, null)
  assert.ok(zone.base && zone.width > l.width && zone.height > l.height)
  for (const p of l.parts) {
    const z = zoneOf(p, l.blockers)
    assert.ok(z.x0 >= zone.base!.x0 && z.x1 <= zone.base!.x1 && z.z0 >= zone.base!.z0 && z.z1 <= zone.base!.z1, `${p.label} inside the base`)
  }
  assert.ok(Math.abs((zone.base!.x0 + zone.ox!) + (zone.base!.x1 + zone.ox!)) < 1e-6) // centred on the origin
})

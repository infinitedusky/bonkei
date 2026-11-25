import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { loadStage, framed, type StageModel } from './stage.ts'
import { normaliseName } from './names.ts'
import { S } from './scale.ts'
import { FLOOR_PAD, SIDE, floatColumn, footprint } from './stageZones.ts'
import { readFrontmatter } from './options.ts'
import { prepare, isBonkeiError } from './diagram.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))

// the sample models (apps/playground/scripts/make-stages.mjs), served as a web server would: a missing file is a 404 page
const file = (name: string) => readFileSync(new URL(`./fixtures/stages/${name}`, import.meta.url))
const serve = (status = 200, type = 'model/gltf-binary'): typeof fetch => async (url: any) => {
  const name = String(url).split('/').pop()!
  let body: Buffer
  try { body = file(name) } catch { return new Response('<html>', { status: 404, headers: { 'content-type': 'text/html' } }) }
  return new Response(new Uint8Array(body), { status, headers: { 'content-type': type } })
}
const load = async (name: string) => (await loadStage(`/stages/${name}`, undefined, serve())).layout
const labels = async (name: string) => (await load(name)).parts.map(p => p.label)
const stageError = (name: string, f = serve()) => loadStage(`/stages/${name}`, undefined, f).then(() => assert.fail('should reject'), (e: any) => e)

test('normaliser: case, spaces, underscores and dashes are the same; the ends do not count', () => {
  for (const s of ['Prep Line', 'prep_line', 'PREP-LINE', '  prep  line ', 'prep _ line', '_prep line_']) assert.equal(normaliseName(s), 'prep line')
  assert.notEqual(normaliseName('prepline'), 'prep line')
  assert.equal(normaliseName(''), '')
})

test('the kitchen: four top-level named parts, labelled as the author wrote them; the pieces and the unnamed fridge are not parts', async () => {
  assert.deepEqual(await labels('kitchen.glb'), ['grill', 'prep line', 'wrap station', 'register'])
  const k = await load('kitchen.glb')
  assert.equal(k.parts.find(p => p.label === 'grill')!.pieces, 6)
  assert.ok(k.width > 0 && k.height > 0)
})

test('the house: five parts; its walls and the road are not', async () => {
  assert.deepEqual(await labels('house.glb'), ['phone', 'router', 'telephone pole', 'exchange', 'server'])
})

test('a lone wrapper node is looked through', async () => {
  assert.deepEqual(await labels('wrapped.glb'), ['phone', 'router', 'telephone pole', 'exchange', 'server'])
})

test('two parts named alike: both kept, one warning naming both', async () => {
  const r = await loadStage('/stages/duplicate.glb', undefined, serve())
  assert.deepEqual(r.layout.parts.map(p => p.label), ['grill', 'Grill', 'register'])
  assert.equal(r.warnings.length, 1)
  assert.equal(r.warnings[0].kind, 'stage')
  assert.match(r.warnings[0].message, /"grill", "Grill"/)
})

test('no named parts, a missing file, a page instead of a file, a server error, a text file, compression, no network: each one readable stage error', async () => {
  const cases: [Promise<any>, RegExp][] = [
    [stageError('blob.glb'), /none of its top-level objects has a name/],
    [stageError('nope.glb'), /wasn't found \(404\)/],
    [stageError('kitchen.glb', serve(200, 'text/html')), /wasn't found \(the server sent a web page\)/],
    [stageError('kitchen.glb', serve(500)), /HTTP 500/],
    [stageError('not-a-model.glb'), /isn't a glTF/],
    [stageError('kitchen-draco.glb'), /KHR_draco_mesh_compression/],
    [stageError('kitchen-ktx2.glb'), /KHR_texture_basisu/],
    [stageError('kitchen.glb', (async () => { throw new TypeError('Failed to fetch') }) as any), /CORS/],
  ]
  for (const [p, re] of cases) {
    const e = await p
    assert.ok(isBonkeiError(e), 'a BonkeiError')
    assert.equal(e.kind, 'stage')
    assert.match(e.message, re)
    assert.equal('reason' in e, false, 'the telemetry reason stays inside')
  }
})

test('telemetry: bonkei.stage.load says how it went, and a failure records a reason word, never the address', async () => {
  exporter.reset()
  await load('kitchen.glb')
  await stageError('private-plans.glb')
  const spans = exporter.getFinishedSpans().filter(s => s.name === 'bonkei.stage.load')
  assert.equal(spans.length, 2)
  assert.equal(spans[0].attributes['bonkei.stage.parts'], 4)
  assert.equal(spans[0].attributes['bonkei.stage.pieces_skipped'], 11)
  assert.equal(spans[1].attributes['bonkei.stage.error'], 'not_found')
  assert.equal(spans[1].status.message, 'not_found')
  assert.ok(!JSON.stringify([spans[1].attributes, spans[1].status, spans[1].events]).includes('private-plans'))
})

test('config.bonkei.stage is read from the frontmatter; a bad value is a warning', () => {
  assert.equal(readFrontmatter('---\nconfig:\n  bonkei:\n    stage: kitchen.glb\n---\n').options.stage, 'kitchen.glb')
  for (const v of ['3', '""', '[a]']) {
    const bad = readFrontmatter(`---\nconfig:\n  bonkei:\n    stage: ${v}\n---\n`)
    assert.equal(bad.options.stage, undefined)
    assert.match(bad.warnings[0].message, /config\.bonkei\.stage must be/)
  }
})

test('prepare: a stage that cannot be fetched rejects with one stage error naming the frontmatter line; from the prop, no line', async () => {
  const e: any = await prepare('---\nconfig:\n  bonkei:\n    stage: nowhere.glb\n---\n').then(() => assert.fail('should reject'), x => x)
  assert.equal(e.kind, 'stage')
  assert.equal(e.line, 4)
  const p: any = await prepare('', { stage: 'nowhere.glb' }).then(() => assert.fail('should reject'), x => x)
  assert.equal(p.kind, 'stage')
  assert.equal(p.line, undefined)
})

// how each part is named: on its own sides, or floating
const how = (l: StageModel) => {
  const g = framed(l)
  return Object.fromEntries(l.parts.map((p, i) => [p.label, g.sides![i] ? 'side' : 'float']))
}

test('a name is written on the part\'s own sides at the one size if it fits, else floats; no areas', async () => {
  const k = await load('kitchen.glb'), h = await load('house.glb')
  assert.deepEqual(how(k), { grill: 'side', 'prep line': 'side', 'wrap station': 'side', register: 'side' })
  assert.deepEqual(how(h), { phone: 'float', router: 'float', 'telephone pole': 'float', exchange: 'side', server: 'side' })
  for (const l of [k, h]) {
    const g = framed(l)
    assert.equal('zones' in g, false, 'no area under any part')
    for (const s of g.sides!) if (s) assert.equal(s.size, SIDE.size, 'never drawn smaller')
  }
})

test('the grill\'s name is on its counter, not its hood', async () => {
  const k = await load('kitchen.glb'), g = framed(k)
  const grill = k.parts[0], s = g.sides![0]!
  assert.ok(grill.body.y1 < 1.5, 'the body is the counter, below the hood')
  for (const f of s.faces) assert.ok(f.at[1] > grill.body.y0 && f.at[1] < grill.body.y1, 'written on the counter\'s height')
})

// the floor as framed: grown, or as it was
const floorOf = (l: StageModel) => framed(l).floorTo ?? l.floor!.rect
const padded = (l: StageModel, f = floorOf(l)) => [...l.parts.map(footprint), ...(l.blockers ?? []).filter(b => b.part < 0)]
  .every(r => r.x0 >= f.x0 + FLOOR_PAD - 1e-6 && r.x1 <= f.x1 - FLOOR_PAD + 1e-6 && r.z0 >= f.z0 + FLOOR_PAD - 1e-6 && r.z1 <= f.z1 - FLOOR_PAD + 1e-6)

test('the model\'s own floor keeps an even padding round everything on it: the kitchen\'s grows where the grill hangs off it, never smaller', async () => {
  for (const f of ['kitchen.glb', 'house.glb']) {
    const l = await load(f)
    assert.ok(l.floor, `${f} brings a floor of its own`)
    assert.ok(padded(l), `${f}: everything on the floor has the padding`)
  }
  const k = await load('kitchen.glb'), g = framed(k)
  const was = k.floor!.rect, to = g.floorTo!
  assert.ok(to, 'the kitchen\'s floor is grown')
  assert.ok(footprint(k.parts[0]).x0 < was.x0, 'the sample\'s grill hangs off the left edge')
  assert.ok(to.x0 <= was.x0 && to.x1 >= was.x1 && to.z0 <= was.z0 && to.z1 >= was.z1, 'never smaller')
  assert.ok(Math.abs(footprint(k.parts[0]).x0 - FLOOR_PAD - to.x0) < 1e-6, 'the grill gets exactly the padding')
  assert.ok(Math.abs(g.width * S - (to.x1 - to.x0)) < 1e-6 && Math.abs(g.height * S - (to.z1 - to.z0)) < 1e-6, 'the fit frames the grown floor')
})

test('a floor that already has the padding is left as it is; a model with no floor gets none', async () => {
  const l = await load('kitchen.glb')
  const roomy = { x0: -50, x1: 50, z0: -50, z1: 50 }
  assert.equal(framed({ ...l, floor: { ...l.floor!, rect: roomy } }).floorTo, null)
  const bare = framed({ ...l, floor: null })
  assert.equal(bare.floorTo, null)
  assert.ok(Math.abs(bare.width - l.width) < 1e-6 && Math.abs(bare.height - l.height) < 1e-6, 'framed as the model')
})

test('a floating name\'s letters are 0.36, a little smaller for a long name so its column stays about 4 tall', () => {
  assert.equal(floatColumn('phone').size, 0.36)
  const pole = floatColumn('telephone pole')
  assert.ok(pole.size < 0.36)
  assert.ok(Math.abs([...'telephone pole'].length * pole.size - 4) < 1e-9, 'the column of letters is 4 tall')
})

test('the fit leaves room above the model for its floating names, at the size they are drawn', async () => {
  const h = await load('house.glb'), g = framed(h)
  const pole = h.parts.find(p => p.label === 'telephone pole')!, c = floatColumn(pole.label)
  assert.ok(g.reach! >= pole.top + c.foot + 4, 'the pole\'s floating name is counted, its letters all 4 of it')
  assert.ok(Math.abs(g.reach! - Math.max(h.tall, ...h.parts.map(p => p.top + floatColumn(p.label).foot + floatColumn(p.label).h))) < 1e-9, 'no more room than the tallest name takes')
  assert.ok(g.reach! >= h.tall)
})

test('a named empty node is a part where it stands: a point, its name floating over it', async () => {
  const l = await load('empty-part.glb')
  assert.deepEqual(l.parts.map(p => p.label), ['grill', 'door'])
  const door = l.parts[1]
  for (const v of [l.width, l.height, l.tall, door.cx, door.cz, door.top, ...Object.values(door.body)]) assert.ok(Number.isFinite(v), 'every number finite')
  assert.ok(Math.abs(door.cx - 3.5 - (l.parts[0].cx + 4.2)) < 1e-6 && door.w === 0 && door.h === 0, 'at its own place, no footprint')
  const g = framed(l)
  assert.ok([g.width, g.height, g.reach!, ...Object.values(g.floorTo ?? {})].every(Number.isFinite))
  assert.deepEqual(how(l), { grill: 'side', door: 'float' })
  assert.ok(!(l.blockers ?? []).some(b => b.part === 1), 'no shape stands in the way')
})

test('a model with named parts but no shape at all is a readable stage error', async () => {
  const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1] }], nodes: [{ name: 'door' }, { name: 'grill', translation: [2, 0, 0] }] })
  const e = await stageError('empties.gltf', (async () => new Response(json, { headers: { 'content-type': 'model/gltf+json' } })) as any)
  assert.ok(isBonkeiError(e))
  assert.equal(e.kind, 'stage')
  assert.match(e.message, /empties\.gltf loaded, but it has nothing to show: none of its objects has a shape/)
})

test('a model in millimetres is shown at its size in metres: laid out, named and floored as the kitchen is', async () => {
  const mm = await load('kitchen-mm.glb'), k = await load('kitchen.glb')
  assert.ok(Math.abs(mm.width - k.width) < 1e-6 && Math.abs(mm.height - k.height) < 1e-6 && Math.abs(mm.tall - k.tall) < 1e-6)
  assert.equal(mm.model.scale.x, 0.001)
  assert.deepEqual(how(mm), how(k))
  assert.equal(mm.blockers!.length, k.blockers!.length, 'its 50 mm floor is no blocker')
  assert.ok(mm.floor, 'and is found as its floor')
  const g = framed(mm), z = framed(k)
  assert.ok(Math.abs(g.width - z.width) < 1e-6 && Math.abs(g.reach! - z.reach!) < 1e-6)
})

test('a lone named part is a part, not a wrapper: the grill, not its pieces', async () => {
  const l = await load('lone-part.glb')
  assert.deepEqual(l.parts.map(p => p.label), ['grill'])
  assert.equal(l.parts[0].pieces, 6)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { loadStage, framed, type StageLayout } from './stage.ts'
import { normaliseName } from './names.ts'
import { FLOOR_SIZE, footprint } from './stageZones.ts'
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

// how each part is named: on its zone, on its sides, or floating
const how = (l: StageLayout) => {
  const g = framed(l)
  return Object.fromEntries(l.parts.map((p, i) => [p.label, g.zones![i]?.title ? 'zone' : g.sides![i] ? 'side' : 'float']))
}

test('a name goes on its zone at the one size if it fits, else on the part\'s own sides, else floats', async () => {
  const k = await load('kitchen.glb'), h = await load('house.glb')
  assert.deepEqual(how(k), { grill: 'side', 'prep line': 'zone', 'wrap station': 'side', register: 'zone' })
  assert.deepEqual(how(h), { phone: 'float', router: 'float', 'telephone pole': 'float', exchange: 'zone', server: 'zone' })
  for (const l of [k, h]) for (const z of framed(l).zones!) if (z?.title) assert.equal(z.title.size, FLOOR_SIZE, 'never drawn smaller')
})

test('every part has a zone; no zone overlaps another or another thing on the floor; all of them lie on the model\'s own floor', async () => {
  for (const f of ['kitchen.glb', 'house.glb']) {
    const l = await load(f)
    const g = framed(l), zs = g.zones!
    assert.ok(zs.every(z => z !== null), `${f}: every part has a zone`)
    const others = [...l.parts.map(footprint), ...(l.blockers ?? []).filter(b => b.part < 0)]
    const apart = (a: { x0: number; x1: number; z0: number; z1: number }, b: typeof a) => a.x1 <= b.x0 + 1e-6 || b.x1 <= a.x0 + 1e-6 || a.z1 <= b.z0 + 1e-6 || b.z1 <= a.z0 + 1e-6
    zs.forEach((z, i) => {
      zs.forEach((o, k) => { if (k !== i) assert.ok(apart(z!, o!), `${f}: zones ${i} and ${k} apart`) })
      others.forEach((o, k) => { if (k !== i) assert.ok(apart(z!, o), `${f}: zone ${i} clear of thing ${k}`) })
    })
    assert.ok(g.floor, 'both samples bring a floor of their own')
    assert.equal(g.base, null, 'so no other base is drawn')
    const floor = g.floorTo ?? l.floor!.rect
    for (const z of zs) assert.ok(z!.x0 >= floor.x0 - 1e-6 && z!.x1 <= floor.x1 + 1e-6 && z!.z0 >= floor.z0 - 1e-6 && z!.z1 <= floor.z1 + 1e-6, `${f}: zone on the floor`)
  }
})

test('the kitchen\'s own floor grows to hold its zones; the house\'s already does', async () => {
  const k = framed(await load('kitchen.glb')), h = framed(await load('house.glb'))
  assert.ok(k.floorTo, 'the kitchen\'s floor is grown')
  const was = k.floor!.rect, to = k.floorTo!
  assert.ok(to.x0 <= was.x0 && to.x1 >= was.x1 && to.z0 <= was.z0 && to.z1 >= was.z1, 'never smaller')
  assert.ok(to.z1 > was.z1, 'at the front, for the register')
  assert.equal(h.floorTo, null)
})

test('a model with no floor of its own gets a base only where a zone runs past the model; the fit frames it', async () => {
  const l = await load('kitchen.glb')
  const g = framed({ ...l, floor: null })
  assert.ok(g.base)
  for (const z of g.zones!) if (z) assert.ok(z.x0 >= g.base!.x0 - 1e-6 && z.x1 <= g.base!.x1 + 1e-6 && z.z0 >= g.base!.z0 - 1e-6 && z.z1 <= g.base!.z1 + 1e-6)
  assert.ok(g.width >= l.width && g.height >= l.height)
})

test('the fit leaves room above the model for its floating names', async () => {
  const h = await load('house.glb'), g = framed(h)
  const pole = h.parts.find(p => p.label === 'telephone pole')!
  assert.ok(g.reach! > pole.top + [...'telephone pole'].length * 0.36, 'the pole\'s floating name is counted')
  assert.ok(g.reach! >= h.tall)
})

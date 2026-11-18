// Bonkei as an installable package (BON-52): the peer range follows React Three Fiber's, OpenTelemetry needs no install,
// ELK is fetched on the first layout (not on import), and the wasm is looked for in a fixed order. The built output itself
// (exports map, chunks, the script-tag bundle, dist/fonts) is checked by scripts/dist.test.mjs after `pnpm build`.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { layout, elkLoaded, elkInfo, setElkImport } from './layout.ts'
import { findWasm, loadAvoid, wasmInfo } from './avoid.ts'
import { findFont, fontFileUrl, isFont, loadFont } from './fonts.ts'
import { parse } from './parser.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())
const spans = (name: string) => exporter.getFinishedSpans().filter(s => s.name === name)

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const require = createRequire(import.meta.url)
const fiber = JSON.parse(fs.readFileSync(require.resolve('@react-three/fiber/package.json'), 'utf8'))

test('the React peer range is exactly the one the installed React Three Fiber asks for', () => {
  assert.equal(pkg.peerDependencies.react, fiber.peerDependencies.react)
  assert.equal(pkg.peerDependencies['react-dom'], fiber.peerDependencies['react-dom'])
  assert.match(pkg.peerDependencies.react, /^>=19\b/, 'React 19 only')
})

test('the host supplies react, react-dom and three; OpenTelemetry comes with bonkei', () => {
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ['react', 'react-dom', 'three'])
  for (const p of ['react', 'react-dom', 'three']) assert.equal(pkg.dependencies[p], undefined, `${p} is not bundled as a dependency`)
  assert.ok(pkg.dependencies['@opentelemetry/api'], '@opentelemetry/api is a dependency, so a host installs nothing for it')
  assert.equal(pkg.peerDependenciesMeta, undefined)
})

test('the package points at the build, ships only dist and runs nothing on import', () => {
  assert.equal(pkg.exports['.'], './dist/index.js')
  assert.equal(pkg.exports['./internal'], './dist/internal.js')
  assert.deepEqual(pkg.files, ['dist'])
  assert.equal(pkg.sideEffects, false)
})

const SRC = 'flowchart TD\n  A --> B\n  B --> C'

test('ELK is not loaded on import; the first layout fetches it once, inside a bonkei.elk.load span', async () => {
  assert.equal(elkLoaded(), false)
  await layout(parse(SRC))
  assert.equal(elkLoaded(), true)
  assert.ok(elkInfo.ms > 0)
  assert.equal(spans('bonkei.elk.load').length, 1)
  const wasm = spans('bonkei.wasm.load')
  assert.equal(wasm.length, 1)
  assert.equal(wasm[0].attributes['bonkei.wasm_source'], 'url')
  assert.equal(wasm[0].parentSpanContext?.spanId, spans('bonkei.route')[0].spanContext().spanId, 'under bonkei.route')
  await layout(parse(SRC))
  assert.equal(spans('bonkei.elk.load').length, 1, 'fetched once')
  const route = spans('bonkei.route').at(-1)!
  assert.equal(typeof route.attributes['bonkei.elk_load_ms'], 'number')
})

test('a failed ELK fetch rejects the layout, marks bonkei.elk.load as an error, and the next layout tries again', async () => {
  const prev = setElkImport(() => Promise.reject(new Error('chunk fetch failed')))
  await assert.rejects(layout(parse(SRC)), /chunk fetch failed/)
  const failed = spans('bonkei.elk.load')
  assert.equal(failed.length, 1)
  assert.equal(failed[0].status.code, SpanStatusCode.ERROR)
  assert.equal(failed[0].status.message, 'chunk fetch failed')
  setElkImport(prev)
  const out = await layout(parse(SRC))
  assert.equal(out.boxes.length, 3)
})

// findWasm: a fake loader that knows which URLs exist
const loader = (ok: (u?: string) => boolean) => {
  const tried: (string | undefined)[] = []
  return { tried, load: async (u?: string) => { tried.push(u?.slice(0, 30)); if (!ok(u)) throw new Error(`404 ${u}`) } }
}

test('wasm: the file beside the module is used when it is there, and the inline chunk is not fetched', async () => {
  const l = loader(u => u === 'http://x/libavoid.wasm')
  let inlineFetched = false
  assert.equal(await findWasm(l.load, { url: 'http://x/libavoid.wasm' }, async () => { inlineFetched = true; return 'AA==' }), 'url')
  assert.equal(inlineFetched, false)
})

test('wasm: when the file is missing (Vite 5 dev), the same bytes come from the lazy base64 chunk', async () => {
  const l = loader(u => !!u?.startsWith('data:application/wasm;base64,'))
  const heard: unknown[] = []
  assert.equal(await findWasm(l.load, { url: 'http://x/.vite/deps/libavoid.wasm' }, async () => 'AA==', e => heard.push(e)), 'inline')
  assert.deepEqual(l.tried, ['http://x/.vite/deps/libavoid.w', 'data:application/wasm;base64,A'])
  assert.equal(heard.length, 1)
})

test('wasm: with no inline chunk (script tag, or src), the first error is the one thrown', async () => {
  const l = loader(() => false)
  await assert.rejects(findWasm(l.load, { url: 'http://x/libavoid.wasm' }, async () => null), /404 http:\/\/x\/libavoid.wasm/)
  await assert.rejects(findWasm(l.load, { url: 'http://x/libavoid.wasm' }, () => Promise.reject(new Error('no module'))), /404 http:\/\/x\/libavoid.wasm/)
})

test('wasm: a URL from setAvoidWasm is the only one tried', async () => {
  const l = loader(() => false)
  await assert.rejects(findWasm(l.load, { set: 'http://cdn/a.wasm', url: 'http://x/libavoid.wasm' }, async () => 'AA=='), /404 http:\/\/cdn/)
  assert.deepEqual(l.tried, ['http://cdn/a.wasm'])
  assert.equal(await findWasm(loader(() => true).load, { set: 'http://cdn/a.wasm' }, async () => null), 'set')
})

test('the wasm is loaded once: a later loadAvoid() makes no new bonkei.wasm.load span', async () => {
  // the first ELK test above checked the span itself (source, parent)
  assert.equal(wasmInfo.source, 'url') // Node: libavoid-js reads the file beside its own module
  await loadAvoid()
  assert.equal(spans('bonkei.wasm.load').length, 0)
})

// fonts.ts: found like the wasm, but a missing font means drei's default font, never a label that does not draw
const ttf = fs.readFileSync(new URL('./fonts/ZenOldMincho-Bold-latin.ttf', import.meta.url))
test('font: the URL is the file beside the module, made only when asked for; an unknown name has none', () => {
  assert.equal(fontFileUrl('mincho'), new URL('./fonts/ZenOldMincho-Bold-latin.ttf', import.meta.url).href)
  assert.equal(fontFileUrl('comic'), undefined)
  assert.ok(isFont(ttf))
  assert.ok(!isFont(new TextEncoder().encode('<!doctype html>')))
})

test('font: the file when it is a font; else no URL (the default font) and why, never a rejection', async () => {
  const ok = await findFont('mincho', 'http://x/fonts/a.ttf', async () => new Uint8Array(ttf))
  assert.ok(ok.url && !ok.problem)
  const missing = await findFont('mincho', 'http://x/.vite/deps/fonts/a.ttf', async () => { throw new Error('404 Not Found') })
  assert.equal(missing.url, undefined)
  assert.match(missing.problem!, /could not be loaded from http:\/\/x\/\.vite\/deps\/fonts\/a\.ttf \(404 Not Found\)/)
  const html = await findFont('mincho', 'http://x/fonts/a.ttf', async () => new TextEncoder().encode('<!doctype html>'))
  assert.match(html.problem!, /not a font file/)
  assert.match((await findFont('mincho', undefined, async () => new Uint8Array(ttf))).problem!, /no URL/)
})

test('font: loaded once, inside a bonkei.font.load span; a failure is a bonkei.font.fallback event', async () => {
  const real = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => { calls++; return new Response('nope', { status: 404, statusText: 'Not Found' }) }) as typeof fetch
  try {
    const a = await loadFont('mincho'), b = await loadFont('mincho')
    assert.equal(calls, 1)
    assert.equal(a, b)
    assert.equal(a.url, undefined)
    const [span] = spans('bonkei.font.load')
    assert.equal(span.attributes['bonkei.font'], 'mincho')
    assert.equal(span.attributes['bonkei.font.fallback'], true)
    assert.deepEqual(span.events.map(e => e.name), ['bonkei.font.fallback'])
  } finally { globalThis.fetch = real }
})

// The built package (BON-52), checked after `pnpm build`: run by `pnpm --filter bonkei test:dist` and by `pnpm check:package`.
// src/package.test.ts covers package.json and the loading logic; this file covers what tsdown wrote to dist/.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
const read = f => fs.readFileSync(new URL(f, dist), 'utf8')
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const esm = fs.readdirSync(dist).filter(f => f.endsWith('.js') && f !== 'bonkei.global.js')

test('every entry in the exports map has its file and its types', () => {
  for (const [key, target] of Object.entries(pkg.exports)) {
    assert.ok(fs.existsSync(new URL('../' + target, import.meta.url)), `${key} -> ${target}`)
    if (target.endsWith('.js')) assert.ok(fs.existsSync(new URL('../' + target.replace(/\.js$/, '.d.ts'), import.meta.url)), `types for ${key}`)
  }
})

test('importing bonkei and bonkei/internal runs nothing: no fetch, no ELK, no wasm', async () => {
  const real = globalThis.fetch
  const fetched = []
  globalThis.fetch = (...a) => { fetched.push(String(a[0])); return real(...a) }
  try {
    const m = await import(new URL('index.js', dist).href)
    // the four theme exports are BON-116's public API
    assert.deepEqual(Object.keys(m).sort(), ['BONKEI', 'BONKEI_LANDSCAPE', 'Bonkei', 'CLASSIC', 'THEME_NAMES', 'isBonkeiError', 'render'])
    const i = await import(new URL('internal.js', dist).href)
    assert.equal(i.avoidLoaded(), null, 'the wasm is not loaded on import')
  } finally { globalThis.fetch = real }
  assert.deepEqual(fetched, [])
})

test('ELK is only ever a dynamic import, so a host bundler puts it in a chunk of its own', () => {
  const all = esm.map(read).join('\n')
  assert.match(all, /import\("elkjs\/lib\/elk\.bundled\.js"\)/)
  assert.doesNotMatch(all, /from\s*"elkjs/, 'no static import of elkjs')
})

test('the wasm sits beside the modules as a real file, found by the pattern bundlers turn into an asset', () => {
  const st = fs.lstatSync(new URL('libavoid.wasm', dist))
  assert.ok(st.isFile() && !st.isSymbolicLink())
  assert.deepEqual([...fs.readFileSync(new URL('libavoid.wasm', dist)).subarray(0, 4)], [0, 0x61, 0x73, 0x6d], 'wasm magic')
  assert.ok(esm.some(f => read(f).includes('new URL("./libavoid.wasm", import.meta.url)')))
})

test('the bundled font sits in dist/fonts with its licence, found by the same pattern, and is not inlined', () => {
  const st = fs.lstatSync(new URL('fonts/ZenOldMincho-Bold-latin.ttf', dist))
  assert.ok(st.isFile() && !st.isSymbolicLink())
  assert.deepEqual([...fs.readFileSync(new URL('fonts/ZenOldMincho-Bold-latin.ttf', dist)).subarray(0, 4)], [0, 1, 0, 0], 'TrueType magic')
  assert.match(read('fonts/OFL-ZenOldMincho.txt'), /SIL Open Font License, Version 1\.1/)
  // the chunk holding the URL sits at dist/ itself, so ./fonts/ is dist/fonts/
  const withFont = esm.filter(f => read(f).includes('new URL("./fonts/ZenOldMincho-Bold-latin.ttf", import.meta.url)'))
  assert.ok(withFont.length && withFont.every(f => !f.includes('/')))
  const head = fs.readFileSync(new URL('fonts/ZenOldMincho-Bold-latin.ttf', dist)).subarray(0, 48).toString('base64')
  assert.ok(![...esm, 'bonkei.global.js'].some(f => read(f).includes(head)), 'the font is not inlined as base64')
})

test('the wasm fallback is a lazy chunk: only a dynamic import reaches it', () => {
  const inline = esm.find(f => f.startsWith('_libavoid-inline-'))
  assert.ok(inline, 'the base64 chunk exists')
  const others = esm.filter(f => f !== inline).map(read).join('\n')
  assert.match(others, new RegExp(`import\\("\\./${inline.replace('.', '\\.')}"\\)`))
  assert.doesNotMatch(others, new RegExp(`from\\s*"\\./${inline.replace('.', '\\.')}"`))
})

test('the script-tag bundle is one classic script that defines window.Bonkei.render, with React inside and no import', () => {
  const g = read('bonkei.global.js')
  assert.match(g, /^var Bonkei\s*=/m)
  assert.doesNotMatch(g, /import\.meta|\bimport\(/)
  assert.doesNotMatch(g, /\brequire\("react"\)/)
  const sandbox = { document: undefined }
  const Bonkei = new Function('globalThis', 'window', 'self', `${g}; return Bonkei`)(sandbox, sandbox, sandbox)
  assert.equal(typeof Bonkei.render, 'function')
  assert.equal(typeof Bonkei.isBonkeiError, 'function')
})

test('the script-tag bundle evaluates without throwing, as a page loads it (document.currentScript set)', () => {
  const g = read('bonkei.global.js')
  const document = { currentScript: { src: 'https://example.test/embed/bonkei.global.js' } }
  const sandbox = { document }
  let Bonkei
  assert.doesNotThrow(() => { Bonkei = new Function('globalThis', 'window', 'self', 'document', `${g}; return Bonkei`)(sandbox, sandbox, sandbox, document) })
  assert.equal(typeof Bonkei.render, 'function')
})

test('the tarball holds dist and nothing from src', () => {
  assert.deepEqual(pkg.files, ['dist'])
  assert.ok(!esm.some(f => f.endsWith('.ts') && !f.endsWith('.d.ts')))
})

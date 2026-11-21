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
    // the theme exports are BON-116's public API, with BLUEPRINT (BON-234) and CLOUD_CARTOGRAPHY (BON-235); normaliseName matches a stage's part names (BON-253)
    assert.deepEqual(Object.keys(m).sort(), ['BLUEPRINT', 'BONKEI', 'BONKEI_LANDSCAPE', 'Bonkei', 'CLASSIC', 'CLOUD_CARTOGRAPHY', 'THEME_NAMES', 'isBonkeiError', 'normaliseName', 'render'])
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

test('a stage\'s code and three\'s GLTFLoader are only ever dynamic imports, so a page without a stage fetches none of them (BON-253)', () => {
  const all = esm.map(read).join('\n')
  assert.match(all, /import\("three\/examples\/jsm\/loaders\/GLTFLoader\.js"\)/)
  assert.doesNotMatch(all, /from\s*"three\/examples\/jsm\/loaders\/GLTFLoader/, 'no static import of the loader')
  for (const chunk of ['stage', 'StageScene']) {
    assert.match(all, new RegExp(`import\\("\\./${chunk}-[\\w-]+\\.js"\\)`), `${chunk} is imported dynamically`)
    assert.doesNotMatch(all, new RegExp(`from\\s*"\\./${chunk}-`), `no static import of ${chunk}`)
  }
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

test('Blueprint\'s bundled font sits in dist/fonts with its licence, found by the same pattern', () => {
  const st = fs.lstatSync(new URL('fonts/ArchitectsDaughter-Regular-latin.ttf', dist))
  assert.ok(st.isFile() && !st.isSymbolicLink())
  assert.deepEqual([...fs.readFileSync(new URL('fonts/ArchitectsDaughter-Regular-latin.ttf', dist)).subarray(0, 4)], [0, 1, 0, 0], 'TrueType magic')
  assert.match(read('fonts/OFL-ArchitectsDaughter.txt'), /SIL Open Font License, Version 1\.1/)
  assert.ok(esm.some(f => read(f).includes('new URL("./fonts/ArchitectsDaughter-Regular-latin.ttf", import.meta.url)')))
})

test('Cloud Cartography\'s bundled font sits in dist/fonts with its licence, found by the same pattern', () => {
  const st = fs.lstatSync(new URL('fonts/ArchivoBlack-latin.ttf', dist))
  assert.ok(st.isFile() && !st.isSymbolicLink())
  assert.deepEqual([...fs.readFileSync(new URL('fonts/ArchivoBlack-latin.ttf', dist)).subarray(0, 4)], [0, 1, 0, 0], 'TrueType magic')
  assert.match(read('fonts/OFL-ArchivoBlack.txt'), /SIL Open Font License, Version 1\.1/)
  assert.ok(esm.some(f => read(f).includes('new URL("./fonts/ArchivoBlack-latin.ttf", import.meta.url)')))
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
  assert.equal(typeof Bonkei.run, 'function') // BON-53; <bonkei-diagram> is defined only where customElements exists
})

test('the tarball holds dist and nothing from src', () => {
  assert.deepEqual(pkg.files, ['dist'])
  assert.ok(!esm.some(f => f.endsWith('.ts') && !f.endsWith('.d.ts')))
})

// BON-178: the docs' API reference and llms-full.txt read each export's description from dist/index.d.ts. tsdown drops a /** */ written
// on an `export { X } from` line, so the comment must sit on the declaration itself; this fails for an export that has none.
test('every public export carries its description (JSDoc) in dist/index.d.ts', async () => {
  const { default: ts } = await import('typescript')
  const file = new URL('index.d.ts', dist).pathname
  const program = ts.createProgram([file], { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, skipLibCheck: true, jsx: ts.JsxEmit.ReactJSX })
  const checker = program.getTypeChecker()
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(file)))
  assert.ok(exports.length >= 29, `${exports.length} exports`)
  const bare = exports.filter(e => {
    const s = e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e
    return !ts.displayPartsToString(s.getDocumentationComment(checker)).trim()
  }).map(e => e.name)
  assert.deepEqual(bare, [], `exports without a description: ${bare.join(', ')}`)
})

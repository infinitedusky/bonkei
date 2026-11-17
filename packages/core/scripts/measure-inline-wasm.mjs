// Measurement only (BON-52): the script-tag bundle with the wasm inlined as base64, to compare with the wasm beside the bundle.
import fs from 'node:fs'
import zlib from 'node:zlib'
import { build } from 'tsdown'

fs.mkdirSync('.tmp-inline', { recursive: true })
fs.writeFileSync('.tmp-inline/entry.ts', `import { setAvoidWasm } from '../src/avoid'
import b64 from './wasm-b64'
setAvoidWasm('data:application/wasm;base64,' + b64)
export { render } from '../src/render'
`)
fs.writeFileSync('.tmp-inline/wasm-b64.ts', `export default '${fs.readFileSync('src/libavoid.wasm').toString('base64')}'`)
await build({ config: false, entry: { inline: './.tmp-inline/entry.ts' }, format: 'iife', globalName: 'Bonkei', platform: 'browser', minify: true, noExternal: [/.*/], define: { 'process.env.NODE_ENV': '"production"' }, outDir: '.tmp-inline/out', dts: false, publint: false, attw: false, logLevel: 'silent' })
const size = f => { const b = fs.readFileSync(f); return `${f}: raw ${b.length}, gzip ${zlib.gzipSync(b, { level: 9 }).length}, brotli ${zlib.brotliCompressSync(b).length}` }
for (const f of ['.tmp-inline/out/inline.iife.js', 'dist/bonkei.global.js', 'dist/libavoid.wasm']) console.log(size(f))
fs.rmSync('.tmp-inline', { recursive: true })

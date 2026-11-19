import fs from 'node:fs'
import { defineConfig } from 'tsdown'

// `virtual:libavoid-inline`: the wasm as base64 in a module of its own, which loadAvoid() imports only if the file beside the module is not found.
const inlineWasm = (on: boolean) => ({
  name: 'libavoid-inline',
  resolveId: (id: string) => (id === 'virtual:libavoid-inline' ? '\0libavoid-inline' : null),
  load: (id: string) => id === '\0libavoid-inline'
    ? `export default ${on ? JSON.stringify(fs.readFileSync('src/libavoid.wasm').toString('base64')) : 'null'}`
    : null,
})

export default defineConfig([
  {
    // The package: ESM + types. Dependencies and peers stay external, so the host's bundler dedupes React and three.
    entry: { index: 'src/index.ts', internal: 'src/internal.ts' },
    format: 'esm',
    platform: 'browser',
    dts: true,
    clean: true,
    sourcemap: true,
    plugins: [inlineWasm(true)],
    exports: true,
    publint: true,
    attw: { profile: 'esm-only' },
  },
  {
    // The script tag: one file with React, React DOM, three and everything else inside.
    entry: { 'bonkei.global': 'src/global.ts' },
    format: 'iife',
    globalName: 'Bonkei',
    platform: 'browser',
    minify: true,
    clean: false,
    deps: { alwaysBundle: [/.*/], onlyBundle: false }, // everything inside, on purpose
    plugins: [inlineWasm(false)],
    // No import.meta in an IIFE: avoid.ts then finds the wasm beside the script (document.currentScript), and libavoid-js's own
    // default is never used because avoid.ts always passes a URL.
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta': '{}' },
  },
])

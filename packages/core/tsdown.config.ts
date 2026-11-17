import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    // The package: ESM + types. Dependencies and peers stay external, so the host's bundler dedupes React and three.
    entry: { index: 'src/index.ts', internal: 'src/internal.ts' },
    format: 'esm',
    platform: 'browser',
    dts: true,
    clean: true,
    sourcemap: true,
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
    noExternal: [/.*/],
    define: { 'process.env.NODE_ENV': '"production"' },
  },
])

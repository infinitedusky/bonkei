// Budgets (BON-52): peers (react, react-dom, three) are ignored. Sizes are gzip, 1 kB = 1024 bytes. LOG.md (BON-52) has the measured numbers the limits were set from.
export default [
  { name: 'main chunk: import { Bonkei } (ELK, React and three excluded)', path: 'dist/index.js', import: '{ Bonkei }', ignore: ['react', 'react-dom', 'three', 'elkjs'], gzip: true, limit: '190 kB' },
  { name: 'ELK chunk (fetched on first layout)', path: 'node_modules/elkjs/lib/elk.bundled.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '480 kB' },
  { name: 'libavoid.wasm (fetched on first layout)', path: 'dist/libavoid.wasm', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '183 kB' },
  { name: 'script-tag bundle (bonkei.global.js, React and three inside)', path: 'dist/bonkei.global.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '880 kB' },
]

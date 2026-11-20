// Budgets (BON-52): peers (react, react-dom, three) are ignored. Sizes are gzip, 1 kB = 1024 bytes. LOG.md (BON-52) has the measured numbers the limits were set from.
export default [
  { name: 'main chunk: import { Bonkei } (ELK, React and three excluded)', path: 'dist/index.js', import: '{ Bonkei }', ignore: ['react', 'react-dom', 'three', 'elkjs'],
    // the base64 wasm fallback is a lazy chunk of its own (below); esbuild would inline it
    modifyEsbuildConfig: c => ({ ...c, external: [...(c.external ?? []), './_libavoid-inline-*', './stage-*', './StageScene-*'] }), gzip: true, limit: '203 kB' }, // 202 until BON-253's stage (+1.3 kB: the options, framing and zone sums; the drawing is its own chunk),   190 until BON-78's gestures (+3.9 kB), 197 until Cloud Cartography's icons, cards, arcs and ground titles (+4.2 kB, BON-235): LOG.md
  { name: 'stage chunk (fetched on the first stage: parts, loading; three\'s GLTFLoader is its own chunk beyond it)', path: 'dist/stage-*.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '4 kB' },
  { name: 'stage drawing chunk (fetched with the first stage: zones, signs, plumbobs, base)', path: 'dist/StageScene-*.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '6 kB' },
  { name: 'ELK chunk (fetched on first layout)', path: 'node_modules/elkjs/lib/elk.bundled.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '480 kB' },
  { name: 'libavoid.wasm (fetched on first layout)', path: 'dist/libavoid.wasm', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '183 kB' },
  { name: 'Zen Old Mincho font (fetched when a theme names it: label.font mincho)', path: 'dist/fonts/ZenOldMincho-Bold-latin.ttf', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '21 kB' },
  { name: 'Architects Daughter font (fetched when a theme names it: label.font architect)', path: 'dist/fonts/ArchitectsDaughter-Regular-latin.ttf', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '15 kB' },
  { name: 'Archivo Black font (fetched when a theme names it: tray.groundFont or label.card.titleFont archivo)', path: 'dist/fonts/ArchivoBlack-latin.ttf', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '24 kB' },
  { name: 'wasm fallback chunk (fetched only if the file beside the module is not found)', path: 'dist/_libavoid-inline-*.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '255 kB' },
  { name: 'script-tag bundle (bonkei.global.js, React and three inside)', path: 'dist/bonkei.global.js', disablePlugins: ['@size-limit/esbuild'], gzip: true, limit: '885 kB' },
]

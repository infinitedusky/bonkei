// After tsdown: the wasm and the bundled fonts (with their licence) beside the ESM output (real files, not the src symlink),
// and the script-tag bundle under its final name.
import fs from 'node:fs'
const dist = new URL('../dist/', import.meta.url)
fs.copyFileSync(new URL('../src/libavoid.wasm', import.meta.url), new URL('libavoid.wasm', dist))
// fonts.ts finds them at ./fonts/ from the module (ESM) or from bonkei.global.js (script tag)
fs.mkdirSync(new URL('fonts/', dist), { recursive: true })
for (const f of ['ZenOldMincho-Bold-latin.ttf', 'OFL-ZenOldMincho.txt', 'ArchitectsDaughter-Regular-latin.ttf', 'OFL-ArchitectsDaughter.txt', 'InterDisplay-Regular-latin.ttf', 'OFL-InterDisplay.txt']) fs.copyFileSync(new URL(`../src/fonts/${f}`, import.meta.url), new URL(`fonts/${f}`, dist))
if (fs.existsSync(new URL('bonkei.global.iife.js', dist))) fs.renameSync(new URL('bonkei.global.iife.js', dist), new URL('bonkei.global.js', dist))

// After tsdown: the wasm beside the ESM output (a real file, not the src symlink) and the script-tag bundle under its final name.
import fs from 'node:fs'
fs.copyFileSync(new URL('../src/libavoid.wasm', import.meta.url), new URL('../dist/libavoid.wasm', import.meta.url))
if (fs.existsSync('dist/bonkei.global.iife.js')) fs.renameSync('dist/bonkei.global.iife.js', 'dist/bonkei.global.js')

// After tsdown: the wasm beside the ESM output (a real file, not the src symlink) and the script-tag bundle under its final name.
import fs from 'node:fs'
const dist = new URL('../dist/', import.meta.url)
fs.copyFileSync(new URL('../src/libavoid.wasm', import.meta.url), new URL('libavoid.wasm', dist))
if (fs.existsSync(new URL('bonkei.global.iife.js', dist))) fs.renameSync(new URL('bonkei.global.iife.js', dist), new URL('bonkei.global.js', dist))

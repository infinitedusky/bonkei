// Puts the script-tag files beside index.html: node copy-bundle.mjs [dir]  (default: packages/core/dist, after `pnpm --filter bonkei build`;
// the smoke test passes the dist/ of the packed tarball). They are not committed: a user gets them from the package or a CDN.
import fs from 'node:fs'
const from = process.argv[2] ?? new URL('../../packages/core/dist/', import.meta.url).pathname
const to = process.argv[3] ?? import.meta.dirname
for (const f of ['bonkei.global.js', 'libavoid.wasm']) fs.copyFileSync(`${from}/${f}`, `${to}/${f}`)
fs.cpSync(`${from}/fonts`, `${to}/fonts`, { recursive: true })
console.log('copied bonkei.global.js, libavoid.wasm and fonts/ from', from)

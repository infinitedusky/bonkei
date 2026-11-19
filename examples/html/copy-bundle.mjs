// Puts the script-tag files beside index.html: node copy-bundle.mjs [from] [to]
//   from: a bonkei dist/ folder (default packages/core/dist, after `pnpm --filter bonkei build`; the smoke test passes the packed tarball's)
//   to:   where index.html is (default this folder)
// They are not committed: a user gets them from the package or a CDN.
import fs from 'node:fs'
import path from 'node:path'

const from = process.argv[2] ?? path.resolve(import.meta.dirname, '../../packages/core/dist')
const to = process.argv[3] ?? import.meta.dirname
for (const f of ['bonkei.global.js', 'libavoid.wasm']) fs.copyFileSync(path.join(from, f), path.join(to, f))
fs.cpSync(path.join(from, 'fonts'), path.join(to, 'fonts'), { recursive: true })
console.log(`copied bonkei.global.js, libavoid.wasm and fonts/ from ${from} to ${to}`)

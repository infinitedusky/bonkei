// Puts the script-tag page and the global bundle (built by packages/core) under public/embed/, so the playground's address
// serves the plain-HTML embed too: /app/embed/index.html. Not committed; made before dev and build.
import fs from 'node:fs'

const dist = new URL('../../../packages/core/dist/', import.meta.url)
const out = new URL('../public/embed/', import.meta.url)
fs.mkdirSync(out, { recursive: true })
for (const f of ['bonkei.global.js', 'libavoid.wasm']) fs.copyFileSync(new URL(f, dist), new URL(f, out))
fs.copyFileSync(new URL('../../../scripts/smoke/script-tag.html', import.meta.url), new URL('index.html', out))

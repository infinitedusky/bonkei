// Puts the script-tag page and the global bundle (built by packages/core) under public/embed/, so the playground's address
// serves the plain-HTML embed too: /app/embed/index.html. embed/no-wasm/ is the same page without libavoid.wasm beside the
// bundle (the fallback state: ELK's routes, routingError says why); Storybook's ScriptTag stories show both. Not committed;
// made before dev, build and Storybook.
import fs from 'node:fs'

const dist = new URL('../../../packages/core/dist/', import.meta.url)
const page = new URL('../../../scripts/smoke/script-tag.html', import.meta.url)
const write = (dir, files) => {
  const out = new URL(dir, new URL('../public/', import.meta.url))
  fs.mkdirSync(out, { recursive: true })
  for (const f of files) fs.copyFileSync(new URL(f, dist), new URL(f, out))
  fs.copyFileSync(page, new URL('index.html', out))
}
write('embed/', ['bonkei.global.js', 'libavoid.wasm'])
write('embed/no-wasm/', ['bonkei.global.js'])

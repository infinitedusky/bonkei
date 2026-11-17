// Smoke test (BON-52): a static HTML page, no build step, loading only the global bundle (and the wasm beside it).
// Second pass: the same page with libavoid.wasm missing still draws, with ELK's routes and routingError saying why.
// Run after `pnpm --filter bonkei build`. `node scripts/smoke/script-tag.mjs <dir>` serves an existing folder instead.
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { check, freePort } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const dist = path.join(root, 'packages/core/dist')
const page = (withWasm) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-tag-'))
  fs.copyFileSync(path.join(dist, 'bonkei.global.js'), path.join(dir, 'bonkei.global.js'))
  if (withWasm) fs.copyFileSync(path.join(dist, 'libavoid.wasm'), path.join(dir, 'libavoid.wasm'))
  fs.copyFileSync(path.join(root, 'scripts/smoke/script-tag.html'), path.join(dir, 'index.html'))
  return dir
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' }
async function serve(dir, run) {
  const port = await freePort()
  const server = http.createServer((q, r) => {
    const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0])
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end() }
    r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(fs.readFileSync(f))
  }).listen(port)
  console.log('page dir:', dir, '| files:', fs.readdirSync(dir).join(', '))
  try { return await run(`http://localhost:${port}/`) } finally { server.close() }
}

const given = process.argv[2]
const dir = given ?? page(true)
// the script tag carries ELK inside, so there is no ELK request to see
await serve(dir, url => check(url, { label: 'script tag', expectElkRequest: false, shot: path.join(dir, 'shot.png') }))
if (!given) {
  const bare = page(false)
  await serve(bare, url => check(url, { label: 'script tag, wasm missing', expectElkRequest: false, expectFallback: true }))
}

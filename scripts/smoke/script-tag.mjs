// Smoke test (BON-52): a static HTML page, no build step, loading only the global bundle (and the wasm beside it).
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { check } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const dist = path.join(root, 'packages/core/dist')
const dir = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-tag-'))
if (!process.argv[2]) {
  fs.copyFileSync(path.join(dist, 'bonkei.global.js'), path.join(dir, 'bonkei.global.js'))
  fs.copyFileSync(path.join(dist, 'libavoid.wasm'), path.join(dir, 'libavoid.wasm'))
  fs.writeFileSync(path.join(dir, 'index.html'), fs.readFileSync(path.join(root, 'scripts/smoke/script-tag.html')))
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' }
const server = http.createServer((q, r) => {
  const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0])
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(fs.readFileSync(f))
}).listen(5393)
console.log('page dir:', dir, '| files:', fs.readdirSync(dir).join(', '))
try { await check('http://localhost:5393/', { label: 'script tag', expectElkRequest: false, shot: path.join(dir, 'shot.png') }) } finally { server.close() }

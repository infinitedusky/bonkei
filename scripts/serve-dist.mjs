// Serves the assembled Pages artifact (dist/) the way GitHub Pages does: /docs/ -> docs/index.html, /docs/guide/react -> react.html.
// Usage: node scripts/serve-dist.mjs [dir] ; the port is $PORT (never fixed). Used by the prototype and the docs smoke test.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const dir = path.resolve(process.argv[2] ?? 'dist')
const port = Number(process.env.PORT)
if (!port) { console.error('serve-dist: set PORT'); process.exit(1) }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' }
const file = p => [p, p + '.html', path.join(p, 'index.html')].find(f => fs.existsSync(f) && fs.statSync(f).isFile())

http.createServer((q, r) => {
  const p = path.join(dir, decodeURIComponent(q.url.split('?')[0]))
  const f = p.startsWith(dir) ? file(p) : undefined
  if (!f) { const nf = path.join(dir, '404.html'); r.writeHead(404, { 'content-type': types['.html'] }); return r.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found') }
  r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(r)
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`))

// Serves a built site the way GitHub Pages does (clean URLs: /docs/ -> docs/index.html, /docs/guide/react -> guide/react.html), on $PORT.
//   node scripts/serve-dist.mjs [dir] [mount]
// dir defaults to dist/ (the assembled Pages artifact). mount serves dir under a path instead of at /: the docs' own build is served with
//   node scripts/serve-dist.mjs docs/.vitepress/dist /docs/
// Used by the docs smoke test and the smoke set-up. The port is always $PORT, never fixed.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const dir = path.resolve(process.argv[2] ?? 'dist')
const mount = '/' + (process.argv[3] ?? '/').replace(/^\/+|\/+$/g, '') // '/' or '/docs'
const port = Number(process.env.PORT)
if (!port) { console.error('serve-dist: set PORT'); process.exit(1) }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' }
const file = p => [p, p + '.html', path.join(p, 'index.html')].find(f => fs.existsSync(f) && fs.statSync(f).isFile())

http.createServer((q, r) => {
  let url
  try { url = decodeURIComponent(q.url.split('?')[0]) } catch { r.writeHead(400); return r.end('bad request') } // a malformed %-escape
  if (mount !== '/') {
    if (url === mount) { r.writeHead(301, { location: mount + '/' }); return r.end() }
    url = url.startsWith(mount + '/') ? url.slice(mount.length) : null
  }
  const p = url === null ? null : path.join(dir, url)
  const f = p && (p === dir || p.startsWith(dir + path.sep)) ? file(p) : undefined
  if (!f) { const nf = path.join(dir, '404.html'); r.writeHead(404, { 'content-type': types['.html'] }); return r.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found') }
  r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(r)
}).listen(port, () => console.log(`serving ${dir} at http://localhost:${port}${mount === '/' ? '/' : mount + '/'}`))

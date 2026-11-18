// Serves the embed examples (BON-53) from one port, for a reviewer's browser: node scripts/prototype-serve.mjs  (PORT, PORT_2)
//   /                      a page with links
//   /examples/html/        examples/html as static files (run examples/html/copy-bundle.mjs first)
//   /examples/vitepress/   the built examples/vitepress, served by `vitepress preview` on PORT_2 and proxied here
// Build it first with BONKEI_BASE=/examples/vitepress/ so the site's links and assets live under that path.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const port = Number(process.env.PORT), inner = Number(process.env.PORT_2)
if (!port || !inner) throw new Error('PORT and PORT_2 are required')
const base = '/examples/vitepress/'
spawn(process.execPath, [path.join(root, 'examples/vitepress/node_modules/vitepress/bin/vitepress.js'), 'preview', '--port', String(inner), '--host', '127.0.0.1'],
  { cwd: path.join(root, 'examples/vitepress'), stdio: 'inherit', env: { ...process.env, BONKEI_BASE: base } })

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.txt': 'text/plain' }
const index = `<!doctype html><meta charset="utf-8"><title>Bonkei embeds</title><body style="font:16px system-ui;max-width:640px;margin:3rem auto">
<h1>Bonkei embeds (BON-53)</h1><ul><li><a href="/examples/html/">Script tag: examples/html</a></li>
<li><a href="${base}">VitePress: examples/vitepress</a> (built, <code>vitepress preview</code>)</li></ul><p>Made-up diagrams.</p>`

http.createServer((q, r) => {
  const url = q.url ?? '/'
  if (url.startsWith(base) || url === base.slice(0, -1)) {
    const up = http.request({ host: '127.0.0.1', port: inner, path: url, method: q.method, headers: { ...q.headers, host: `127.0.0.1:${inner}` } }, res => { r.writeHead(res.statusCode ?? 502, res.headers); res.pipe(r) })
    up.on('error', () => { r.writeHead(502); r.end('vitepress preview is not up yet') })
    return q.pipe(up)
  }
  if (url.startsWith('/examples/html')) {
    const rel = decodeURIComponent(url.slice('/examples/html'.length).split('?')[0]) || '/'
    const dir = path.join(root, 'examples/html')
    const f = path.join(dir, rel.endsWith('/') ? rel + 'index.html' : rel)
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('not found') }
    r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' })
    return r.end(fs.readFileSync(f))
  }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(index)
}).listen(port, () => console.log(`bonkei embeds on :${port} (vitepress preview on :${inner})`))

// Smoke test (BON-127): the four getting-started pages, followed in a new empty project each, with the packed tarballs in place of the
// npm registry. The commands and the code come out of the page's own Markdown (docs/guide/*.md), word for word; only the
// `bonkei` / `@bonkei/vitepress` names in an install line become the tarballs. What a page leaves to the reader's app (an index.html
// with a #diagram div, the line that mounts the React component) is the smallest thing that stands in for it. Each must end with a
// diagram drawn. Run after `node scripts/docs-install.mjs` (it needs docs/.packs).
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { freePort } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const packs = path.join(root, 'docs/.packs')
const tgz = { bonkei: path.join(packs, 'bonkei-0.0.0.tgz'), '@bonkei/vitepress': path.join(packs, 'bonkei-vitepress-0.0.0.tgz') }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-start-'))
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: { ...process.env, CI: '1' } })
let failed = false
const ok = (name, good, detail = '') => { console.log(`${good ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!good) { failed = true; process.exitCode = 1 } }

// the fenced blocks of a page: { info, text }, nested fences by length
function blocks(md) {
  const out = [], lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^(`{3,})(.*)$/.exec(lines[i]); if (!m) continue
    const body = []; i++
    while (i < lines.length && !(lines[i].startsWith(m[1]) && lines[i].trim() === m[1])) body.push(lines[i++])
    out.push({ info: m[2].trim(), text: body.join('\n') })
  }
  return out
}
const page = n => blocks(fs.readFileSync(path.join(root, 'docs/guide', n + '.md'), 'utf8'))
const find = (bs, re) => { const b = bs.find(b => re.test(b.info)); if (!b) throw new Error(`no block matching ${re}`); return b.text }
// `npm install bonkei react …` as written on the page, with the package names that are ours pointing at the tarballs
const install = line => line.replace(/(?<=\s)(@bonkei\/vitepress|bonkei)(?=\s|$)/g, n => tgz[n]) + (/@bonkei\/vitepress|\bbonkei\b/.test(line) ? ' --no-audit --no-fund' : '')
const project = name => { const d = path.join(tmp, name); fs.mkdirSync(d); sh('npm init -y', d); return d }
const npmInstall = (d, text, override = false) => {
  const pkg = path.join(d, 'package.json'), j = JSON.parse(fs.readFileSync(pkg, 'utf8')); j.type = 'module'
  // @bonkei/vitepress's own dependency on bonkei is "0.0.0" until published: until then the packed one stands in (a direct install needs no override)
  if (override) j.overrides = { bonkei: tgz.bonkei }
  fs.writeFileSync(pkg, JSON.stringify(j))
  for (const l of text.split('\n').filter(l => l.startsWith('npm install'))) sh(install(l), d)
}
const launch = () => chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
const serve = async (cmd, args, cwd, ready) => {
  const port = await freePort()
  const p = spawn(cmd, [...args, '--port', String(port)], { cwd, stdio: 'ignore' })
  for (let i = 0; i < 120; i++) { try { await fetch(`http://localhost:${port}/`); return { p, url: `http://localhost:${port}/` } } catch { await new Promise(r => setTimeout(r, 500)) } }
  p.kill(); throw new Error('server did not start')
}
async function draws(label, url, selector) {
  const browser = await launch(), errors = []
  try {
    const pg = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    pg.on('pageerror', e => errors.push(String(e)))
    pg.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()) })
    pg.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`) })
    await pg.goto(url, { waitUntil: 'load' })
    const good = await pg.waitForFunction(s => document.querySelector(s + ' [data-bonkei=ready] canvas') || document.querySelector(s + '[data-bonkei=ready] canvas'), selector, { timeout: 60000 }).then(() => true, () => false)
    ok(`${label}: ends with a diagram drawn, no console errors`, good && errors.length === 0, errors.slice(0, 2).join(' | '))
  } finally { await browser.close() }
}
const viteConfig = `import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n`

// ---- React: the page's install line and component, mounted by a main.tsx the app would have anyway
{
  const bs = page('react'), d = project('react')
  npmInstall(d, find(bs, /^sh/)); sh('npm install vite @vitejs/plugin-react --no-audit --no-fund', d)
  fs.mkdirSync(path.join(d, 'src'))
  fs.writeFileSync(path.join(d, 'src/Pipeline.tsx'), find(bs, /^tsx.*\[React\]/))
  fs.writeFileSync(path.join(d, 'src/main.tsx'), `import { createRoot } from 'react-dom/client'\nimport { Pipeline } from './Pipeline'\ncreateRoot(document.getElementById('root')!).render(<Pipeline />)\n`)
  fs.writeFileSync(path.join(d, 'index.html'), `<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>`)
  fs.writeFileSync(path.join(d, 'vite.config.js'), viteConfig)
  sh('npx vite build', d)
  const s = await serve('npx', ['vite', 'preview', '--strictPort'], d)
  try { await draws('getting started, React', s.url, '#root') } finally { s.p.kill('SIGTERM') }
}
// ---- Plain JavaScript: the page's TypeScript, in a page with the #diagram div it asks for
{
  const bs = page('javascript'), d = project('javascript')
  npmInstall(d, find(bs, /^sh/)); sh('npm install vite --no-audit --no-fund', d)
  fs.mkdirSync(path.join(d, 'src'))
  fs.writeFileSync(path.join(d, 'src/main.ts'), find(bs, /^ts.*\[JavaScript\]/))
  fs.writeFileSync(path.join(d, 'index.html'), `<!doctype html><div id="diagram"></div><script type="module" src="/src/main.ts"></script>`)
  sh('npx vite build', d)
  const s = await serve('npx', ['vite', 'preview', '--strictPort'], d)
  try { await draws('getting started, plain JavaScript', s.url, '#diagram') } finally { s.p.kill('SIGTERM') }
}
// ---- Script tag: the page's cp lines, then its HTML, served as static files
{
  const bs = page('script-tag'), d = project('script-tag')
  const sh1 = find(bs, /^sh/)
  npmInstall(d, sh1)
  fs.mkdirSync(path.join(d, 'public'))
  for (const l of sh1.split('\n').filter(l => l.startsWith('cp '))) sh(l, d)
  fs.writeFileSync(path.join(d, 'public/index.html'), `<!doctype html><html><body>\n${find(bs, /^html \[Script tag\]/)}\n</body></html>`)
  const files = fs.readdirSync(path.join(d, 'public')).sort().join(',')
  ok('getting started, script tag: the three files are beside the page', files === 'bonkei.global.js,fonts,index.html,libavoid.wasm', files)
  const port = await freePort()
  const s = spawn(process.execPath, [path.join(root, 'scripts/serve-dist.mjs'), path.join(d, 'public')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' })
  for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break } catch { await new Promise(r => setTimeout(r, 250)) } }
  try { await draws('getting started, script tag', `http://localhost:${port}/`, 'bonkei-diagram') } finally { s.kill('SIGTERM') }
}
// ---- VitePress: the page's installs, config, theme and fence
{
  const bs = page('vitepress'), d = project('vitepress')
  npmInstall(d, find(bs, /^sh/), true)
  fs.mkdirSync(path.join(d, '.vitepress/theme'), { recursive: true })
  fs.writeFileSync(path.join(d, '.vitepress/config.ts'), find(bs, /^ts \[\.vitepress\/config\.ts\]/))
  fs.writeFileSync(path.join(d, '.vitepress/theme/index.ts'), find(bs, /^ts \[\.vitepress\/theme\/index\.ts\]/))
  fs.writeFileSync(path.join(d, 'index.md'), '# Hello\n\n' + blocks(fs.readFileSync(path.join(root, 'docs/guide/vitepress.md'), 'utf8')).find(b => /^md$/.test(b.info) && b.text.includes('```mermaid')).text + '\n')
  sh('npx vitepress build', d)
  const s = await serve('npx', ['vitepress', 'preview'], d)
  try { await draws('getting started, VitePress', s.url, '.bonkei-diagram') } finally { s.p.kill('SIGTERM') }
}
console.log(failed ? 'FAILED' : 'all four getting-started pages work', `(projects in ${tmp})`)

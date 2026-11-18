// Smoke test (BON-53): the embeds, from the packed tarballs (not the workspace link).
//  1. examples/html with bonkei.global.js, libavoid.wasm and fonts/ from the tarball: two <bonkei-diagram> draw; a removed one is
//     destroyed and an added one draws; loading the script twice does not throw; pre.mermaid blocks stay text until Bonkei.run().
//  2. examples/vitepress with @bonkei/vitepress and bonkei installed from tarballs: under `vitepress dev` and under `vitepress build` +
//     `preview`, the diagrams page draws a flowchart, a sequence diagram and a 600 px one; a pie fence is left as the site renders it;
//     the home page (no diagram) downloads no Bonkei, React or three. In the build, the server-rendered HTML holds a box of the set
//     height per diagram, and a paragraph below them does not move when they draw.
// Run after `pnpm --filter bonkei build`.
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { freePort } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: { ...process.env, CI: '1' } })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-embeds-'))
const results = []
const near = (s, n) => Math.abs(parseInt(s) - n) <= 2 // a 1px border on each side
const ok = (name, good, detail = '') => { results.push([name, good, detail]); console.log(`${good ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!good) process.exitCode = 1 }
const launch = () => chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
console.log('tmp:', tmp)

// ---- pack both packages
const pack = path.join(tmp, 'pack'); fs.mkdirSync(pack)
for (const p of ['packages/core', 'packages/vitepress']) sh(`pnpm pack --pack-destination ${pack}`, path.join(root, p))
const tgz = n => path.join(pack, fs.readdirSync(pack).find(f => f.startsWith(n)))
const coreTgz = tgz('bonkei-0'), vpTgz = tgz('bonkei-vitepress')
console.log('packed', path.basename(coreTgz), path.basename(vpTgz))

// page helper: errors, requests, bonkei-diagram readiness
async function open(browser, url, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, ...opts })
  const errors = [], requests = []
  page.on('pageerror', e => errors.push(String(e)))
  // Vite 5 dev (BON-52's known quirk): the wasm file is not served as a file, the loader logs it, bonkei falls back to its inlined copy and draws.
  const devWasm = /wasm streaming compile failed|falling back to ArrayBuffer|failed to asynchronously prepare wasm|Aborted\(CompileError/
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text()) && !devWasm.test(m.text())) errors.push(m.text()) })
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`) })
  page.on('response', async r => { requests.push({ url: r.url(), status: r.status(), type: r.request().resourceType() }) })
  await page.goto(url, { waitUntil: 'load' })
  return { page, errors, requests }
}
const ready = (page, sel, n) => page.waitForFunction(([s, n]) => document.querySelectorAll(`${s} [data-bonkei=ready]`).length >= n && document.querySelectorAll(`${s} canvas`).length >= n, [sel, n], { timeout: 60000 }).then(() => true, () => false)

// ---- 1. the HTML example
{
  const dir = path.join(tmp, 'html'); fs.mkdirSync(dir)
  const x = path.join(tmp, 'core-x'); fs.mkdirSync(x)
  sh(`tar -xzf ${coreTgz} -C ${x}`)
  fs.copyFileSync(path.join(root, 'examples/html/index.html'), path.join(dir, 'index.html'))
  sh(`node ${path.join(root, 'examples/html/copy-bundle.mjs')} ${x}/package/dist ${dir}`)
  const files = fs.readdirSync(dir).sort()
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf' }
  const port = await freePort()
  const server = http.createServer((q, r) => {
    const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0])
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
    r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(fs.readFileSync(f))
  }).listen(port)
  const browser = await launch()
  try {
    const { page, errors, requests } = await open(browser, `http://localhost:${port}/`)
    ok('html: static files only', JSON.stringify(files) === JSON.stringify(['bonkei.global.js', 'fonts', 'index.html', 'libavoid.wasm']), files.join(', '))
    ok('html: two <bonkei-diagram> reach ready', await ready(page, 'bonkei-diagram', 2))
    ok('html: libavoid.wasm and the font were fetched beside the script', requests.some(r => /libavoid\.wasm$/.test(r.url) && r.status === 200) && requests.some(r => /fonts\/.*\.ttf$/.test(r.url) && r.status === 200))
    const h = await page.evaluate(() => [...document.querySelectorAll('bonkei-diagram')].map(e => Math.round(e.getBoundingClientRect().height) + ':' + getComputedStyle(e).display))
    ok('html: display block, default height 420 and height="600"', near(h[0], 420) && near(h[1], 600) && h.every(x => x.endsWith(':block')), h.join(' '))
    // 2. removed → destroyed, added → draws
    const canvases = () => page.locator('canvas').count()
    const before = await canvases()
    await page.click('#add')
    ok('html: an element added later draws', await ready(page, 'bonkei-diagram', 3) && await canvases() === before + 1)
    await page.click('#remove')
    await page.waitForTimeout(500)
    ok('html: a removed element is cleaned up (its canvas is gone)', await canvases() === before)
    await page.evaluate(() => { const s = document.createElement('script'); s.src = 'bonkei.global.js'; document.body.appendChild(s) })
    await page.waitForTimeout(1500)
    ok('html: loading the script twice does not throw', errors.length === 0, errors.slice(0, 2).join(' | '))
    // 3. pre.mermaid only when asked
    const pre = () => page.locator('pre.mermaid').count()
    ok('html: pre.mermaid blocks stay text before run()', await pre() === 2 && await page.locator('bonkei-diagram').count() === 2)
    await page.click('#run')
    ok('html: after Bonkei.run() the flowchart block is a diagram and the pie stays text', await ready(page, 'bonkei-diagram', 3) && await pre() === 1 && /pie/.test(await page.locator('pre.mermaid').innerText()))
    ok('html: no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))
    await page.screenshot({ path: path.join(tmp, 'html.png') })
  } finally { await browser.close(); server.close() }
}

// ---- 2. the VitePress example
const app = path.join(tmp, 'vitepress')
fs.cpSync(path.join(root, 'examples/vitepress'), app, { recursive: true, filter: f => !/node_modules|\.vitepress\/(dist|cache)/.test(f) })
{
  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  pkg.dependencies['@bonkei/vitepress'] = `file:${vpTgz}`
  pkg.overrides = { bonkei: `file:${coreTgz}` } // the plugin's tarball says bonkei 0.0.0; this is the packed one
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify(pkg, null, 2))
  const out = sh('npm install 2>&1', app)
  console.log('npm install:', out.split('\n').filter(l => /ERESOLVE|peer dep/i.test(l)).join('\n') || 'no peer warnings')
  const inst = n => fs.existsSync(path.join(app, 'node_modules', n, 'package.json'))
  ok('vitepress: installed from tarballs with react, react-dom and three coming with the plugin', inst('bonkei') && inst('@bonkei/vitepress') && inst('react') && inst('react-dom') && inst('three'),
    `app dependencies: ${Object.keys(pkg.dependencies)}`)
}
const vp = async (args) => {
  const port = await freePort()
  const p = spawn(process.execPath, [path.join(app, 'node_modules/vitepress/bin/vitepress.js'), ...args, '--port', String(port)], { cwd: app, stdio: 'ignore' })
  for (let i = 0; i < 90; i++) { try { await fetch(`http://localhost:${port}/`); return { p, url: `http://localhost:${port}/` } } catch { await new Promise(r => setTimeout(r, 500)) } }
  p.kill('SIGTERM'); throw new Error(`vitepress ${args[0]} did not start`)
}
const HEAVY = /bonkei|three|react|elk|libavoid|\.wasm|ZenOldMincho/i

async function checkSite(label, url, { built }) {
  const browser = await launch()
  try {
    // the home page has no diagram: nothing heavy is downloaded
    const home = await open(browser, url)
    await home.page.waitForTimeout(1500)
    const heavyHome = home.requests.filter(r => HEAVY.test(r.url.replace(/^https?:\/\/[^/]+/, '').replace(/\/node_modules\/\.vite\/deps\/(vue|vitepress)[^/]*/g, '')) && !/vitepress|vue/i.test(r.url))
    ok(`${label}: a page with no diagram downloads no Bonkei, React or three`, heavyHome.length === 0 && home.errors.length === 0, heavyHome.map(r => r.url).slice(0, 3).join(', ') || `${home.requests.filter(r => r.type === 'script').length} scripts`)
    await home.page.close()

    // the diagrams page: layout before JS (built only), then after the diagrams draw
    const dUrl = `${url}diagrams`
    let before = null
    if (built) {
      const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1100, height: 900 } })
      const p = await nojs.newPage(); await p.goto(dUrl, { waitUntil: 'load' })
      const boxes = await p.evaluate(() => [...document.querySelectorAll('.bonkei-diagram')].map(e => Math.round(e.getBoundingClientRect().height)))
      before = { below: await p.evaluate(() => Math.round(document.getElementById('below').getBoundingClientRect().top + scrollY)), boxes }
      const html = await (await fetch(dUrl)).text()
      const styled = (html.match(/class="bonkei-diagram"[^>]*style="[^"]*height:\d+px/g) ?? []).length
      ok(`${label}: the server-rendered HTML holds a box of the set height per diagram`, styled === 3 && boxes.length === 3 && near(boxes[0], 420) && near(boxes[2], 600), `${styled} boxes in the HTML, heights without JS ${boxes}`)
      await nojs.close()
    }
    const { page, errors, requests } = await open(browser, dUrl)
    const drew = await ready(page, '.bonkei-diagram', 3)
    ok(`${label}: flowchart, sequence and own-height diagrams draw`, drew && errors.length === 0, errors.slice(0, 2).join(' | '))
    const after = await page.evaluate(() => ({
      boxes: [...document.querySelectorAll('.bonkei-diagram')].map(e => Math.round(e.getBoundingClientRect().height)),
      below: Math.round(document.getElementById('below').getBoundingClientRect().top + scrollY),
      mermaidCode: document.querySelectorAll('div.language-mermaid').length,
      pieText: document.querySelector('div.language-mermaid')?.innerText.includes('pie title Pets') ?? false,
      errorCards: document.querySelectorAll('[data-bonkei=error]').length,
    }))
    ok(`${label}: site-wide default height and a per-diagram height`, after.boxes.length === 3 && Math.abs(after.boxes[0] - 420) <= 2 && Math.abs(after.boxes[2] - 600) <= 2, `heights ${after.boxes}`)
    ok(`${label}: the pie fence is left as the site renders it, no error card`, after.mermaidCode === 1 && after.pieText && after.errorCards === 0)
    ok(`${label}: the diagrams page does download Bonkei's chunks (the control for the home page)`, requests.some(r => /\.wasm/.test(r.url) || /bonkei|libavoid/i.test(r.url)))
    if (built) ok(`${label}: the paragraph below the diagrams does not move when they draw`, before.below === after.below, `top ${before.below}px before JS and ${after.below}px after`)
    await page.screenshot({ path: path.join(tmp, `${label.replace(/\W/g, '-')}.png`) })
  } finally { await browser.close() }
}

{
  const dev = await vp(['dev'])
  try { await checkSite('vitepress dev', dev.url, { built: false }) } finally { dev.p.kill('SIGTERM') }
  sh(`node node_modules/vitepress/bin/vitepress.js build`, app)
  const prev = await vp(['preview'])
  try { await checkSite('vitepress build+preview', prev.url, { built: true }) } finally { prev.p.kill('SIGTERM') }
}

console.log(`\n${results.filter(r => r[1]).length}/${results.length} checks ok; screenshots in ${tmp}`)

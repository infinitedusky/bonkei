// Smoke test for the docs (BON-178). Usage: node scripts/smoke/docs.mjs <origin that serves the docs at /docs/, e.g. http://localhost:6391>
// (scripts/smoke/docs-run.mjs builds, serves and runs this; the set-up for trying a task by hand serves the assembled dist/ the same way).
//  - bonkei and @bonkei/vitepress in docs/node_modules are installed tarball copies (no link into packages/*, no src/)
//  - llms.txt lists every page with a description, llms-full.txt holds every page and every export's signature and description, each page
//    has a .md beside it, the Edge styles .md holds its diagrams as mermaid fences and no HTML chrome
//  - every page opens with no console errors; every diagram on it draws, and their number is that of the supported mermaid fences in its
//    .md; the errors page has its one intended error card; the diagram-types page draws flowchart and sequence and shows the pie as code
//  - the playground: an edit redraws, a broken edit is reported under the editor and the last diagram stays
//  - Copy page puts exactly the page's .md on the clipboard (home and Edge styles)
//  - telemetry: the playground's edits, a failed edit and Copy page are spans (a recording stand-in for an OpenTelemetry SDK)
//  - at 390, 820 and 1024 px nothing scrolls sideways and every diagram fits the width; at 390 the nav folds into a menu, and a
//    tap takes hold of a diagram (BON-78: a page that scrolls keeps one finger until then) and a touch drag then moves it
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright'

const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base) { console.error('usage: node scripts/smoke/docs.mjs <origin serving /docs/>'); process.exit(2) }
const root = path.resolve(import.meta.dirname, '../..')
const results = []
const ok = (name, good, detail = '') => { results.push(good); console.log(`${good ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!good) process.exitCode = 1 }

// ---- installed from tarballs
{
  const nm = path.join(root, 'docs/node_modules')
  for (const n of ['bonkei', '@bonkei/vitepress']) {
    const p = path.join(nm, n)
    const real = fs.realpathSync(p)
    ok(`installed: ${n} is a copy in docs/node_modules`, real === p && !fs.lstatSync(p).isSymbolicLink(), real)
    ok(`installed: ${n} holds the packed "files" only`, n === '@bonkei/vitepress' ? fs.existsSync(path.join(p, 'src/index.js')) && !fs.existsSync(path.join(p, 'src/index.test.js')) : !fs.existsSync(path.join(p, 'src')) && fs.existsSync(path.join(p, 'dist/index.js')))
  }
}

// ---- agents: llms.txt, llms-full.txt, .md
const text = async p => { const r = await fetch(base + p); return { status: r.status, body: await r.text() } }
const llms = await text('/docs/llms.txt'), full = await text('/docs/llms-full.txt')
const entries = [...llms.body.matchAll(/^- \[([^\]]+)\]\(https:\/\/bonkei\.dev(\/docs\/[^)]*\.md)\)(: (.+))?$/gm)].map(m => ({ title: m[1], md: m[2], desc: m[4] }))
ok('agents: llms.txt lists pages, each with a description', llms.status === 200 && entries.length >= 40 && entries.every(e => e.desc && e.desc.length > 20), `${entries.length} pages, ${entries.filter(e => !e.desc).length} without a description`)
const mdPages = []
for (const e of entries) mdPages.push([e, await text(e.md)])
ok('agents: every listed page has a .md beside it', mdPages.every(([, r]) => r.status === 200 && r.body.length > 50), mdPages.filter(([, r]) => r.status !== 200).map(([e]) => e.md).join(', '))
ok('agents: llms-full.txt holds every listed page', full.status === 200 && mdPages.every(([e]) => full.body.includes(`url: https://bonkei.dev${e.md}`)), `${full.body.length} bytes`)
const edge = mdPages.find(([e]) => e.md.endsWith('/guide/edge-styles.md'))?.[1].body ?? ''
ok('agents: the Edge styles .md has its diagrams as mermaid fences and no HTML chrome', (edge.match(/```mermaid/g) ?? []).length >= 13 && !/<nav|<header|<script|<aside|<Bonkei(Live|Playground)|<Copy/.test(edge.replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1$/gm, '')))
// every export of the installed package, read from its types: each has a page in llms-full.txt with its signature (a declaration block, or an
// interface's property table) and its description
const ts = createRequire(path.join(root, 'docs/package.json'))('typescript')
const dts = path.join(root, 'docs/node_modules/bonkei/dist/index.d.ts')
const program = ts.createProgram([dts], { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, skipLibCheck: true, jsx: ts.JsxEmit.ReactJSX })
const EXPORTS = program.getTypeChecker().getExportsOfModule(program.getTypeChecker().getSymbolAtLocation(program.getSourceFile(dts))).map(e => e.name)
const section = n => { const m = new RegExp(`^# (Function|Variable|Interface|Type Alias): ${n}(\\(\\))?$([\\s\\S]*?)(?=^# |^---$|(?![\\s\\S]))`, 'm').exec(full.body); return m?.[3] ?? '' }
const missing = EXPORTS.filter(n => { const s = section(n); const description = s.replace(/```[\s\S]*?```/g, '').split('\n').map(l => l.trim()).find(l => l && !/^(#|\||---)/.test(l)); return !(/```ts/.test(s) || /^## Properties\n\n\|/m.test(s)) || !description })
ok('agents: every public export has its signature and description in llms-full.txt', EXPORTS.length >= 29 && missing.length === 0, missing.join(', ') || `${EXPORTS.length} exports`)

// the diagrams a page draws are the supported (flowchart, graph, sequenceDiagram) ```mermaid fences at its top level (fences inside a longer
// fence, like the Markdown tab of a code group, are source shown as text, not diagrams)
function drawnFences(md) {
  let n = 0; const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^(`{3,})(.*)$/.exec(lines[i]); if (!m) continue
    const body = []; i++
    while (i < lines.length && !(lines[i].startsWith(m[1]) && lines[i].trim() === m[1])) body.push(lines[i++])
    if (/^mermaid(\s|$)/.test(m[2].trim()) && /^\s*(flowchart|graph|sequenceDiagram)\b/.test(body.join('\n').replace(/^\s*---[ \t]*\n[\s\S]*?\n---[ \t]*\n/, '').replace(/^(\s*%%[^\n]*\n)+/, ''))) n++
  }
  return n
}
const mdOf = u => u === '/docs/' ? '/docs/index.md' : u === '/docs/api/' ? '/docs/api.md' : u + '.md'

// ---- a recording stand-in for an OpenTelemetry SDK: @opentelemetry/api finds it on its global and every tracer records into window.__spans
const OTEL_VERSION = JSON.parse(fs.readFileSync(path.join(root, 'docs/node_modules/@opentelemetry/api/package.json'), 'utf8')).version
const recordSpans = version => {
  const spans = window.__spans = []
  const startSpan = (name, opts = {}) => {
    const s = { name, attributes: { ...(opts.attributes ?? {}) }, status: 0, message: '', ended: false, events: [] }
    spans.push(s)
    const span = {
      spanContext: () => ({ traceId: '0123456789abcdef0123456789abcdef', spanId: '0123456789abcdef', traceFlags: 1 }),
      setAttribute(k, v) { s.attributes[k] = v; return span }, setAttributes(a) { Object.assign(s.attributes, a); return span },
      addEvent(n) { s.events.push(n); return span }, addLink() { return span }, addLinks() { return span },
      setStatus(st) { s.status = st.code; s.message = st.message ?? ''; return span }, updateName(n) { s.name = n; return span },
      end() { s.ended = true }, isRecording: () => true, recordException() {},
    }
    return span
  }
  const tracer = { startSpan, startActiveSpan(name, ...a) { const fn = a[a.length - 1]; return fn(startSpan(name, typeof a[0] === 'object' ? a[0] : {})) } }
  globalThis[Symbol.for('opentelemetry.js.api.1')] = { version, trace: { getTracer: () => tracer } }
}
const spans = page => page.evaluate(() => window.__spans.map(s => ({ name: s.name, status: s.status, message: s.message, ended: s.ended, attributes: s.attributes })))

// ---- pages in a browser
const launch = () => chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
const browser = await launch()
const pageUrls = ['/docs/', ...entries.map(e => e.md.replace(/\.md$/, '').replace(/^\/docs\/api$/, '/docs/api/'))].filter((u, i, a) => a.indexOf(u) === i && u !== '/docs/index')
let diagrams = 0, pagesWith = 0
async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], ...opts })
  await ctx.addInitScript(recordSpans, OTEL_VERSION)
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()) })
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`) })
  await page.goto(base + url, { waitUntil: 'load' })
  return { page, errors, ctx }
}
async function allDrawn(page) {
  await page.waitForLoadState('networkidle').catch(() => {}) // the script-tag demo adds its element once bonkei.global.js has loaded
  await page.waitForTimeout(500)
  const total = await page.locator('.bonkei-diagram').count()
  const drew = !total || await page.waitForFunction(n => [...document.querySelectorAll('.bonkei-diagram')].filter(e => e.querySelector('[data-bonkei=ready] canvas') || (e.matches('[data-bonkei=ready]') && e.querySelector('canvas'))).length + document.querySelectorAll('[data-bonkei=error]').length >= n, total, { timeout: 90000 }).then(() => true, () => false)
  return { total, drew }
}
async function copyPage(page, u, label) {
  await page.locator('.markdown-copy-buttons button.copy-page').first().click()
  await page.waitForFunction(() => /Copied/.test(document.querySelector('.markdown-copy-buttons button.copy-page')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {})
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  const md = (await text(mdOf(u))).body
  ok(`copy as Markdown (${label}): the clipboard holds the page's .md, exactly`, clip.length > 100 && clip === md, clip.slice(0, 60).replace(/\n/g, ' '))
  const s = (await spans(page)).filter(s => s.name === 'bonkei.docs.copy_markdown')
  ok(`telemetry (${label}): Copy page is a bonkei.docs.copy_markdown span`, s.length === 1 && s[0].attributes['bonkei.docs.action'] === 'copy' && s[0].attributes['bonkei.docs.page'] === u, JSON.stringify(s))
}

for (const u of pageUrls) {
  const { page, errors, ctx } = await open(u)
  const { total, drew } = await allDrawn(page)
  if (total) await page.waitForTimeout(400)
  const fences = drawnFences((await text(mdOf(u))).body)
  ok(`page ${u}: every diagram is a mermaid fence in its .md (${total} drawn, ${fences} fences)`, total === fences)
  const cards = await page.locator('[data-bonkei=error]').count()
  const wantCards = u.endsWith('/guide/errors') ? 1 : 0
  diagrams += total; if (total) pagesWith++
  ok(`page ${u}: ${total} diagram(s) draw, no console errors`, drew && cards === wantCards && errors.length === 0, errors.slice(0, 2).join(' | ') || (cards !== wantCards ? `${cards} error cards, wanted ${wantCards}` : ''))
  if (u.endsWith('/guide/diagram-types')) {
    const pie = page.locator('div.language-mermaid')
    ok('diagram types: flowchart, sequence and the playground draw, the pie fence is a code block', total === 3 && await pie.count() === 1 && /pie title Pets/.test(await pie.innerText()) && errors.length === 0)
  }
  if (u === '/docs/' || u.endsWith('/guide/introduction')) {
    // the playground: editing the Mermaid redraws the diagram; a broken edit shows the problem and keeps the last diagram
    const box = page.locator('.bonkei-playground .bonkei-diagram').first()
    const shot = () => box.screenshot().then(b => b.toString('base64'))
    const first = await shot()
    await page.locator('.bonkei-editor').first().fill('flowchart LR\n  Edited --> Live --> Diagram')
    await page.waitForFunction(() => window.__spans.some(s => s.name === 'bonkei.docs.playground.edit' && s.ended), null, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const second = await shot()
    ok(`playground ${u}: editing the Mermaid changes the diagram`, first !== second)
    await page.locator('.bonkei-editor').first().fill('flowchart TD\n  --> -->')
    await page.waitForFunction(() => document.querySelector('.bonkei-problems li'), null, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const problem = await page.locator('.bonkei-problems li').first().innerText().catch(() => '')
    // a failed update keeps the scene (its canvas) and lays Bonkei's "Not updated" strip over it, instead of the error card in its place
    const kept = await box.evaluate(e => !!e.querySelector('canvas') && /Not updated/.test(e.innerText))
    ok(`playground ${u}: a broken edit reports the problem under the editor and keeps the last diagram`, /parse|line/i.test(problem) && kept && errors.length === 0, problem.slice(0, 80))
    const s = (await spans(page)).filter(s => s.name === 'bonkei.docs.playground.edit')
    ok(`telemetry ${u}: each playground edit is a bonkei.docs.playground.edit span, the broken one with status ERROR`, s.length === 2 && s[0].status !== 2 && s[0].ended && s[0].attributes['bonkei.nodes'] === 3 && s[1].status === 2 && /parse|line/i.test(s[1].message), JSON.stringify(s.map(x => [x.status, x.message])))
    // an edit that draws with a warning (a line Bonkei does not support yet) keeps the warning under the editor once the diagram is ready
    await page.locator('.bonkei-editor').first().fill('flowchart LR\n  A --> B\n  click A callback')
    await page.waitForFunction(() => window.__spans.filter(s => s.name === 'bonkei.docs.playground.edit' && s.ended).length >= 3, null, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(500)
    const warned = await page.locator('.bonkei-problems li').allInnerTexts()
    ok(`playground ${u}: a warning stays under the editor after the diagram draws`, warned.length === 1 && /^warning, line 3:/.test(warned[0]), JSON.stringify(warned))
  }
  if (u === '/docs/') {
    const cards = await page.locator('.VPFeature').allInnerTexts()
    const want = ['<Bonkei />', 'render(element, source)', '<bonkei-diagram>', 'mermaid fences']
    ok('home: the four cards say what each way in is, whole', cards.length === 4 && want.every((w, i) => cards[i]?.includes(w)), JSON.stringify(cards))
    await copyPage(page, u, 'home')
  }
  if (u.endsWith('/guide/edge-styles')) await copyPage(page, u, 'Edge styles')
  if (u.endsWith('/guide/script-tag')) {
    const s = (await spans(page)).filter(s => s.name === 'bonkei.docs.script_tag.load')
    ok('telemetry: the script-tag demo\'s load is a bonkei.docs.script_tag.load span', s.length === 1 && s[0].ended && s[0].status !== 2)
  }
  await ctx.close()
}
ok(`all pages: ${diagrams} diagrams on ${pagesWith} pages drew`, diagrams >= 40)

// ---- phone and tablets: no sideways scroll, diagrams fit the width; the nav folds into a menu on the phone; a tap and a touch drag move a diagram
for (const [w, h] of [[390, 844], [820, 1180], [1024, 768]]) {
  for (const u of ['/docs/', '/docs/guide/edge-styles', '/docs/guide/options', '/docs/api/functions/render', '/docs/reference/vitepress-plugin']) {
    const { page, ctx } = await open(u, { viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 1024 })
    await allDrawn(page)
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, iw: innerWidth,
      wide: [...document.querySelectorAll('.bonkei-diagram')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length,
      burger: getComputedStyle(document.querySelector('.VPNavBarHamburger') ?? document.body).display !== 'none' && !!document.querySelector('.VPNavBarHamburger'),
      navLinks: getComputedStyle(document.querySelector('.VPNavBarMenu') ?? document.body).display,
    }))
    const folded = w >= 768 || (m.burger && m.navLinks === 'none')
    ok(`${w} px ${u}: no sideways scroll, diagrams fit the width${w < 768 ? ', nav folded into a menu' : ''}`, m.sw <= m.iw + 1 && m.wide === 0 && folded, JSON.stringify(m))
    if (w === 390 && u.endsWith('/guide/edge-styles')) {
      // a tap takes hold of the first diagram, then a one-finger drag across it moves it (Chrome's touch emulation, the closest an
      // automated run gets to a phone). Before the tap the page keeps one finger for its scrolling (BON-78).
      const box = page.locator('.bonkei-diagram').first()
      await box.scrollIntoViewIfNeeded()
      const r = await box.boundingBox()
      const cdp = await ctx.newCDPSession(page)
      const y = r.y + r.height / 2, pt = x => [{ x, y, id: 1 }]
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(r.x + r.width * 0.3) })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(300)
      ok('390 px: a tap takes hold of a diagram', await box.locator('[data-bonkei-held]').count() === 1)
      const before = await box.screenshot()
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(r.x + r.width * 0.3) })
      for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(r.x + r.width * (0.3 + i * 0.04)) })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(800)
      ok('390 px: a touch drag across a held diagram moves it', !before.equals(await box.screenshot()))
    }
    await ctx.close()
  }
}
await browser.close()
console.log(`\n${results.filter(Boolean).length}/${results.length} checks ok`)

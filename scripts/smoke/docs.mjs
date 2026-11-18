// Smoke test for the docs (BON-127). Usage: node scripts/smoke/docs.mjs <base url of a served dist/, e.g. http://localhost:6300>
//  - bonkei and @bonkei/vitepress in docs/node_modules are the installed tarball copies (no symlink into packages/*, no src/)
//  - llms.txt lists every page with a description, llms-full.txt holds every page, each page has a .md with mermaid fences
//  - every page opens with no console errors; every diagram on it draws (a canvas inside [data-bonkei=ready]); the errors page has its one
//    intended error card; the diagram-types page draws 2 and shows the pie as a code block
//  - the Edge styles page: Copy as Markdown puts the page's Markdown on the clipboard
//  - at 390 px no page scrolls sideways (code blocks and wide tables scroll inside themselves), and the nav folds into a menu
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base) { console.error('usage: node scripts/smoke/docs.mjs <base url>'); process.exit(2) }
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
    ok(`installed: ${n} has no src/ (the packed "files" only)`, n === '@bonkei/vitepress' ? fs.existsSync(path.join(p, 'src/index.js')) && !fs.existsSync(path.join(p, 'src/index.test.js')) : !fs.existsSync(path.join(p, 'src')) && fs.existsSync(path.join(p, 'dist/index.js')))
  }
}

// ---- agents: llms.txt, llms-full.txt, .md
const text = async p => { const r = await fetch(base + p); return { status: r.status, body: await r.text() } }
const llms = await text('/docs/llms.txt'), full = await text('/docs/llms-full.txt')
const entries = [...llms.body.matchAll(/^- \[([^\]]+)\]\(https:\/\/bonkei\.dev(\/docs\/[^)]*\.md)\)(: (.+))?$/gm)].map(m => ({ title: m[1], md: m[2], desc: m[4] }))
ok('agents: llms.txt lists pages, each with a description', llms.status === 200 && entries.length >= 40 && entries.every(e => e.desc && e.desc.length > 20), `${entries.length} pages, ${entries.filter(e => !e.desc).length} without a description`)
const mdPages = []
for (const e of entries) { const r = await text(e.md.replace('/docs/api.md', '/docs/api.md')); mdPages.push([e, r]) }
ok('agents: every listed page has a .md beside it', mdPages.every(([, r]) => r.status === 200 && r.body.length > 50), mdPages.filter(([, r]) => r.status !== 200).map(([e]) => e.md).join(', '))
ok('agents: llms-full.txt holds every listed page', full.status === 200 && mdPages.every(([e]) => full.body.includes(`url: https://bonkei.dev${e.md}`)), `${full.body.length} bytes`)
const edge = mdPages.find(([e]) => e.md.endsWith('/guide/edge-styles.md'))?.[1].body ?? ''
ok('agents: the Edge styles .md has its diagrams as mermaid fences and no HTML chrome', (edge.match(/```mermaid/g) ?? []).length >= 9 && !/<nav|<header|<script|<aside/.test(edge))
const EXPORTS = ['Bonkei', 'render', 'isBonkeiError', 'CLASSIC', 'BONKEI', 'BONKEI_LANDSCAPE', 'THEME_NAMES', 'BonkeiProps', 'BonkeiViewHandle', 'BonkeiHandle', 'BonkeiOptions', 'DiagramOptions', 'Controls', 'Theme', 'BonkeiError', 'BonkeiWarning', 'NodeClick', 'ReadyInfo', 'Mode', 'LabelMode', 'Graph', 'GraphInput', 'GNode', 'GGroup', 'GEdge', 'Shape', 'Dropped', 'CrossingStyle', 'AvoidCrossings']
const missing = EXPORTS.filter(n => !new RegExp(`^# (Function|Variable|Interface|Type Alias): ${n}(\\(\\))?$`, 'm').test(full.body))
ok('agents: every public export has its page in llms-full.txt (signature and description)', missing.length === 0, missing.join(', ') || `${EXPORTS.length} exports`)

// ---- pages in a browser
const launch = () => chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
const browser = await launch()
const pageUrls = ['/docs/', ...entries.map(e => e.md.replace(/\.md$/, '').replace(/^\/docs\/api$/, '/docs/api/'))]
let diagrams = 0, pagesWith = 0
async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], ...opts })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()) })
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`) })
  await page.goto(base + url, { waitUntil: 'load' })
  return { page, errors, ctx }
}
for (const u of pageUrls) {
  const { page, errors, ctx } = await open(u)
  const total = await page.locator('.bonkei-diagram').count()
  let drew = true
  if (total) {
    drew = await page.waitForFunction(n => [...document.querySelectorAll('.bonkei-diagram')].filter(e => e.querySelector('[data-bonkei=ready] canvas') || e.matches('[data-bonkei=ready]') && e.querySelector('canvas')).length + document.querySelectorAll('[data-bonkei=error]').length >= n, total, { timeout: 90000 }).then(() => true, () => false)
    await page.waitForTimeout(400)
  }
  const cards = await page.locator('[data-bonkei=error]').count()
  const wantCards = u.endsWith('/guide/errors') ? 1 : 0
  diagrams += total; if (total) pagesWith++
  ok(`page ${u}: ${total} diagram(s) draw, no console errors`, drew && cards === wantCards && errors.length === 0, errors.slice(0, 2).join(' | ') || (cards !== wantCards ? `${cards} error cards, wanted ${wantCards}` : ''))
  if (u.endsWith('/guide/diagram-types')) {
    ok('diagram types: flowchart and sequence draw, the pie fence is a code block', total === 2 && await page.locator('div.language-mermaid').count() === 1 && /pie title Pets/.test(await page.locator('div.language-mermaid').innerText()))
  }
  if (u.endsWith('/guide/edge-styles')) {
    await page.locator('button:has-text("Copy")').first().click()
    await page.waitForTimeout(500)
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    ok('copy as Markdown: the clipboard holds the page\'s Markdown', clip.includes('# Edge styles') && clip.includes('```mermaid') && clip.includes('crossings: bridge'), clip.slice(0, 60).replace(/\n/g, ' '))
  }
  await ctx.close()
}
ok(`all pages: ${diagrams} diagrams on ${pagesWith} pages drew`, true)

// ---- phone: no sideways scroll, nav folds
for (const u of ['/docs/', '/docs/guide/edge-styles', '/docs/guide/options', '/docs/api/functions/render', '/docs/reference/vitepress-plugin']) {
  const { page, errors, ctx } = await open(u, { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, burger: !!document.querySelector('.VPNavBarHamburger'), navLinks: getComputedStyle(document.querySelector('.VPNavBarMenu') ?? document.body).display }))
  ok(`phone 390 ${u}: no sideways scroll, nav folded into a menu`, m.sw <= m.iw + 1 && m.burger && m.navLinks === 'none', JSON.stringify(m))
  await ctx.close()
}
await browser.close()
console.log(`\n${results.filter(Boolean).length}/${results.length} checks ok`)

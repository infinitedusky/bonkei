// Opens a page in Playwright and checks that its Bonkei diagrams drew and libavoid routed their lines (BON-52): one in the default look,
// one in the Bonkei theme, whose labels use the bundled font (BON-159). The page reports each in window.__diagrams[name].
// Locally it uses the installed Chrome (plain headless Chromium draws WebGL blank on some Macs); in CI, SMOKE_CHROMIUM=bundled
// uses Playwright's own Chromium with SwiftShader.
import net from 'node:net'
import { chromium } from 'playwright'

/** A free TCP port above 6200, so a smoke run never meets a port something else on the machine is using. */
export async function freePort() {
  for (let i = 0; i < 50; i++) {
    const port = 6200 + Math.floor(Math.random() * 2000)
    const ok = await new Promise(res => { const s = net.createServer().once('error', () => res(false)).listen(port, () => s.close(() => res(true))) })
    if (ok) return port
  }
  throw new Error('no free port above 6200')
}

const DIAGRAMS = ['default', 'bonkei']
// fonts/ZenOldMincho-Bold-latin.ttf beside the module or the script, or assets/ZenOldMincho-Bold-latin-<hash>.ttf in a host build
const FONT = /\/(ZenOldMincho-Bold|ArchitectsDaughter-Regular)-latin(-[\w-]+)?\.ttf(\?|$)/

/**
 * @param {string} url
 * @param {{ label: string, expectElkRequest?: boolean, expectFallback?: boolean, font?: 'file' | 'fallback', shot?: string }} o
 * expectFallback: the wasm is missing on purpose; the diagram must still draw, with routingError saying why.
 * font 'file' (default): the font file was fetched with status 200 and no diagram warned about it. 'fallback': the file is not
 * reachable (Vite 5 dev); the Bonkei diagram must still draw (onReady) with drei's default font, and warn that it did.
 */
export async function check(url, { label, expectElkRequest = true, expectFallback = false, font = 'file', shot } = {}) {
  const browser = await chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
  const requests = []
  const fontResponses = []
  const errors = []
  page.on('request', r => requests.push(r.url()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()) })
  page.on('response', r => {
    if (FONT.test(r.url())) fontResponses.push({ status: r.status(), url: r.url().replace(/^https?:\/\/[^/]+/, '') })
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`)
  })
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForFunction(names => window.__error || names.every(n => window.__diagrams?.[n]?.stats && window.__diagrams[n].ready), DIAGRAMS, { timeout: 60000 }).catch(() => {})
  const ms = Date.now() - t0
  const { diagrams, error } = await page.evaluate(() => ({ diagrams: window.__diagrams ?? {}, error: window.__error ?? null }))
  const canvas = await page.locator('canvas').count()
  const timing = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /wasm|elk/i.test(e.name)).map(e => ({ name: e.name.split('/').pop().slice(0, 60), ms: Math.round(e.responseEnd - e.startTime), kb: Math.round(e.transferSize / 1024) })))
  if (shot) await page.screenshot({ path: shot })
  await browser.close()
  const fails = []
  if (error) fails.push(`error: ${error}`)
  if (canvas < DIAGRAMS.length) fails.push(`${canvas} canvases for ${DIAGRAMS.length} diagrams`)
  for (const n of DIAGRAMS) {
    const d = diagrams[n], stats = d?.stats
    if (!d?.ready) fails.push(`${n}: no first frame (onReady)`)
    if (!stats) fails.push(`${n}: no route stats`)
    else if (expectFallback) {
      if (!stats.routingError) fails.push(`${n}: the wasm was missing on purpose, but routingError is empty`)
    } else {
      if (stats.routingError) fails.push(`${n}: libavoid fell back to ELK routes: ${stats.routingError}`)
      if (!(stats.routerBuildMs > 0)) fails.push(`${n}: routerBuildMs ${stats.routerBuildMs}: libavoid did not route`)
      if (stats.unroutable) fails.push(`${n}: ${stats.unroutable} lines unroutable`)
    }
  }
  const fontWarnings = Object.values(diagrams).flatMap(d => d.warnings ?? []).filter(w => /^font /.test(w))
  if (font === 'file') {
    if (!fontResponses.some(r => r.status === 200)) fails.push(`the font file was not fetched with status 200: ${JSON.stringify(fontResponses)}`)
    if (fontWarnings.length) fails.push(`font warning: ${fontWarnings[0]}`)
  } else if (!fontWarnings.length) fails.push('the font was expected to fall back to the default, but no diagram warned about it')
  const wasmReq = requests.filter(u => /\.wasm(\?|$)|^data:application\/wasm/.test(u))
  if (!wasmReq.length) fails.push('no wasm request')
  if (expectElkRequest && !requests.some(u => /elk/i.test(u))) fails.push('no ELK chunk request')
  // which path found the wasm: the lazy base64 chunk was fetched (inline), or the file itself was (url)
  const wasmSource = requests.some(u => /_libavoid-inline/.test(u)) ? 'inline (lazy base64 chunk)' : 'url (libavoid.wasm file)'
  for (const n of DIAGRAMS) {
    const stats = diagrams[n]?.stats
    console.log(`[${label}] ${fails.length ? 'FAIL' : 'ok'} ${n}: canvas=${canvas} ready=${!!diagrams[n]?.ready} routingError=${stats?.routingError} routerBuildMs=${stats?.routerBuildMs?.toFixed?.(1)} routeMs=${stats?.routeMs?.toFixed?.(1)} allReady=${ms}ms`)
  }
  console.log(`[${label}] font: ${fontResponses.map(r => `${r.status} ${r.url}`).join(', ') || 'not requested'}${fontWarnings.length ? ` · fell back: ${fontWarnings[0]}` : ''}`)
  if (!expectFallback) console.log(`[${label}] wasm found via: ${wasmSource}`)
  console.log(`[${label}] loaded:`, JSON.stringify(timing), 'wasm url:', wasmReq.map(u => u.replace(/^https?:\/\/[^/]+/, '').slice(0, 80)))
  if (errors.length) console.log(`[${label}] console errors:`, errors.slice(0, 3))
  if (fails.length) { console.error(`[${label}] ${fails.join('; ')}`); process.exitCode = 1 }
  return { diagrams, requests, timing, fails, wasmSource, fontResponses, fontWarnings }
}

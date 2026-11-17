// Opens a page in Playwright and checks that a Bonkei diagram drew and libavoid routed its lines.
// Locally it uses the installed Chrome (plain headless Chromium draws WebGL blank here); in CI, SMOKE_CHROMIUM=bundled uses Playwright's own.
import { chromium } from 'playwright'

export async function check(url, { label, expectElkRequest = true, shot } = {}) {
  const browser = await chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
  const requests = []
  const errors = []
  page.on('request', r => requests.push(r.url()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__stats || window.__error, null, { timeout: 60000 })
  const ms = Date.now() - t0
  const { stats, error } = await page.evaluate(() => ({ stats: window.__stats ?? null, error: window.__error ?? null }))
  const canvas = await page.locator('canvas').count()
  const timing = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /wasm|elk/i.test(e.name)).map(e => ({ name: e.name.split('/').pop().slice(0, 60), ms: Math.round(e.responseEnd - e.startTime), kb: Math.round(e.transferSize / 1024) })))
  if (shot) await page.screenshot({ path: shot })
  await browser.close()
  const fails = []
  if (error) fails.push(`error: ${error}`)
  if (!canvas) fails.push('no canvas')
  if (!stats) fails.push('no route stats')
  else {
    if (stats.routingError) fails.push(`libavoid fell back to ELK routes: ${stats.routingError}`)
    if (!(stats.routerBuildMs > 0)) fails.push(`routerBuildMs ${stats.routerBuildMs}: libavoid did not route`)
    if (stats.unroutable) fails.push(`${stats.unroutable} lines unroutable`)
  }
  const wasmReq = requests.filter(u => /\.wasm(\?|$)|^data:application\/wasm/.test(u))
  if (!wasmReq.length) fails.push('no wasm request')
  if (expectElkRequest && !requests.some(u => /elk/i.test(u))) fails.push('no ELK chunk request')
  console.log(`[${label}] ${fails.length ? 'FAIL' : 'ok'}: canvas=${canvas} routingError=${stats?.routingError} routerBuildMs=${stats?.routerBuildMs?.toFixed?.(1)} routeMs=${stats?.routeMs?.toFixed?.(1)} firstStats=${ms}ms`)
  console.log(`[${label}] loaded:`, JSON.stringify(timing), 'wasm url:', wasmReq.map(u => u.replace(/^https?:\/\/[^/]+/, '')))
  if (errors.length) console.log(`[${label}] console errors:`, errors.slice(0, 3))
  if (fails.length) { console.error(`[${label}] ${fails.join('; ')}`); process.exitCode = 1 }
  return { stats, requests, timing, fails }
}

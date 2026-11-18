// The quieter defaults in a fresh app (BON-161): a second page the Vite smoke test writes into its temp copy of examples/vite
// (never into examples/vite itself). Five made-up diagrams of one crossing sample: no options, mode="iso", mode: 3d in the
// frontmatter, crossingControls, and crossings="bridge" avoidCrossings="off" without controls. checkDefaults reads each case's
// toolbar from the DOM and its EdgeStats from window.__cases[name].
import { chromium } from 'playwright'

export const DEFAULTS_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Bonkei defaults</title></head>
  <body style="margin:0"><div id="root"></div><script type="module" src="/src/defaults.tsx"></script></body>
</html>
`

// Inside this template string, \\n becomes \n in the written file, so the TSX holds escaped newlines in plain string literals.
export const DEFAULTS_TSX = `import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { Bonkei, type BonkeiProps } from 'bonkei'

// Made-up sample: two sources that each feed three sinks, so their lines cross with avoidCrossings off (the same sample as core's
// BridgesWithoutControls story; with two sinks the router finds no crossing and there is nothing to bridge).
const X = 'flowchart TD\\n  A --> C\\n  A --> D\\n  B --> C\\n  B --> D\\n  A --> E\\n  B --> E'
const THREE_D = '---\\nconfig:\\n  bonkei:\\n    mode: 3d\\n---\\n' + X

// What checkDefaults reads, per case: whether the first frame was drawn and the latest edge stats.
const report = (name: string): Partial<BonkeiProps> => {
  const w = window as any
  const c = ((w.__cases ??= {})[name] ??= { ready: false, stats: null })
  return {
    onReady: () => { c.ready = true },
    onEdgeStats: s => { c.stats = s },
    onError: e => { w.__error = name + ': ' + e.message },
  }
}

const box = (name: string, wide: boolean, child: ReactNode) => (
  <div data-case={name} style={{ position: 'relative', height: 300, gridColumn: wide ? '1 / -1' : undefined, border: '1px solid #ddd' }}>{child}</div>
)

function Defaults() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8 }}>
      {box('none', false, <Bonkei source={X} {...report('none')} />)}
      {box('iso', false, <Bonkei source={X} mode="iso" {...report('iso')} />)}
      {box('3d', false, <Bonkei source={THREE_D} {...report('3d')} />)}
      {box('bridge', false, <Bonkei source={X} crossings="bridge" avoidCrossings="off" {...report('bridge')} />)}
      {box('controls', true, <Bonkei source={X} crossingControls {...report('controls')} />)}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Defaults />)
`

const CASES = ['none', 'iso', '3d', 'controls', 'bridge']
const VIEW = { none: 'Flat', iso: 'Iso', '3d': '3D', controls: 'Flat', bridge: 'Flat' }

/** Opens `${url}defaults.html` and checks each case's starting view, the default toolbar's buttons and the opt-in crossing controls. */
export async function checkDefaults(url) {
  const browser = await chromium.launch(process.env.SMOKE_CHROMIUM === 'bundled' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const results = Object.fromEntries(CASES.map(n => [n, { fails: [], info: [] }]))
  const note = []
  try {
    await page.goto(`${url}defaults.html`, { waitUntil: 'load' })
    await page.waitForFunction(names => window.__error || names.every(n => window.__cases?.[n]?.ready && window.__cases[n].stats), CASES, { timeout: 60000 }).catch(() => {})
    const error = await page.evaluate(() => window.__error ?? null)
    if (error) note.push(`error: ${error}`)
    const stats = n => page.evaluate(name => window.__cases?.[name]?.stats ?? null, n)
    for (const n of CASES) {
      const c = page.locator(`[data-case="${n}"]`)
      const { fails, info } = results[n]
      const ready = await page.evaluate(name => !!window.__cases?.[name]?.ready, n)
      if (!ready) fails.push('no first frame (onReady)')
      if (!(await stats(n))) fails.push('no edge stats')
      const view = (await c.locator('[role=radiogroup][aria-label=View] [aria-checked=true]').allTextContents()).map(s => s.trim())
      if (view.length !== 1 || view[0] !== VIEW[n]) fails.push(`starts in ${JSON.stringify(view)}, expected ${VIEW[n]}`)
      else info.push(`starts ${view[0]}`)
      const crossings = await c.locator('[aria-label=Crossings]').count()
      const avoid = await c.locator("[aria-label='Avoid crossings']").count()
      if (n === 'none') {
        const labels = (await c.locator('button').allTextContents()).map(s => s.trim())
        if (JSON.stringify(labels) !== JSON.stringify(['Flat', 'Iso', '3D', 'Fit'])) fails.push(`buttons ${JSON.stringify(labels)}, expected Flat, Iso, 3D, Fit`)
        else info.push(`${labels.length} buttons (${labels.join(', ')})`)
      }
      if (n === 'none' || n === 'bridge') {
        if (crossings || avoid) fails.push(`crossing groups shown without crossingControls (Crossings ${crossings}, Avoid crossings ${avoid})`)
        else info.push('no Crossings or Avoid crossings group')
      }
      if (n === 'bridge') {
        const s = await stats(n)
        if (!(s?.bridge > 0)) fails.push(`bridge ${s?.bridge} with crossings="bridge" avoidCrossings="off" (crossings ${s?.crossings})`)
        else info.push(`bridge ${s.bridge}`)
      }
      if (n === 'controls') {
        if (crossings !== 1 || avoid !== 1) { fails.push(`with crossingControls: Crossings ${crossings}, Avoid crossings ${avoid}, expected both`); continue }
        info.push('both groups present')
        await c.locator("[aria-label='Avoid crossings'] button", { hasText: /^Off$/ }).click()
        const off = await page.waitForFunction(() => window.__cases.controls.stats?.avoidCrossings === 'off', null, { timeout: 30000 }).then(() => true, () => false)
        if (!off) { fails.push(`clicking Off: avoidCrossings stayed ${(await stats(n))?.avoidCrossings}`); continue }
        await c.locator('[aria-label=Crossings] button', { hasText: /^Bridge$/ }).click()
        const bridged = await page.waitForFunction(() => window.__cases.controls.stats?.bridge > 0, null, { timeout: 30000 }).then(() => true, () => false)
        const s = await stats(n)
        if (!bridged) fails.push(`clicking Bridge: bridge ${s?.bridge} (crossings ${s?.crossings})`)
        else info.push(`Off then Bridge gives bridge ${s.bridge}`)
      }
    }
  } finally {
    await browser.close()
  }
  let failed = note.length > 0
  if (note.length) console.error(`[defaults] FAIL ${note.join('; ')}`)
  for (const n of CASES) {
    const { fails, info } = results[n]
    if (fails.length) { failed = true; console.error(`[defaults] FAIL ${n}: ${fails.join('; ')}`) } else console.log(`[defaults] ok ${n}: ${info.join(', ')}`)
  }
  if (failed) process.exitCode = 1
  return { failed, results }
}

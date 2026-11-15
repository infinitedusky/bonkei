import { createRequire } from 'module'
const { chromium } = createRequire(import.meta.url)('/Users/the_dusky/code/bonkei-worktrees/prototype--react-flow-adapter-bonkei3d-fast-rough-z4fh/node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core')
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'], headless: false })
for (const h of ['visibility', 'display']) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
  p.on('pageerror', e => console.log(h, 'pageerror', e.message.slice(0, 200)))
  p.on('console', m => { if (/warn|error/.test(m.type()) && !/404/.test(m.text())) console.log(h, m.type(), m.text().slice(0, 200)) })
  await p.goto('http://localhost:60878/app/reactflow.html?hide=' + h); await p.waitForTimeout(4000)
  console.log(h, await p.evaluate(() => ({ layout: window.__layout ? window.__layout.boxes.length : null, text: document.body.innerText.split('\n').filter(l => /first 3D|waiting/.test(l)).join(' | '), measured: [...document.querySelectorAll('.react-flow__node')].map(n => n.offsetWidth).join(',') })))
  await p.screenshot({ path: '/tmp/rfshots/hide-' + h + '.png' })
  await p.close()
}
await b.close()

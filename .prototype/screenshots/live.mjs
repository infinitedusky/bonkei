import { createRequire } from 'module'
const { chromium } = createRequire(import.meta.url)('/Users/the_dusky/code/bonkei-worktrees/prototype--react-flow-adapter-bonkei3d-fast-rough-z4fh/node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core')
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal','--ignore-gpu-blocklist'], headless: false })
const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)))
await p.goto('http://localhost:60878/app/reactflow.html'); await p.waitForTimeout(3500)
const L = () => p.evaluate(() => { const l = window.__layout; return { boxes: l.boxes.length, routes: l.routes.length, c1: l.boxes.find(b => b.id === 'c1') && [l.boxes.find(b => b.id === 'c1').x, l.boxes.find(b => b.id === 'c1').y] } })
console.log('initial', JSON.stringify(await L()), '(11 nodes incl. 1 hidden, 9 edges incl. 1 hidden => expect 10 boxes, 8 routes)')
// 5: pan/zoom camera in 3D, then drag in 2D
const right = { x: 1200, y: 600 }
await p.mouse.move(right.x, right.y); await p.mouse.wheel(0, -600); await p.waitForTimeout(800)
await p.screenshot({ path: '/tmp/rfshots/cam-before.png' })
// real 2D drag of the Validate card
const card = p.locator('.react-flow__node[data-id="c1"]')
const bb = await card.boundingBox()
await p.mouse.move(bb.x + 40, bb.y + 20); await p.mouse.down()
for (let i = 1; i <= 20; i++) { await p.mouse.move(bb.x + 40 + i * 5, bb.y + 20 - i * 6); await p.waitForTimeout(16) }
const mid = await L(); 
await p.mouse.up(); await p.waitForTimeout(500)
console.log('after real 2D drag', JSON.stringify(mid), JSON.stringify(await L()))
await p.screenshot({ path: '/tmp/rfshots/cam-after.png' })
// add + delete
await p.getByRole('button', { name: '+ node' }).click(); await p.waitForTimeout(1500)
console.log('after + node', JSON.stringify(await L()))
// delete: select c2 in 2D, press Backspace
await p.locator('.react-flow__node[data-id="c2"]').click({ position: { x: 100, y: 40 } }); await p.keyboard.press('Backspace'); await p.waitForTimeout(800)
console.log('after delete c2 (2 edges go with it?)', JSON.stringify(await L()))
// edit data -> single re-raster
const n0 = await p.evaluate(() => window.__bonkei.events.filter(e => e.type === 'rasterized').length)
await p.getByRole('button', { name: 'edit data' }).click(); await p.waitForTimeout(1200)
console.log('edit data re-rasters:', JSON.stringify(await p.evaluate(n => window.__bonkei.events.filter(e => e.type === 'rasterized').slice(n), n0)))
await p.screenshot({ path: '/tmp/rfshots/live-end.png' })
await b.close()

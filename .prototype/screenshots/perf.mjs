import { createRequire } from 'module'
const { chromium } = createRequire(import.meta.url)('/Users/the_dusky/code/bonkei-worktrees/prototype--react-flow-adapter-bonkei3d-fast-rough-z4fh/node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core')
const gpu = process.env.SOFT ? ['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] : ['--use-angle=metal','--ignore-gpu-blocklist','--enable-gpu-rasterization']
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: gpu, headless: !process.env.HEADED })
const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)))
await p.goto('http://localhost:60878/app/reactflow.html?big' + (process.env.HIDE ? '&hide=' + process.env.HIDE : ''))
const fps = async () => p.evaluate(() => (document.body.innerText.match(/(\d+) fps/) || [])[1])
const log = async () => p.evaluate(() => document.body.innerText.split('\n').find(l => /first 3D/.test(l)))
const t0 = Date.now()
for (let i = 0; i < 60; i++) { await p.waitForTimeout(1000); const l = await log(); if (l && /plain-box fallbacks 0\//.test(l)) break }
console.log('settled after ~', Date.now() - t0, 'ms'); console.log(await log()); console.log('idle fps', await fps())
const rz = await p.evaluate(() => { const r = window.__bonkei.events.filter(e => e.type === 'rasterized'); return { n: r.length, sum: r.reduce((a, e) => a + e.ms, 0) } })
console.log('rasterized', rz.n, 'sum of per-node ms', Math.round(rz.sum))
// drag in 2D for 4 s and sample fps
const ev0 = await p.evaluate(() => window.__bonkei.events.length)
const dragP = p.evaluate(() => window.__bonkei.autoDrag(4000))
const samples = []
for (let i = 0; i < 6; i++) { await p.waitForTimeout(600); samples.push(await fps()) }
await dragP
console.log(await log()); console.log('fps while 2D drag', samples.join(' '))
await p.screenshot({ path: '/tmp/rfshots/' + (process.env.OUT || 'big') + '.png' })
await b.close()

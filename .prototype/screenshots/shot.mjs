import { createRequire } from 'module'
const { chromium } = createRequire(import.meta.url)('/Users/the_dusky/code/bonkei-worktrees/prototype--react-flow-adapter-bonkei3d-fast-rough-z4fh/node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core')
const [,, query = '', out = 'a', modeBtn = 'iso', wait = '4000'] = process.argv
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
p.on('console', m => { if (true) console.log('console', m.type(), m.text().slice(0, 300)) })
p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()) })
p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)))
await p.goto('http://localhost:60878/app/reactflow.html' + query)
await p.waitForTimeout(+wait)
if (process.env.NOPIC) { await p.getByRole('button', { name: 'pictures' }).click(); await p.waitForTimeout(1500) }
if (modeBtn !== 'iso') { await p.getByRole('button', { name: modeBtn, exact: true }).click(); await p.waitForTimeout(2500) }
await p.screenshot({ path: '/tmp/rfshots/' + out + '.png' })
console.log(await p.evaluate(() => document.body.innerText.split('\n').filter(l => /first 3D|waiting/.test(l)).join(' | ')))
await b.close()

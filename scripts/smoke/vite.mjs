// Smoke test (BON-52): pack bonkei, install the tarball into a clean copy of examples/vite (what `npm create vite` gives a new user,
// plus bonkei and three), draw a diagram and check libavoid routed it, under `vite dev` and under `vite build` + `vite preview`.
// Two passes: the example as committed (current Vite), then the same app pinned to Vite 5 + plugin-react 4, where dev pre-bundling
// hides the wasm file and bonkei falls back to its inlined chunk. Run after `pnpm --filter bonkei build`.
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { check, freePort } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: { ...process.env, CI: '1' } })
const fail = msg => { console.error(msg); process.exitCode = 1 }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-smoke-'))
const pack = path.join(tmp, 'pack'); fs.mkdirSync(pack)
console.log('tmp:', tmp)

sh(`pnpm pack --pack-destination ${pack}`, path.join(root, 'packages/core'))
const tgz = path.join(pack, fs.readdirSync(pack)[0])
console.log('packed', path.basename(tgz), fs.statSync(tgz).size, 'bytes')

// vite itself, not through npx, so killing the child stops the server
const serve = async (app, args) => {
  const port = await freePort()
  const p = spawn(process.execPath, [path.join(app, 'node_modules/vite/bin/vite.js'), ...args, '--port', String(port), '--strictPort'], { cwd: app, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://localhost:${port}/`); return { p, url: `http://localhost:${port}/` } } catch { await new Promise(r => setTimeout(r, 500)) }
  }
  p.kill('SIGTERM')
  throw new Error(`vite ${args[0]} did not start`)
}
const run = async (app, args, label, shot) => {
  const { p, url } = await serve(app, args)
  try { return await check(url, { label, shot }) } finally { p.kill('SIGTERM') }
}

const variants = [
  { name: 'current vite', pin: null },
  { name: 'vite 5', pin: 'vite@5 @vitejs/plugin-react@4' },
]
const summary = []
for (const v of variants) {
  console.log(`\n===== ${v.name}`)
  const slug = v.name.replace(/\W/g, '-')
  const app = path.join(tmp, slug)
  // the committed example app, copied clean: the same app StackBlitz opens from pkg.pr.new, with bonkei from the tarball
  fs.cpSync(path.join(root, 'examples/vite'), app, { recursive: true, filter: f => !/node_modules|dist$/.test(f) })
  const out = sh(`npm install ${tgz} 2>&1`, app) + (v.pin ? sh(`npm install -D ${v.pin} 2>&1`, app) : '')
  const warn = out.split('\n').filter(l => /peer|ERESOLVE|WARN/i.test(l) && !/deprecated|Unknown env config|install-scripts/i.test(l))
  console.log('npm install output lines about peers/warnings:', warn.length ? warn : 'none')
  if (warn.length) fail('peer warnings on install')
  const ver = n => JSON.parse(fs.readFileSync(path.join(app, 'node_modules', n, 'package.json'), 'utf8')).version
  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
  console.log(`installed: react ${ver('react')}, vite ${ver('vite')}, plugin-react ${ver('@vitejs/plugin-react')}, bonkei from tarball: ${/\.tgz$/.test(pkg.dependencies.bonkei)}`)
  const extra = Object.keys(pkg.dependencies).filter(d => !['bonkei', 'react', 'react-dom', 'three'].includes(d))
  if (extra.length) fail(`the host app needs more than react, react-dom and three: ${extra}`)
  console.log('@opentelemetry/api in app dependencies:', '@opentelemetry/api' in pkg.dependencies, '(installed with bonkei:', fs.existsSync(path.join(app, 'node_modules/@opentelemetry/api')) + ')')
  const vc = fs.readFileSync(path.join(app, 'vite.config.ts'), 'utf8').replace(/\/\/.*/g, '')
  if (!(/plugins: \[react\(\)\]/.test(vc) && !/optimizeDeps|wasm|alias/i.test(vc))) fail('host vite.config.ts has something Bonkei-specific')

  if (!v.pin) {
    console.log('--- tsc in the host app (types for bonkei and bonkei/internal)')
    fs.writeFileSync(path.join(app, 'src/types-check.ts'), `import { Bonkei, render, type BonkeiProps } from 'bonkei'\nimport { parse, layout } from 'bonkei/internal'\nexport const t = [Bonkei, render, parse, layout] as const\nexport type P = BonkeiProps\n`)
    try { console.log(sh('npx tsc -b', app) || 'tsc passed') } catch (e) { fail(e.stdout || e.message) }
  }

  const dev = await run(app, ['dev'], `${v.name} dev`, path.join(tmp, `${slug}-dev.png`))
  console.log('--- vite build')
  const built = sh(`node node_modules/vite/bin/vite.js build`, app)
  console.log(built.split('\n').filter(l => /dist\//.test(l)).join('\n'))
  // ELK must be a chunk of its own, apart from the app's entry chunk
  const assets = fs.readdirSync(path.join(app, 'dist/assets'))
  const elk = assets.filter(f => /^elk\.bundled-.*\.js$/.test(f))
  const entry = assets.filter(f => /^index-.*\.js$/.test(f))
  if (elk.length !== 1) fail(`expected one ELK chunk in the build, found: ${elk}`)
  for (const f of entry) if (fs.readFileSync(path.join(app, 'dist/assets', f), 'utf8').includes('org.eclipse.elk.')) fail(`ELK code inside the entry chunk ${f}`)
  const prod = await run(app, ['preview'], `${v.name} preview`, path.join(tmp, `${slug}-build.png`))
  summary.push(`${v.name}: dev wasm via ${dev.wasmSource}, build wasm via ${prod.wasmSource}`)
}
console.log('\nwasm path taken:\n  ' + summary.join('\n  '))
console.log('screenshots in', tmp)

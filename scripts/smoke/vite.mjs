// Smoke test (BON-52): pack bonkei, install it into a fresh Vite React-TS app with only react, react-dom and three added,
// draw a diagram and check libavoid routed it, under `vite dev` and under `vite build` + `vite preview`.
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { check } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: { ...process.env, CI: '1' } })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-smoke-'))
const pack = path.join(tmp, 'pack'); fs.mkdirSync(pack)
const app = path.join(tmp, 'app')
console.log('tmp:', tmp)

sh(`pnpm pack --pack-destination ${pack}`, path.join(root, 'packages/core'))
const tgz = path.join(pack, fs.readdirSync(pack)[0])
console.log('packed', path.basename(tgz), fs.statSync(tgz).size, 'bytes')

sh(`npm create vite@latest app -- --template react-ts --no-interactive`, tmp)
// latest React that Bonkei's peer range (Fiber's) allows, plus three: nothing else
const out = sh(`npm install react@">=19 <19.4" react-dom@">=19 <19.4" three ${tgz} 2>&1`, app)
const warn = out.split('\n').filter(l => /peer|ERESOLVE|WARN/i.test(l) && !/deprecated|Unknown env config/i.test(l))
console.log('npm install output lines about peers/warnings:', warn.length ? warn : 'none')
if (warn.length) { console.error('peer warnings on install'); process.exitCode = 1 }
const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'))
console.log('app dependencies:', JSON.stringify(pkg.dependencies), '| react installed:', JSON.parse(fs.readFileSync(path.join(app, 'node_modules/react/package.json'), 'utf8')).version)
console.log('@opentelemetry/api in app dependencies:', '@opentelemetry/api' in pkg.dependencies, '(installed transitively:', fs.existsSync(path.join(app, 'node_modules/@opentelemetry/api')) + ')')

fs.writeFileSync(path.join(app, 'src/App.tsx'), `import { Bonkei } from 'bonkei'
const SRC = \`flowchart TD
  A[Client] --> B[API]
  B --> C[(Database)]
  B --> D{Cache}
  D --> C
  subgraph Back[Backend]
    B
    C
  end\`
export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Bonkei source={SRC}
        onEdgeStats={s => { (window as any).__stats = s }}
        onError={e => { (window as any).__error = e.message }} />
    </div>
  )
}
`)
fs.writeFileSync(path.join(app, 'src/main.tsx'), `import { createRoot } from 'react-dom/client'\nimport App from './App'\ncreateRoot(document.getElementById('root')!).render(<App />)\n`)
fs.writeFileSync(path.join(app, 'src/index.css'), 'html,body,#root{margin:0;height:100%}')
const vc = fs.readFileSync(path.join(app, 'vite.config.ts'), 'utf8')
console.log('host vite.config.ts is the template default:', /plugins: \[react\(\)\]/.test(vc) && !/bonkei|optimizeDeps/i.test(vc))

console.log('--- tsc in the host app (types for bonkei and bonkei/internal)')
fs.writeFileSync(path.join(app, 'src/types-check.ts'), `import { Bonkei, render, type BonkeiProps } from 'bonkei'\nimport { parse, layout } from 'bonkei/internal'\nexport const t = [Bonkei, render, parse, layout] as const\nexport type P = BonkeiProps\n`)
try { console.log(sh('npx tsc -b', app) || 'tsc passed') } catch (e) { console.error(e.stdout || e.message); process.exitCode = 1 }

const serve = async (args, port) => {
  const p = spawn('npx', ['vite', ...args, '--port', String(port), '--strictPort'], { cwd: app, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { await fetch(`http://localhost:${port}/`); return p } catch { await new Promise(r => setTimeout(r, 500)) } }
  throw new Error('vite did not start')
}
const stop = p => p.kill('SIGTERM')

let p = await serve(['dev'], 5391)
await check('http://localhost:5391/', { label: 'vite dev', shot: path.join(tmp, 'dev.png') })
stop(p)
console.log('--- vite build')
console.log(sh('npx vite build', app).split('\n').filter(l => /dist\//.test(l)).join('\n'))
p = await serve(['preview'], 5392)
await check('http://localhost:5392/', { label: 'vite preview', shot: path.join(tmp, 'build.png') })
stop(p)
console.log('screenshots in', tmp)

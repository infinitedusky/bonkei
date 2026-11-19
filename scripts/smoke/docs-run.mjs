// The docs' smoke tests in one run (BON-178), run nightly on main (.github/workflows/nightly.yml) and by hand with `pnpm docs:smoke`; not part of `pnpm smoke` (BON-217). Needs packages/core built.
//  1. build the docs from this checkout's packed packages (scripts/build-docs.mjs: pack, npm install the tarballs, TypeDoc, vitepress build)
//  2. docs-coverage.mjs: every export has an API page, every option, event and control a live example in a guide page
//  3. docs-break.mjs: a sample that uses an option Bonkei does not have fails the docs build, and the failure names the page
//  4. serve docs/.vitepress/dist at /docs/ on a free port and run docs.mjs against it (every page, agent files, copy, telemetry, widths)
//  5. docs-getting-started.mjs: the four getting-started pages followed word for word in new empty projects
// SKIP_DOCS_BUILD=1 skips step 1 (the docs were just built).
import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import { freePort } from './check.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const node = (script, args = [], env = {}) => execFileSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
let failed = 0
const step = (name, fn) => { console.log(`\n== docs smoke: ${name}`); try { fn() } catch { failed++; console.error(`docs smoke: ${name} FAILED`) } }

if (!process.env.SKIP_DOCS_BUILD) node('scripts/build-docs.mjs')
step('coverage', () => node('scripts/smoke/docs-coverage.mjs'))
step('a broken sample fails the build', () => node('scripts/smoke/docs-break.mjs'))

const port = await freePort()
const server = spawn(process.execPath, [path.join(root, 'scripts/serve-dist.mjs'), path.join(root, 'docs/.vitepress/dist'), '/docs/'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' })
try {
  for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/docs/`); break } catch { await new Promise(r => setTimeout(r, 250)) } }
  // serve-dist answers a malformed %-escape with 400 and keeps serving (it used to crash on one)
  const bad = await fetch(`http://localhost:${port}/docs/%E0%A4%A`).then(r => r.status, () => 0)
  const after = await fetch(`http://localhost:${port}/docs/`).then(r => r.status, () => 0)
  step('the server survives a malformed URL', () => { console.log(`malformed: ${bad}, then /docs/: ${after}`); if (bad !== 400 || after !== 200) throw new Error() })
  step('every page', () => node('scripts/smoke/docs.mjs', [`http://localhost:${port}`]))
} finally { server.kill('SIGTERM') }
step('getting started, word for word', () => node('scripts/smoke/docs-getting-started.mjs'))

console.log(failed ? `\ndocs smoke: ${failed} step(s) failed` : '\ndocs smoke: all steps ok')
process.exit(failed ? 1 : 0)

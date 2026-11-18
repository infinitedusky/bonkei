// Smoke test (BON-178): a code sample that uses an option Bonkei does not have fails the docs build, and the failure names the sample.
// Works on a copy of docs/ (node_modules linked), so the real pages are never touched: renames `avoidCrossings` to `avoidCrossing` in
// one sample of the Edge styles page at a time (the "From code" render() call, then the React tab's prop), builds, and expects each
// build to fail naming guide/edge-styles.md and the property.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const docs = path.resolve(import.meta.dirname, '../../docs')
const cases = [
  // the "From code" sample: its last line passes `{ crossings, avoidCrossings }` to render(); rename the option there, nowhere else
  ['the render() sample', t => t.replace(/(```ts twoslash\n[\s\S]*?)\{ crossings, avoidCrossings \}/, '$1{ crossings, avoidCrossing: avoidCrossings }')],
  // the React tab of the first example: a <Bonkei /> prop
  ['the React sample', t => t.replace(/(```tsx twoslash \[React\]\n[\s\S]*?)avoidCrossings="off"/, '$1avoidCrossing="off"')],
]
let failed = 0
for (const [name, breakIt] of cases) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-break-'))
  const copy = path.join(tmp, 'docs')
  fs.cpSync(docs, copy, { recursive: true, filter: f => !/node_modules|\.vitepress\/(dist|cache)/.test(f) })
  fs.symlinkSync(path.join(docs, 'node_modules'), path.join(copy, 'node_modules'))
  const page = path.join(copy, 'guide/edge-styles.md')
  const text = fs.readFileSync(page, 'utf8')
  const broken = breakIt(text)
  let good = false, status = 'not built'
  if (broken === text) console.error(`FAIL could not break ${name} (the page changed?)`)
  else {
    fs.writeFileSync(page, broken)
    const r = spawnSync('npx', ['vitepress', 'build'], { cwd: copy, encoding: 'utf8', env: { ...process.env, CI: '1' } })
    const out = r.stdout + r.stderr
    console.log(out.split('\n').filter(l => /Object literal|not exist|file: |\[vitepress\]|Compiler Errors|\[2\d{3}\]|avoidCrossing\b/.test(l)).slice(0, 8).join('\n'))
    good = r.status !== 0 && /edge-styles\.md/.test(out) && /avoidCrossing\b/.test(out)
    status = `exit ${r.status}`
  }
  fs.rmSync(tmp, { recursive: true, force: true }) // the copy (its node_modules is a link, removed as a link)
  console.log(`${good ? 'ok  ' : 'FAIL'} ${name} with a renamed option fails the docs build and the failure names the page (${status})`)
  if (!good) failed++
}
process.exit(failed ? 1 : 0)

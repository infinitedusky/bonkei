// Smoke test (BON-127): a code sample that uses an option Bonkei does not have fails the docs build, and the failure names the sample.
// Works on a copy of docs/ (node_modules linked), so the real pages are never touched: renames `avoidCrossings` to `avoidCrossing` in
// the "From code" sample of the Edge styles page, builds, and expects a failure that names guide/edge-styles.md and the property.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const docs = path.resolve(import.meta.dirname, '../../docs')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonkei-break-'))
const copy = path.join(tmp, 'docs')
fs.cpSync(docs, copy, { recursive: true, filter: f => !/node_modules|\.vitepress\/(dist|cache)/.test(f) })
fs.symlinkSync(path.join(docs, 'node_modules'), path.join(copy, 'node_modules'))
const page = path.join(copy, 'guide/edge-styles.md')
const text = fs.readFileSync(page, 'utf8')
const broken = text.replace("render(document.body, 'flowchart LR\\n  A --> D\\n  B --> C', { crossings, avoidCrossings })", "render(document.body, 'flowchart LR\\n  A --> D\\n  B --> C', { crossings, avoidCrossing: avoidCrossings })")
if (broken === text) { console.error('FAIL could not break the sample (the page changed?)'); process.exit(1) }
fs.writeFileSync(page, broken)
const r = spawnSync('npx', ['vitepress', 'build'], { cwd: copy, encoding: 'utf8', env: { ...process.env, CI: '1' } })
const out = r.stdout + r.stderr
const named = /edge-styles\.md/.test(out) && /avoidCrossing\b/.test(out)
console.log(out.split('\n').filter(l => /Object literal|not exist|file: |\[vitepress\]|Compiler Errors|\[2\d{3}\]/.test(l)).slice(0, 8).join('\n'))
const good = r.status !== 0 && named
console.log(`${good ? 'ok  ' : 'FAIL'} a sample with a renamed option fails the docs build and the failure names the page (exit ${r.status})`)
process.exit(good ? 0 : 1)

// The docs run is nightly, not on pull requests (BON-217): `pnpm smoke` and the PR's smoke job stop at the embeds, `pnpm docs:smoke`
// still runs the docs alone, .github/workflows/nightly.yml runs it on a schedule and by hand with everything it needs, and the run's
// summary names each step's result (docs-summary.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { summaryOf, writeSummary } from './docs-summary.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const read = f => fs.readFileSync(path.join(root, f), 'utf8')
const scripts = JSON.parse(read('package.json')).scripts
const ci = read('.github/workflows/ci.yml')
const nightly = read('.github/workflows/nightly.yml')
// the `run:` commands of a workflow, in order, with the `name:` of their step when it has one
const runs = yml => {
  const out = []
  let name
  for (const line of yml.split('\n')) {
    const n = /^\s*- name:\s*(.+)$/.exec(line)
    if (n) { name = n[1]; continue }
    const r = /^\s*(?:- )?run:\s*(.+)$/.exec(line)
    if (r) { out.push({ name, run: r[1].trim() }); name = undefined }
    else if (/^\s*- /.test(line)) name = undefined
  }
  return out
}

test('pnpm smoke runs the Vite example, the script tag and the embeds, and not the docs', () => {
  assert.equal(scripts.smoke, 'node scripts/smoke/vite.mjs && node scripts/smoke/script-tag.mjs && node scripts/smoke/embeds.mjs')
})

test('pnpm docs:smoke runs the docs run on its own', () => {
  assert.equal(scripts['docs:smoke'], 'node scripts/smoke/docs-run.mjs')
})

test("the PR's smoke job runs pnpm smoke, its step name does not mention the docs, and no PR job runs the docs", () => {
  const smoke = runs(ci).find(r => r.run === 'pnpm smoke')
  assert.ok(smoke, 'ci.yml runs pnpm smoke')
  assert.doesNotMatch(smoke.name ?? '', /docs/i)
  assert.doesNotMatch(ci, /docs:smoke|docs-run/)
})

test('nightly.yml runs on a schedule and by hand', () => {
  assert.match(nightly, /^on:\n(?:\s+.*\n)*?\s+schedule:\n\s+- cron: "[^"]+"\n/m)
  assert.match(nightly, /^\s+workflow_dispatch:\s*$/m)
})

test('nightly.yml sets up everything the docs run needs before it, and every pnpm script it calls exists', () => {
  const steps = runs(nightly).map(r => r.run)
  const at = s => steps.indexOf(s)
  assert.ok(at('pnpm docs:smoke') > -1, 'runs pnpm docs:smoke')
  for (const before of ['pnpm install --frozen-lockfile', 'pnpm --filter bonkei build', 'pnpm exec playwright install --with-deps chromium']) {
    assert.ok(at(before) > -1 && at(before) < at('pnpm docs:smoke'), `${before} runs before the docs run`)
  }
  assert.match(nightly, /run: pnpm docs:smoke\n\s+env:\n\s+SMOKE_CHROMIUM: bundled\n/)
  for (const s of steps) {
    const m = /^pnpm (\w[\w:-]*)/.exec(s)
    if (m && !['install', 'exec'].includes(m[1])) assert.ok(m[1] in scripts, `package.json has a "${m[1]}" script`)
  }
})

test("the summary lists each step's result and how many failed", () => {
  const all = summaryOf([{ name: 'build the docs', ok: true }, { name: 'every page', ok: true }])
  assert.match(all, /\| build the docs \| ok \|\n\| every page \| ok \|/)
  assert.match(all, /All 2 steps ok\./)
  const one = summaryOf([{ name: 'coverage', ok: true }, { name: 'every page', ok: false }])
  assert.match(one, /\| every page \| \*\*FAILED\*\* \|/)
  assert.match(one, /1 of 2 step\(s\) failed/)
  assert.match(summaryOf([{ name: 'a | b', ok: true }]), /\| a \\\| b \| ok \|/)
})

test('the summary is appended to GITHUB_STEP_SUMMARY, and nothing is written without it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-summary-'))
  try {
    const file = path.join(dir, 'summary.md')
    fs.writeFileSync(file, 'before\n')
    writeSummary([{ name: 'coverage', ok: false }], file)
    const text = fs.readFileSync(file, 'utf8')
    assert.ok(text.startsWith('before\n') && text.includes('| coverage | **FAILED** |'))
    writeSummary([{ name: 'coverage', ok: true }], undefined)
    assert.deepEqual(fs.readdirSync(dir), ['summary.md'])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

// Installs the docs' dependencies the way a user gets them (BON-178): build bonkei, pack bonkei and @bonkei/vitepress, and `npm install`
// the tarballs into docs/. docs/ is not a workspace member, so nothing resolves into packages/*. Run from anywhere:
//   node scripts/docs-install.mjs
// docs/package-lock.json pins every third-party package. The two tarballs change whenever the code does, so their lock entries carry no
// `integrity` (npm would refuse a changed tarball): it is dropped before the install and again after, and the lock stays as committed
// unless a dependency really changed.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const docs = path.join(root, 'docs')
const packs = path.join(docs, '.packs')
const lockFile = path.join(docs, 'package-lock.json')
const OURS = ['node_modules/bonkei', 'node_modules/@bonkei/vitepress']
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } })

function dropOurIntegrity() {
  if (!fs.existsSync(lockFile)) return
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
  for (const k of OURS) if (lock.packages?.[k]) delete lock.packages[k].integrity
  fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n')
}

sh('pnpm --filter bonkei build')
fs.rmSync(packs, { recursive: true, force: true }); fs.mkdirSync(packs)
for (const p of ['packages/core', 'packages/vitepress']) sh(`pnpm pack --pack-destination ${JSON.stringify(packs)}`, path.join(root, p))
// the version number is the same on every pack: drop what was installed so npm unpacks the new tarballs
for (const k of OURS) fs.rmSync(path.join(docs, k), { recursive: true, force: true })
dropOurIntegrity()
sh('npm install --no-audit --no-fund', docs)
dropOurIntegrity()

for (const k of OURS) {
  const p = path.join(docs, k)
  if (fs.lstatSync(p).isSymbolicLink() || fs.realpathSync(p) !== p) { console.error(`docs-install: ${k} is a link (${fs.realpathSync(p)}), not an installed copy`); process.exit(1) }
}
console.log('docs-install: bonkei and @bonkei/vitepress installed from', packs)

// Installs the docs' dependencies the way a user gets them: build core, pack both packages, `npm install` the tarballs into docs/.
// The docs folder is not a workspace member, so nothing resolves into packages/*. Run from the repo root: node scripts/docs-install.mjs
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const docs = path.join(root, 'docs')
const packs = path.join(docs, '.packs')
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } })

sh('pnpm --filter bonkei build')
fs.rmSync(packs, { recursive: true, force: true }); fs.mkdirSync(packs)
for (const p of ['packages/core', 'packages/vitepress']) sh(`pnpm pack --pack-destination ${packs}`, path.join(root, p))
// same version number every time: drop what was installed so npm unpacks the tarballs again
for (const d of ['bonkei', '@bonkei']) fs.rmSync(path.join(docs, 'node_modules', d), { recursive: true, force: true })
fs.rmSync(path.join(docs, 'package-lock.json'), { force: true })
sh('npm install --no-audit --no-fund', docs)
const real = fs.realpathSync(path.join(docs, 'node_modules/bonkei'))
if (!real.startsWith(path.join(docs, 'node_modules'))) { console.error(`docs-install: bonkei resolves to ${real}, not the docs' node_modules`); process.exit(1) }
console.log('docs-install: bonkei and @bonkei/vitepress installed from', packs)

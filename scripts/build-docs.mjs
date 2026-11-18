// Builds the docs (BON-178) from the packed packages: install them (scripts/docs-install.mjs), then TypeDoc + vitepress build into
// docs/.vitepress/dist. `pnpm build` runs it before assemble-pages puts the result at dist/docs/.
import { execSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' })
sh(`node ${JSON.stringify(path.join(root, 'scripts/docs-install.mjs'))}`, root)
sh('npm run build', path.join(root, 'docs'))

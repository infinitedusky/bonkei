// Builds the docs (BON-127) from the packed packages: install them (scripts/docs-install.mjs), then TypeDoc + vitepress build.
import { execSync } from 'node:child_process'
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' })
sh('node scripts/docs-install.mjs')
sh('npm run build', 'docs')

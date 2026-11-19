// Builds examples/vitepress (BON-53) into public/embed/vitepress/ with that base, so Storybook's "VitePress" stories can frame
// the real built site: its home page (no diagram), the diagrams page, and the diagrams page's server HTML with scripts off.
// Not committed; run before Storybook (needs packages/core built, as Storybook does).
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const site = path.resolve(import.meta.dirname, '../../../examples/vitepress')
const out = path.resolve(import.meta.dirname, '../public/embed/vitepress')
execFileSync(process.execPath, [path.join(site, 'node_modules/vitepress/bin/vitepress.js'), 'build', '--base', '/embed/vitepress/', '--outDir', out],
  { cwd: site, stdio: 'inherit' })

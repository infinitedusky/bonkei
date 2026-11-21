import fs from 'node:fs'
import path from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'

// BON-178: the built docs (pnpm docs:build) are served at /docs/ for the "Docs (built)" stories; without a build the stories say so.
const docsDist = path.resolve(import.meta.dirname, '../../../docs/.vitepress/dist')
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx', '../../site/src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  // public/stages are the sample stage models (BON-253), at /stages/ as the stage stories ask for them
  // public/embed is the script-tag page, written by scripts/copy-embed.mjs before Storybook starts (BON-52)
  staticDirs: ['../../site/public', { from: '../public/embed', to: '/embed' }, { from: '../public/stages', to: '/stages' }, ...(fs.existsSync(docsDist) ? [{ from: docsDist, to: '/docs' }] : [])],
  addons: [
    { name: '@zigbang/storybook-addon-story-flow', options: { flowGlob: '../src/**/*.flow.json' } },
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
}
export default config

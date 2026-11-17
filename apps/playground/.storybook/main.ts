import type { StorybookConfig } from '@storybook/react-vite'
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx', '../../site/src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  // public/embed is the script-tag page, written by scripts/copy-embed.mjs before Storybook starts (BON-52)
  staticDirs: ['../../site/public', { from: '../public/embed', to: '/embed' }],
  addons: [
    { name: '@zigbang/storybook-addon-story-flow', options: { flowGlob: '../src/**/*.flow.json' } },
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
}
export default config

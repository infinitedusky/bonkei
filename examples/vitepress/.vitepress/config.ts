import { defineConfig } from 'vitepress'
import { bonkeiMarkdown } from '@bonkei/vitepress'

export default defineConfig({
  title: 'Bonkei in VitePress',
  description: 'Mermaid fences drawn as Bonkei scenes',
  // BONKEI_BASE lets the prototype serve this site under /examples/vitepress/ next to the other pages
  base: process.env.BONKEI_BASE ?? '/',
  themeConfig: { nav: [{ text: 'Diagrams', link: '/diagrams' }, { text: 'Mintlify', link: '/mintlify' }] },
  markdown: {
    config: md => bonkeiMarkdown(md, { height: 420 }),
  },
})

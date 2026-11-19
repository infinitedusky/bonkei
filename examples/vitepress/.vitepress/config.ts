import { defineConfig } from 'vitepress'
import { bonkeiMarkdown } from '@bonkei/vitepress'

export default defineConfig({
  title: 'Bonkei in VitePress',
  description: 'Mermaid fences drawn as Bonkei scenes (made-up sample diagrams)',
  themeConfig: { nav: [{ text: 'Diagrams', link: '/diagrams' }, { text: 'Mintlify', link: '/mintlify' }] },
  markdown: {
    // height: the site-wide default for every diagram (a fence can set its own: ```mermaid {height=600})
    config: md => bonkeiMarkdown(md, { height: 420 }),
  },
})

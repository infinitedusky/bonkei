import { defineConfig } from 'vitepress'
import { bonkeiMarkdown } from '@bonkei/vitepress'
import fs from 'node:fs'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms'
import llmstxt from 'vitepress-plugin-llms'
import typedocRaw from '../api/typedoc-sidebar.json'

// TypeDoc writes links ending in .md; the site's links do not
const strip = (items: any[]): any[] => items.map(i => ({ ...i, ...(i.link ? { link: i.link.replace(/\.md$/, '') } : {}), ...(i.items ? { items: strip(i.items) } : {}) }))
const typedocSidebar = strip(typedocRaw as any[])

// BON-127: Bonkei's docs. Everything Bonkei here comes from the INSTALLED packages (node_modules/bonkei, @bonkei/vitepress),
// packed from this checkout by scripts/docs-install.mjs, never from packages/*.
const fences: Record<string, number> = { claimed: 0, passed: 0 }

export default defineConfig({
  title: 'Bonkei',
  description: 'Bonkei draws Mermaid diagrams as 3D scenes you can turn. Documentation for React, plain JavaScript, a script tag and VitePress.',
  base: '/docs/',
  appearance: false, // light only until diagrams follow the dark switch
  cleanUrls: true,
  ignoreDeadLinks: [/^\/(bonkei|llms)/], // files served beside the pages: the script-tag bundle, llms.txt
  lastUpdated: false,
  head: [['link', { rel: 'icon', href: '/docs/favicon.svg' }]],
  themeConfig: {
    siteTitle: 'Bonkei',
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: 'bonkei.dev', link: 'https://bonkei.dev/' },
      { text: 'Viewer', link: 'https://bonkei.dev/app/' },
      { text: 'GitHub', link: 'https://github.com/infinitedusky/bonkei' },
    ],
    sidebar: [
      { text: 'Getting started', items: [
        { text: 'Introduction', link: '/guide/introduction' },
        { text: 'React', link: '/guide/react' },
        { text: 'Plain JavaScript', link: '/guide/javascript' },
        { text: 'Script tag', link: '/guide/script-tag' },
        { text: 'VitePress', link: '/guide/vitepress' },
      ] },
      { text: 'Writing diagrams', items: [
        { text: 'Diagram types', link: '/guide/diagram-types' },
        { text: 'Options and frontmatter', link: '/guide/options' },
        { text: "The reader's controls", link: '/guide/controls' },
        { text: 'Edge styles', link: '/guide/edge-styles' },
        { text: 'Themes', link: '/guide/themes' },
        { text: 'Errors and warnings', link: '/guide/errors' },
      ] },
      { text: 'Reference', items: [
        { text: 'API', link: '/api/', items: typedocSidebar as any },
        { text: 'Script tag element', link: '/reference/script-tag' },
        { text: 'VitePress plugin', link: '/reference/vitepress-plugin' },
      ] },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/infinitedusky/bonkei' }],
    outline: { level: [2, 3] },
    docFooter: { prev: 'Previous', next: 'Next' },
    editLink: { pattern: 'https://github.com/infinitedusky/bonkei/edit/main/docs/:path', text: 'Edit this page on GitHub' },
  },
  markdown: {
    config: md => {
      // the Bonkei plugin claims flowchart and sequence fences; onFence counts every fence at build time
      bonkeiMarkdown(md, { height: 360, onFence: e => { fences[e.claimed ? 'claimed' : 'passed']++ } })
      md.use(copyOrDownloadAsMarkdownButtons)
    },
    codeTransformers: [
      // Type-checks every ```ts twoslash sample against the installed `bonkei`; a type error fails the build and names the sample.
      transformerTwoslash({ throws: true, twoslashOptions: { compilerOptions: { moduleResolution: 100 /* Bundler */, module: 99 /* ESNext */, target: 9 /* ES2022 */, jsx: 4 /* react-jsx */, strict: true, skipLibCheck: true, types: [] } } }),
    ],
  },
  vite: {
    plugins: [llmstxt({ domain: 'https://bonkei.dev', excludeIndexPage: false, title: 'Bonkei', description: 'Bonkei draws Mermaid flowcharts and sequence diagrams as 3D scenes you can turn.' }) as any],
  },
  buildEnd: config => {
    // vitepress-plugin-llms drops the site base from the links of nested sidebar sections (the API groups): put it back
    const f = `${config.outDir}/llms.txt`
    if (fs.existsSync(f)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replaceAll('https://bonkei.dev/api/', 'https://bonkei.dev/docs/api/'))
 console.log(`bonkei fences: ${fences.claimed} drawn, ${fences.passed} left to VitePress`) },
})

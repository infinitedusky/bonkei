# @bonkei/vitepress (private, not published)

Fenced `` ```mermaid `` blocks that hold a flowchart or a sequence diagram become Bonkei scenes in a VitePress site. Other fences (pie charts, code) go to whatever rendered them before.

```ts
// .vitepress/config.ts
import { bonkeiMarkdown } from '@bonkei/vitepress'
export default defineConfig({ markdown: { config: md => bonkeiMarkdown(md, { height: 420 }) } })

// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithBonkei } from '@bonkei/vitepress/client'
export default { extends: DefaultTheme, enhanceApp({ app }) { enhanceAppWithBonkei(app) } }
```

- Height: `height` in the plugin options for the site (default 420), `` ```mermaid {height=600} `` for one diagram. The server-rendered HTML holds a box of that height, so the page does not jump.
- Bonkei, React and three load in a dynamic chunk when a diagram mounts, so a page without one downloads none of them.
- `react`, `react-dom` and `three` are **dependencies** of this package, not peers: a Vue site has none of them, and `bonkei` needs them as peers, so the plugin brings them and the site installs one package. (`vitepress` and `vue` are peers.)
- `onFence` in the options is called for every mermaid fence at build time (claimed, or passed on and why).

See `examples/vitepress`, which also has a page on what Mintlify allows (`examples/vitepress/mintlify.md`).

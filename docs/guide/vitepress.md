---
description: Add Bonkei to a VitePress site with @bonkei/vitepress, so mermaid fences that hold a flowchart or sequence diagram are drawn as live 3D scenes.
---

# VitePress

This site is built this way.

```sh
npm install vitepress
npm install @bonkei/vitepress
```

`@bonkei/vitepress` brings `bonkei`, `react`, `react-dom` and `three` with it.

## Two files

```ts [.vitepress/config.ts]
import { defineConfig } from 'vitepress'
import { bonkeiMarkdown } from '@bonkei/vitepress'

export default defineConfig({
  markdown: { config: md => bonkeiMarkdown(md, { height: 420 }) },
})
```

```ts [.vitepress/theme/index.ts]
import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithBonkei } from '@bonkei/vitepress/client'

export default { extends: DefaultTheme, enhanceApp({ app }) { enhanceAppWithBonkei(app) } }
```

## Write a diagram

````md
```mermaid
flowchart LR
  Build --> Test --> Ship
```
````

```mermaid
flowchart LR
  Build --> Test --> Ship
```

That is the plugin drawing the fence above. The server renders a box of the right height, so the page does not jump when the diagram draws. Only pages with a diagram download Bonkei.

## Per-diagram settings

After `mermaid`, `{height=600}`, `{mode=flat}` and `{theme=bonkei}` set one diagram. The plugin's options set them site-wide; the fence wins.

````md
```mermaid {height=260 mode=flat theme=bonkei}
flowchart LR
  One --> Two
```
````

```mermaid {height=260 mode=flat theme=bonkei}
flowchart LR
  One --> Two
```

Any other fence is left to VitePress: see [Diagram types](./diagram-types). The plugin's full options are in [VitePress plugin](/reference/vitepress-plugin).

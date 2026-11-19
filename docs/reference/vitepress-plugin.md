---
description: Reference for @bonkei/vitepress, the bonkeiMarkdown plugin and its options (height, mode, theme, onFence), the fence attributes, the client entry and the telemetry it records.
---

# VitePress plugin

`@bonkei/vitepress` has two entries. How to set it up is on [VitePress](/guide/vitepress).

## `bonkeiMarkdown(md, options)`

From `@bonkei/vitepress`, for `markdown.config`. Claims ` ```mermaid ` fences that hold a flowchart or a sequence diagram; every other fence goes on to whatever rendered it before.

<div class="table-wrap">

| Option | Values | Default |
| --- | --- | --- |
| `height` | px for every diagram | `420` |
| `mode` | `flat` · `iso` · `3d` | `iso` |
| `theme` | a theme name | `classic` |
| `onFence` | called at build time for every fence | none |

</div>

A fence's own `{height=600}`, `{mode=flat}` or `{theme=bonkei}` wins. `onFence({ claimed, reason, file })` says whether the fence was claimed and why not, or what was corrected (a height that is not a number, an unknown mode). This site counts them in `buildEnd`.

```ts twoslash
import { bonkeiMarkdown } from '@bonkei/vitepress'
import type { BonkeiMarkdownOptions } from '@bonkei/vitepress'

const options: BonkeiMarkdownOptions = { height: 420, mode: 'iso', theme: 'bonkei', onFence: e => console.log(e.claimed, e.reason) }
export const config = (md: Parameters<typeof bonkeiMarkdown>[0]) => bonkeiMarkdown(md, options)
```

## `@bonkei/vitepress/client`

`enhanceAppWithBonkei(app)` registers `<BonkeiDiagram>`; call it in the theme's `enhanceApp`. `BonkeiDiagram` takes `source`, `height`, `mode` and `theme`.

## Telemetry

The component records a `bonkei.vitepress.load` span (milliseconds to load Bonkei; status ERROR, with a message in the box, if it could not), and Bonkei's own spans follow. Both do nothing unless the site registers an OpenTelemetry SDK.

## Not yet

Following VitePress's dark/light switch, and diagram types other than flowcharts and sequence diagrams.

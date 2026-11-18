---
layout: home
title: Bonkei documentation
description: Bonkei draws Mermaid flowcharts and sequence diagrams as 3D scenes the reader can turn. Start here for React, plain JavaScript, a script tag and VitePress.
hero:
  name: Bonkei
  text: Diagrams you can turn
  tagline: Write Mermaid. Bonkei draws it as a 3D scene, in React, plain JavaScript, a script tag or VitePress. Every diagram on this site is live.
  actions:
    - { theme: brand, text: Get started, link: /guide/introduction }
    - { theme: alt, text: API reference, link: /api/ }
features:
  - { title: React, details: A <Bonkei /> component that fills its container., link: /guide/react }
  - { title: Plain JavaScript, details: render(element, source) mounts a diagram without React., link: /guide/javascript }
  - { title: Script tag, details: One file and a <bonkei-diagram> element. No build step., link: /guide/script-tag }
  - { title: VitePress, details: Your mermaid fences become Bonkei scenes., link: /guide/vitepress }
---

<div class="home-demo">

```mermaid {height=380}
flowchart LR
  Write[Write Mermaid] --> Bonkei{{Bonkei}}
  Bonkei --> Flat[Flat]
  Bonkei --> Iso[Iso]
  Bonkei --> D3[3D]
```

</div>

<p class="cap">Live, drawn by the VitePress plugin from the fence in this page's Markdown. Drag it; the toolbar switches the view. Sample data, made up.</p>

## Try it: edit the Mermaid

Change the text and the diagram follows. A line Bonkei cannot use is reported under the editor and the last good diagram stays.

```mermaid {editor height=340}
flowchart LR
  Idea[An idea] --> Draft
  Draft --> Review{Good?}
  Review -->|yes| Ship
  Review -->|no| Draft
```

<CopyOrDownloadAsMarkdownButtons />

This site is also an agent's way in: [`/docs/llms.txt`](/llms.txt) lists every page, [`/docs/llms-full.txt`](/llms-full.txt) holds them all, and every page has a Markdown copy beside it (add `.md` to its address).

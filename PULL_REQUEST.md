# Embeds: script tag and a VitePress plugin (BON-53)

Bonkei now drops into docs people already have.

- **Script tag** (`bonkei.global.js`): a `<bonkei-diagram>` element (text is the diagram; `height`, `mode`, `theme` attributes; `bonkei-ready` / `bonkei-error` events; cleaned up when removed, drawn when added), and `Bonkei.run()` that turns `<pre class="mermaid">` flowcharts and sequence diagrams into diagrams, only when the page calls it. `examples/html` is one static page with nothing else.
- **VitePress**: `@bonkei/vitepress` (`packages/vitepress`, private) draws ` ```mermaid ` flowcharts and sequence diagrams as Bonkei scenes and leaves other fences to the site. The server HTML holds each diagram's box (site-wide `height`, or `{height=600}` on a fence); Bonkei, React and three load only on pages with a diagram. `examples/vitepress` is a working site.
- **Mintlify**: researched, written in `examples/vitepress/mintlify.md`; not built.

Where to look: decisions in LOG.md ("Embeds: script tag and VitePress (BON-53)"); manual test plan in TESTING.md (same title); stories `Script tag / Elements*` and `VitePress / *`; tests `packages/core/src/embed.test.ts`, `packages/vitepress/src/index.test.js`, and `scripts/smoke/embeds.mjs` in `pnpm smoke`.

## Risks: what this could break, and how you would notice

- **The script-tag bundle defines a global element name.** A page that already defines `<bonkei-diagram>` keeps its own (the definition is guarded); ours then does nothing there. You would notice no diagram and no error.
- **`pre.mermaid` on pages that also load Mermaid.js.** `Bonkei.run()` takes the flowchart and sequence blocks; if Mermaid ran first, the blocks hold SVG, not source, and are skipped as unsupported. `bonkei.run`'s `skipped` count shows it.
- **VitePress fence rule.** The plugin wraps whatever `fence` rule exists when `markdown.config` runs. A Mermaid plugin that installs its rule *after* ours would take every mermaid fence back; you would see Mermaid's SVG instead of a scene. `onFence` shows what ours claimed.
- **React 19 inside a Vue site.** The plugin brings React 19; VitePress's `@docsearch/react` wants React < 19, so install prints a peer warning. A site using Algolia search could break; you would notice on the search box.
- **Vite 5 dev wasm.** Under `vitepress dev` the wasm is drawn from the inline copy and the console logs the fallback; build + preview fetch the file. If a later VitePress moves files again, `bonkei.wasm.fallback` and `routingError` say so.
- **CI time.** `pnpm smoke` now also installs and builds a VitePress site twice (dev, build + preview): a few minutes more on the smoke job. Storybook's build also builds the VitePress example first.
- **Workspace.** `examples/vitepress` joined the pnpm workspace, so the lockfile grew (VitePress and its tree); `pnpm install --frozen-lockfile` in CI uses the committed lock.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

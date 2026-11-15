# Bonkei

> Mermaid diagrams, as a 3D scene (flat, iso, 3D).

Bonkei turns Mermaid into one Three.js scene (Mermaid → ELK → react-three-fiber) that you can view **flat, isometric or 3D**, with animated camera transitions.

- Flowcharts: nested subgraphs become trays, nodes are extruded shapes (rect, round, cylinder, diamond), edges follow ELK's orthogonal routes.
- Sequence diagrams: participants, lifelines on the ground, messages, activations as raised bars, `loop`/`alt`/`opt`/`par` blocks as translucent trays.
- Drag nodes (kept inside their subgraph; edges reroute live), click a subgraph to fly in, edit the source live, pick from built-in samples.

## Packages

The repo is a pnpm workspace (`pnpm-workspace.yaml`); the root `bonkei-workspace` is a private shell.

- `packages/core` — **`bonkei`**: the parser, ELK layout, sequence layout, model types and the renderer (`SceneView`, `SeqScene`, shapes, camera). Private for now; it will be published later.
- `apps/playground` — **`@bonkei/playground`** (private): the viewer, its stories, Storybook and the screen map.
- `apps/site` — **`@bonkei/site`** (private): the marketing site, its stills and OG images, and the capture page behind `pnpm capture`.

Both apps import the engine only as `bonkei`; core never imports from an app.

```bash
pnpm install
pnpm dev          # both apps: site at http://localhost:5173/, viewer at /app/
pnpm build        # type-check everything, build both apps, assemble dist/ (site) + dist/app/ (viewer)
pnpm preview      # serve the assembled dist/ under /merman/
pnpm storybook    # stories: node shape, subgraph, full sample, sequence, site screens
pnpm capture      # regenerate apps/site/public/*.png from the real scene (needs Chrome; CHROME_PATH to override)
pnpm test         # unit tests (core's camera)
```

Public site: https://infinitedusky.github.io/merman/ (live after the first deploy). It deploys to GitHub Pages through `.github/workflows/pages.yml`. For now that workflow runs only when started by hand (`workflow_dispatch`), so merging to main publishes nothing.

Two Vite apps, one Pages artifact: `apps/site` is the marketing site (`index.html`, code in `apps/site/src/`), and `apps/playground` is the viewer (`index.html`, `apps/playground/src/main.tsx`). `pnpm build` builds both and `scripts/assemble-pages.mjs` puts the site at `dist/` and the viewer at `dist/app/`; builds and `pnpm preview` serve them under `/merman/`. In dev they are served under `/`: the site's dev server proxies `/app` to the viewer's own server.

Stack: Vite, React, react-three-fiber, drei (troika text), elkjs. Parser, ELK layout (`packages/core/src/layout.ts`, swappable behind `layout(graph)`) and sequence layout (`packages/core/src/seq.ts`) are our own.

**Status: prototype.** Known gaps: ELK routes cross-subgraph edges badly on big diagrams; flat/iso use a 1° perspective camera rather than a true orthographic one; tests cover only the camera.

## The screen map

Storybook (`pnpm storybook`) draws a map of the screens from `apps/playground/src/flows/*.flow.json`: open the Map page under Docs and zoom out. Add a screen by adding its page story to a node there, whole screens only.

# Contributing

Small, early project: PRs and issues welcome. `pnpm install && pnpm dev`, then open the viewer at http://localhost:5173/app/ (the bare http://localhost:5173/ is the marketing site). Pick something from the list below, or from the open issues.

After any change that alters what the scene looks like, re-run `pnpm capture` and commit the regenerated `apps/site/public/*.png`. It needs a local Chrome; set `CHROME_PATH` to use a different binary.

Map of the code (a pnpm workspace; see the README's Packages list):
- `packages/core/src/parser.ts`, `packages/core/src/seq.ts`: Mermaid flowchart and sequence parsing (+ sequence layout)
- `packages/core/src/layout.ts`: `layout(graph, { avoidCrossings })`: ELK places the boxes (ports at side midpoints, a block slid aside when its line could not go direct), then libavoid routes the lines. `reroute()` is only the fallback for a dragged node's lines when the libavoid wasm has not loaded
- `packages/core/src/avoid.ts`: the libavoid router: side-midpoint pins, trays as walls with openings, the crossing-avoidance levels (`off`, `some`, `strong`). The router `layout()` builds is kept (`routerFor`) and re-routes the lines on every drag frame
- `packages/core/src/monotone.ts`: direct routes: replaces a line libavoid sends back on itself or through a foreign tray with a monotone one, rips up and re-routes to cross fewer lines (`refine`), and slides a block whose line has no direct route (`unblock`)
- `packages/core/src/routeMetrics.ts`: route quality counts (crossings, lines on top of each other, doubling back, through a block or tray, length / direct) for tests and the playground's readout
- `packages/core/src/edges3d.ts`: lines in 3D, pure: the one vertical step between heights, where lines cross, and the bridge, tunnel and portal plans
- `packages/core/src/EdgeScene.tsx`: draws those plans: lines, arrowheads, tunnel troughs, portals
- `packages/core/src/SceneView.tsx`, `packages/core/src/SeqScene.tsx`, `packages/core/src/shapes.tsx`, `packages/core/src/camera.ts`: the r3f scene and camera rig
- `packages/core/src/Bonkei.tsx`: the `<Bonkei />` component (mode, toolbar, error card and strip, render-error boundary, callbacks)
- `packages/core/src/render.tsx`: `render(element, source, options)`, which mounts its own React root and returns the handle
- `packages/core/src/options.ts`: option and event types, the `config.bonkei` frontmatter reader and the props-over-frontmatter merge
- `packages/core/src/diagram.ts`: `prepare(source)`, one step from a source to something drawable (frontmatter, parse, layout) or a `BonkeiError`
- `packages/core/src/controls.ts`: what the reader's controls allow, as pure decisions `SceneView` asks for
- `packages/core/src/telemetry.ts`: the OpenTelemetry tracer and span helpers (a no-op unless the page registers an SDK)
- `packages/core/src/palette.ts`: the scene's and the UI's colours
- `packages/core/src/scale.ts`: layout-to-world scale and the scene's fixed heights
- `packages/core/src/model.ts`: the model types
- `packages/core/src/index.ts`: the public API of `bonkei`, and nothing else
- `packages/core/src/internal.ts`: `bonkei/internal`, every other piece, for this repo's stories and tools (internal and unstable)
- `apps/playground/src/samples.ts`: built-in diagrams (add one when you fix a bug it exposes)
- `apps/playground/scripts/`: route measurements on the samples (`route-metrics.ts`, `drag-metrics.ts`, `drag-check.ts`, `route-svg.ts`) and `routes.test.ts`, the 50-node sample's checks (`pnpm --filter @bonkei/playground test`)
- `TESTING.md`: the manual test plan, page by page
- `PULL_REQUEST.md`: the pull request description for BON-99, with its risks (what could break, how you would notice)
- `apps/playground/src/main.tsx`, `apps/playground/src/App.tsx` (mounted by `apps/playground/index.html`): the viewer, served at `/app/`
- `apps/site/src/` (mounted by `apps/site/index.html`): the marketing page. The hero loads the scene lazily, so keep `bonkei` out of `Home` and the site's `main.tsx`; a static import of it puts the whole scene chunk on first paint and on phones. Asset URLs and links in its JSX go through `import.meta.env.BASE_URL`.
- `apps/site/dev/capture.*` + `apps/site/scripts/capture-stills.mjs`: the asset capture behind `pnpm capture`. It is dev-only and not a build input. It renders `<Bonkei>` (not a bare `SceneView`), waits 60 frames after `onReady` for text and shadows, and writes `apps/site/public/poster.png`, `og.png` and `still-*.png`.

Rules:
- Core never imports from an app. Apps never import each other (the site keeps its own copies of what it needs from the playground).
- Apps use only the public `bonkei` exports (`index.ts`). Stories may use `bonkei/internal`; app code may not. A name moves from `internal.ts` to `index.ts` only with a LOG.md entry: once published, removing it is a breaking change.
- Files reached by the node tests (`packages/core/src/*.test.ts` and everything they import) import with explicit `.ts` extensions and never import a `.tsx` file.
- `telemetry.ts`'s `VERSION` must be bumped with `package.json`'s `version`.
- `SceneView` and its `camera` prop are internal only.

## Good starting points
1. **Subgraph-crossing edges** on the large sample loop around the outer tray. Try ELK ports on subgraph borders, or bundled summary edges that expand on drill.
2. **Edge labels** unreadable at fit zoom: scale/fade with camera height, billboard them.
3. **Port spreading**: arrowheads pile up where many edges hit one node.
4. **True orthographic camera** for flat/iso (currently a 1° perspective camera so the ortho→perspective morph is a dolly-zoom).
5. **Drag performance**: move drag state out of React state (refs/store), measure on the large sample.
6. **Drag collision**: keep nodes from overlapping siblings; reroute around them.
7. **Sequence diagrams**: block extents per participants involved, note collision, `rect`/`critical`, autonumber.
8. **Mermaid coverage**: more shapes (`>`, `[[ ]]`, `[/ /]`), `classDef`/`style`, `direction` inside subgraphs.
9. ~~**Tests** for the parsers.~~ Done.
10. **Export**: PNG/GLB of the current view.

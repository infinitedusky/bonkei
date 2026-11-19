# Contributing

Small, early project: PRs and issues welcome. `pnpm install && pnpm dev`, then open the viewer at http://localhost:5173/app/ (the bare http://localhost:5173/ is the marketing site; to run several copies at once, set `SITE_PORT` and `VIEWER_PORT` as the README's dev section shows). Pick something from the list below, or from the open issues.

**Any change to how Bonkei draws (shapes, themes, layout, camera, lines, labels) retakes the site's pictures in the same PR:** run `pnpm capture` (it builds core first) and commit the regenerated `apps/site/public/*.png` (`poster.png`, `og.png`, `still-flat.png`, `still-iso.png`, `still-3d.png`, `still-seq.png`); the PR template's checklist asks for it. A desktop never sees these while the live scenes load (an empty stage shows, BON-209), but the cards, the share image, and phones and browsers without WebGL 2 do, so old ones show a wrong look. It needs a local Chrome; set `CHROME_PATH` to use a different binary.

Map of the code (a pnpm workspace; see the README's Packages list):
- `packages/core/src/parser.ts`, `packages/core/src/seq.ts`: Mermaid flowchart and sequence parsing (+ sequence layout)
- `packages/core/src/layout.ts`: `layout(graph, { avoidCrossings })`: ELK places the boxes (ports at side midpoints, a block slid aside when its line could not go direct), then libavoid routes the lines. `reroute()` is only the fallback for a dragged node's lines when the libavoid wasm has not loaded
- `packages/core/src/avoid.ts`: the libavoid router: side-midpoint pins, trays as walls with openings, the crossing-avoidance levels (`off`, `some`, `strong`). The router `layout()` builds is kept (`routerFor`) and re-routes the lines on every drag frame
- `packages/core/src/monotone.ts`: direct routes: replaces a line libavoid sends back on itself or through a foreign tray with a monotone one, rips up and re-routes to cross fewer lines (`refine`), and slides a block whose line has no direct route (`unblock`)
- `packages/core/src/routeMetrics.ts`: route quality counts (crossings, lines on top of each other, doubling back, through a block or tray, length / direct) for tests and the playground's readout
- `packages/core/src/edges3d.ts`: lines in 3D, pure: the one vertical step between heights, where lines cross, and the bridge, tunnel and portal plans
- `packages/core/src/EdgeScene.tsx`: draws those plans: lines, arrowheads, tunnel troughs (with the trench light, `theme.edge.glow`, and rim), portals
- `packages/core/src/SceneView.tsx`, `packages/core/src/SeqScene.tsx`, `packages/core/src/shapes.tsx`, `packages/core/src/camera.ts`: the r3f scene and camera rig
- `packages/core/src/Bonkei.tsx`: the `<Bonkei />` component (mode, toolbar, error card and strip, render-error boundary, callbacks)
- `packages/core/src/render.tsx`: `render(element, source, options)`, which mounts its own React root and returns the handle
- `packages/core/src/options.ts`: option and event types, the `config.bonkei` frontmatter reader and the props-over-frontmatter merge
- `packages/core/src/diagram.ts`: `prepare(source)`, one step from a source to something drawable (frontmatter, parse, layout) or a `BonkeiError`
- `packages/core/src/controls.ts`: what the reader's controls allow, as pure decisions `SceneView` asks for: which gesture a wheel, drag or two fingers make, the quarter-turn settle, which input was used, the gesture card's rows, and the gesture spans
- `packages/core/src/hold.ts`: whether a diagram has the reader's gestures (BON-78): a diagram in a page that scrolls is taken hold of with a click and let go with Esc or a click outside; the held ring's corners
- `packages/core/src/telemetry.ts`: the OpenTelemetry tracer and span helpers (a no-op unless the page registers an SDK)
- `packages/core/src/theme.ts`: themes as data: the `Theme` tokens, the Classic, Bonkei and Bonkei · landscape presets, `resolveTheme` (prop over frontmatter, variables on top), variable checking, `inkPx`. Scene code reads tokens and never names a theme
- `packages/core/src/look.tsx`: the scene's side of the tokens: `ThemeProvider`/`useTheme`, materials, ink outlines, label plates, tray patterns, paper grain, landscape forms; `fonts.ts` + `fonts/` the bundled Zen Old Mincho subset (SIL OFL)
- `packages/core/src/titles.ts`: which tray corner a title goes to so nothing stands on it
- `packages/core/src/palette.ts`: the overlay UI's colours (the scene's are theme tokens)
- `packages/core/src/scale.ts`: layout-to-world scale and the scene's fixed heights
- `packages/core/src/model.ts`: the model types
- `packages/core/src/index.ts`: the public API of `bonkei`, and nothing else
- `packages/core/src/internal.ts`: `bonkei/internal`, every other piece, for this repo's stories and tools (internal and unstable)
- `packages/core/src/global.ts`: the entry of the script-tag bundle, `bonkei.global.js` (`window.Bonkei.render`, `Bonkei.run`, and it defines `<bonkei-diagram>`)
- `packages/core/src/element.ts`: the `<bonkei-diagram>` element and `run()` for `<pre class="mermaid">` (script tag only; the ESM package defines no element). `embed.ts`: their pure helpers (`isSupported`, `dedent`, `cssHeight`), tested by `embed.test.ts`
- `packages/vitepress`: `@bonkei/vitepress`, plain ESM with `.d.ts` files and no build. `src/index.js` the markdown-it plugin (config side, Node, imports nothing from bonkei; its `isSupported` is a copy of core's and its tests run the same cases), `src/client.js` the Vue component (loads bonkei on mount)
- `examples/html`: the static script-tag page (`copy-bundle.mjs` puts the bundle beside it). `examples/vitepress`: the VitePress example site and `mintlify.md`
- `packages/core/tsdown.config.ts`, `packages/core/scripts/finish-build.mjs`: the build: ESM + types for `bonkei` and `bonkei/internal`, the lazy base64 wasm chunk (`virtual:libavoid-inline`), the script-tag bundle, and `libavoid.wasm` copied beside them
- `packages/core/src/package.test.ts`: package.json's contract (peer range = Fiber's, OpenTelemetry as a dependency, dist only), ELK fetched on first layout, the order the wasm is looked for in. `packages/core/scripts/dist.test.mjs` checks the built `dist/` (run by `pnpm check:package`)
- `packages/core/.size-limit.mjs`: the size budget, checked on every PR; LOG.md (BON-52) has the measured numbers. `scripts/measure-inline-wasm.mjs` measures the script-tag bundle with the wasm inlined, for comparison
- `examples/vite`: a fresh Vite React app with `bonkei`; keep it what `npm create vite` gives today plus `bonkei` and `three`, with a default `vite.config.ts`
- `scripts/smoke/`: `vite.mjs` packs `bonkei`, installs it into a clean copy of `examples/vite` (current Vite, then Vite 5) and checks with Playwright that a diagram draws with libavoid routing under `vite dev` and `vite preview`; `script-tag.mjs` does the same for the plain HTML page `script-tag.html`, with and without the wasm; `embeds.mjs` packs `bonkei` and `@bonkei/vitepress` and checks `examples/html` and `examples/vitepress` (dev, build + preview). `check.mjs` is the shared Playwright check
- `apps/playground/scripts/copy-embed.mjs`: copies the script-tag page and bundle into `apps/playground/public/embed/` (not committed) for `/app/embed/` and Storybook's Script tag stories, and `examples/html` into `embed/elements/`. `build-vitepress-embed.mjs` builds `examples/vitepress` into `embed/vitepress/` for Storybook's VitePress stories (both run before Storybook)
- `.github/workflows/ci.yml`: on every PR: typecheck, tests, package checks, the apps and Storybook built, the smoke tests, the size budget (PR comment) and the pkg.pr.new preview (install line + StackBlitz on `examples/vite`)
- `apps/playground/src/samples.ts`: built-in diagrams (add one when you fix a bug it exposes)
- `apps/playground/scripts/`: route measurements on the samples (`route-metrics.ts`, `drag-metrics.ts`, `drag-check.ts`, `avoid-levels.ts`, `crossing-styles.ts`, `measure-edges.ts`, `list-back.ts`, `route-svg.ts`) and `routes.test.ts`, the 50-node sample's checks (`pnpm --filter @bonkei/playground test`)
- `TESTING.md`: the manual test plan, page by page
- `docs/`: the official docs at bonkei.dev/docs/ (BON-178), a VitePress site that is **not** a workspace member: `scripts/docs-install.mjs` packs `bonkei` and `@bonkei/vitepress` and `npm install`s the tarballs into it, so it uses Bonkei exactly as a user does. `docs/guide/*.md` the pages (every diagram a ` ```mermaid ` fence), `docs/reference/` the script tag and plugin, `docs/api/` generated by TypeDoc from the installed `dist/index.d.ts` (not committed). `docs/.vitepress/config.ts` the site, the fence attributes `{editor}` `{tag}` `{live}` `{events}` `{stats}` `{fit=…}` `{minLabelPx=…}`, Twoslash, `vitepress-plugin-llms`; `docs/.vitepress/theme/` the live components (`BonkeiLive`, `BonkeiPlayground`, `ScriptTagDemo`, `CopyHomePage`, `TrenchLight` with its rules in `trench.ts`, tested by `trench.test.ts` in the root `pnpm test`), `telemetry.ts` and the brand CSS. `scripts/smoke/docs*.mjs` its smoke tests (`pnpm docs:smoke`); `scripts/smoke/diagram-rule.mjs` the page check's rule (every diagram a fence, apart from marked interactive demos), tested by `diagram-rule.test.mjs` in the root `pnpm test`, `scripts/serve-dist.mjs` serves a build like Pages
- `PULL_REQUEST.md`: the pull request description for BON-178, with its risks (what could break, how you would notice)
- `apps/playground/src/main.tsx`, `apps/playground/src/App.tsx` (mounted by `apps/playground/index.html`): the viewer, served at `/app/`
- `apps/site/src/` (mounted by `apps/site/index.html`): the marketing page, in the brand drawn from the bonkei prints (`site.css`, `Marks.tsx` logo and small mark; `public/favicon.svg` is the small mark). `Themes.tsx` is the Themes section; its scene is `ThemesScene.tsx`, lazily loaded like `HeroScene.tsx`. The hero and "Keep the text" load their scenes lazily onto an empty stage (no picture first; what each paints is `heroShows` / `howShows` in `howGate.ts`, and the pictures are only for devices that can't go live), so keep `bonkei` out of `Home` and the site's `main.tsx`; a static import of it puts the whole scene chunk on first paint and on phones. Asset URLs and links in its JSX go through `import.meta.env.BASE_URL`.
- `apps/site/dev/capture.*` + `apps/site/scripts/capture-stills.mjs`: the asset capture behind `pnpm capture`. It is dev-only and not a build input. It renders `<Bonkei>` (not a bare `SceneView`), waits 60 frames after `onReady` for text and shadows, and writes `apps/site/public/poster.png`, `og.png` and `still-*.png`.

Rules:
- Core never imports from an app. Apps never import each other (the site keeps its own copies of what it needs from the playground).
- Apps use only the public `bonkei` exports (`index.ts`). Stories may use `bonkei/internal`; app code may not. A name moves from `internal.ts` to `index.ts` only with a LOG.md entry: once published, removing it is a breaking change.
- Files reached by the node tests (`packages/core/src/*.test.ts` and everything they import) import with explicit `.ts` extensions and never import a `.tsx` file.
- `telemetry.ts`'s `VERSION` must be bumped with `package.json`'s `version`.
- The apps resolve `bonkei` to `packages/core/dist`: run `pnpm dev` (it keeps core rebuilt) or `pnpm --filter bonkei build` before an app or Storybook on its own. Node tests and scripts still import `src` directly.
- `bonkei`'s React peer range is React Three Fiber's own (`package.test.ts` fails otherwise): when Fiber is bumped, copy its range.
- A PR that goes over a size budget fails; raise a limit in `.size-limit.mjs` only with a LOG.md line saying why.
- `SceneView` and its `camera` prop are internal only.
- **A feature is tried on its own docs page.** The task that adds or changes an option, event, control, style or export writes or updates its page in `docs/guide/` in the same change, with each case as a live diagram (a ` ```mermaid ` fence; frontmatter for options, a fence attribute for props-only options and events), and tries it there by hand (`pnpm docs:dev`, or the docs smoke set-up). A new public export needs its JSDoc on the declaration (`dist.test.mjs` fails otherwise); `docs-coverage.mjs` fails for an option or event with no live example.
- **An interactive demo on a docs page** (a component that draws its own diagram, like `TrenchLight`) marks its root `data-bonkei-demo="<title>"`, holds exactly one diagram, and sits under a heading of that title in the page's `.md`. The page's Markdown drops the component, so under it the page says in prose and a fence (not a ` ```mermaid ` one) what the demo shows, so Copy page and agents get it. The docs smoke fails a demo without that heading and any other diagram that is not a fence.
- The docs install the packed packages, never the workspace: do not add `docs/` to `pnpm-workspace.yaml` or point it at `packages/*`. Code samples marked `twoslash` are type-checked against the installed `bonkei`; a sample that names an option Bonkei does not have fails the docs build.

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

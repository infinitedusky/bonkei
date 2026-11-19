# Decision log

The repo keeps no ADRs; this file is the record of decisions instead. Newest entries go at the bottom. Each entry has a date, its context, the decision, the alternatives considered and the consequences.

## 2026-11-14 — Workspace layout (BON-50)

**Context.** Everything lived in one Vite project: the engine, the viewer and (since PR #2) the marketing site, with two HTML entries. The engine is to be published on its own, and the site's hero already renders a diagram beside the viewer, so the engine needed a boundary of its own.

**Decision.** Make the repo a pnpm workspace (`pnpm-workspace.yaml` lists `packages/*` and `apps/*`) with three packages:
- `packages/core`: the parser (`parser.ts`, `seq.ts`), ELK layout (`layout.ts`), the sequence layout, the model types and the renderer (`SceneView`, `SeqScene`, `shapes`, `camera`).
- `apps/playground`: the viewer (`App.tsx`, `main.tsx`, `samples.ts`), Storybook and the screen map.
- `apps/site`: the marketing site, its stills and OG images in `public/`, and the capture page and script.

Both apps import core by its package name only. Core never imports from an app, and the apps never import each other: the site keeps its own copies of `sample.mmd` and the login sequence. Storybook lives in the playground and globs the site's stories (`../../site/src/**/*.stories.tsx`) and serves the site's `public/`, so there is still one Storybook for every screen.

**Alternatives considered.**
- Keep one Vite project and draw the engine boundary with folders only: nothing would stop app code leaking into the engine, and the package could not be published from it.
- Let the site import the sample and login sequence from the playground: it would couple two apps that deploy as separate builds.
- A Storybook per app: two servers and two screen maps for one small project.

**Consequences.** The boundaries are enforced by package resolution. The two sample copies can drift; that is accepted. Storybook in the playground reaches into the site by relative path, which is the one place an app looks at another app's files (stories and static assets only, never runtime imports).

## 2026-11-14 — Names (BON-50)

**Context.** The project was called merman. MER-2 decided that the engine is published as `bonkei`.

**Decision.**
- `packages/core` is **`bonkei`**, the MER-2 name. It stays `private` until MER-52 publishes it.
- `apps/playground` is **`@bonkei/playground`** and `apps/site` is **`@bonkei/site`**, both private.
- The root `package.json` is **`bonkei-workspace`**, a private workspace shell (scripts only, no code).
- The README and CONTRIBUTING say Bonkei.

The site's copy, its page titles and the `/merman/` Pages base stay as they are; changing those is a separate brand change.

**Alternatives considered.**
- `@bonkei/core` for the engine: MER-2 already chose the bare `bonkei`, the name users install.
- Renaming the site and the Pages base in the same change: it would mix a public brand change into a structural refactor, and move the public URLs, which this change keeps.

**Consequences.** For now the repo says Bonkei while the public site still says merman and lives at `/merman/`. The scoped names keep the apps clearly apart from the engine in `pnpm --filter`.

## 2026-11-14 — Source consumption (BON-50)

**Context.** The apps need to import core during development and builds, with fast reloads and no extra watch process.

**Decision.** Core's `package.json` exports `"."` → `./src/index.ts` and has no build step. The apps compile it through their own Vite (and Storybook's Vite) like any other source file; `pnpm -r typecheck` checks each package with `tsc --noEmit`. `react`, `react-dom` and `three` are peer dependencies of core.

**Alternatives considered.**
- Build core with tsc or tsup into `dist/`, and have the apps consume the output: an extra build and a watch process in dev, stale-output bugs, and source maps to get right, all for a package nobody installs yet.
- TypeScript project references (`composite`, `tsc -b`): more config across every tsconfig, and Vite ignores them anyway, so they would only serve the type-check.

**Consequences.** Editing core hot-reloads in both apps with nothing in between. Core cannot be consumed outside this workspace until MER-52 adds the ESM build and settles the peer contract.

## 2026-11-14 — Per-instance camera (BON-50, BON-70)

**Context.** `camera.ts` held module-level state, the `cam` singleton, with free `setMode`/`focusOn`/`fitH` functions. Several diagrams will render on one page (the site's hero already sits beside the viewer, and Storybook shows them together), and with one shared camera they would all move together.

**Decision.** Replace the singleton with a `createCamera()` factory that returns a camera state (`mode`, `goal`, `cur`, `focus`, `aspect`, `setMode`, `focusOn`, `fitH`), starting in iso. `PRESET` is frozen; the module has no mutable state. `SceneView` creates its own instance, or takes one through an optional `camera` prop when the view is driven from outside (the playground and the capture page do this). The `mode` prop drives the camera either way. `layout(graph)` stays swappable, and `showFps` and `wheelZoom` are unchanged.

**Alternatives considered.**
- A React context providing the camera: it hides which view a camera belongs to, and the r3f `Canvas` starts its own React tree, so the context would have to be bridged across it.
- An imperative ref on `SceneView` (`ref.current.setMode(...)`): it needs `forwardRef`/`useImperativeHandle` plumbing and still gives callers no camera to hold before the view mounts.

**Consequences.** Any number of views can share a page, each with its own camera. Callers that drive a view from outside hold a camera made with `createCamera()`; everyone else passes only `mode`. `pnpm test` checks that two cameras are independent.

## 2026-11-14 — The Pages artifact and the dev proxy (BON-50)

**Context.** The public URLs had to stay the same: the site at the Pages root and the viewer at `/app/`, now coming from two separate Vite apps.

**Decision.** The root `pnpm build` type-checks every package, builds both apps and runs `scripts/assemble-pages.mjs`, which copies `apps/site/dist` to `dist/` and `apps/playground/dist` to `dist/app/`. `pages.yml` still runs `pnpm build` and uploads `dist/`, so it is unchanged. The site builds with base `/merman/`, the viewer with `/merman/app/`. In dev, `pnpm dev` runs both apps: the site on :5173 proxies `/app` to the viewer's server on :5174, which serves under `/app/`, so http://localhost:5173/ and /app/ work as before. `pnpm preview` serves the assembled `dist/`.

**Alternatives considered.**
- Building the viewer straight into the site's output directory: each app's build would depend on the other's output folder and on build order.
- Two Pages deployments: Pages serves one artifact per repository.

**Consequences.** One artifact, the same URLs, no workflow change. In dev both servers must run (`pnpm dev` starts them together); the viewer's port 5174 is fixed (`strictPort`) because the proxy points at it.

## 2026-11-15 — Diagram options and errors (BON-51)

**Context.** The public API (`<Bonkei />` and `render()`) needs options that can come from props or from the diagram itself, and a way to report problems without throwing. Until now the parsers skipped every line they could not read without saying so, and the flowchart parser read a private `%%{arch: {...}}%%` directive into `Graph.arch`, which nothing used. Mermaid already has a place for per-diagram settings, the YAML frontmatter `---\nconfig: ...\n---`, and MER-32's themes plan to use `config.theme` and `config.themeVariables` in it. The engine half lives in `packages/core/src/options.ts` and `diagram.ts`, with no React.

**Decision.**
- **Namespace.** Options live under `config.bonkei` in the frontmatter, and nothing else in the block is read: `title`, `config.theme`, `config.themeVariables` and the rest are left for Mermaid and for themes.
- **Keys and defaults.** `mode` (`flat` | `iso` | `3d`, default `iso`), `labels` (`top` | `billboard`, default `top`), `toolbar` (boolean, default `true`) and `controls` (default `true`). `controls` is one setting: `true` or `false` for all of them, or a mapping of `zoom`, `pan`, `move` and `drillIn` in which a control left out is on (`resolveControls`). An unknown key or a bad value is a frontmatter warning with its line, and the key is ignored.
- **Merge.** Props override the frontmatter key by key: `props[k] ?? frontmatter[k] ?? default` (`mergeOptions`). A `controls` object in props replaces the frontmatter's `controls` whole; the two are not merged control by control. Each result is a fresh object.
- **Reading.** The frontmatter block is found with Mermaid's own regex (`/^-{3}\s*[\n\r](.*?)[\n\r]-{3}\s*[\n\r]+/s`) and parsed with `js-yaml` (`load` with `CORE_SCHEMA`), so a block that Mermaid accepts is one Bonkei accepts. Invalid YAML is a warning and the block is still stripped.
- **What "cannot be drawn" means.** `prepare(source)` rejects with a `BonkeiError` (`kind`: `parse` | `layout` | `graph` | `render`, `message`, optional `line` and `text`) only when there is nothing to draw: an empty source, a source where no node or participant could be read (the message names the first unreadable line), a hand-built graph with no nodes or with an edge pointing at an unknown node or group id, or a layout that fails. Anything less draws.
- **Two channels.** `onError` gets errors only. `onWarning` gets `BonkeiWarning`s (`kind`: `dropped` | `frontmatter`, `message`, `line`, optional `text`): each line a parser dropped (with its reason: `not supported yet`, `not a node or edge`, `stray end`, `unclosed subgraph`) and each frontmatter problem. There is no `severity` field. `prepare` rejects with the error itself carrying the warnings found before the failure (`PrepareError = BonkeiError & { warnings }`), so the component can still send them to `onWarning`.
- **Line numbers** count the source as the author gave it, frontmatter included (the parsers take a line offset), and an unreadable first line is reported as line 1: it is no longer swallowed as a failed header.
- **`Graph.arch` and `%%{arch}%%` are removed.** `config.bonkei` replaces them; an `%%{arch}%%` line is now an ordinary `%%` comment. `Graph` was public on main, so this is a breaking change to that type, made before anything is published.
- **`GraphInput`** is an accepted source: a `Graph` whose `direction`, `groups` and `dropped` are optional (`prepare` fills `TD`, `[]`, `[]`), so a hand-built graph needs only `nodes` and `edges`.
- **Telemetry** goes through `@opentelemetry/api` (a peer dependency), which does nothing unless the embedder registers an SDK. `prepare` emits a `bonkei.prepare` span (attributes `bonkei.input`, `bonkei.diagram`, `bonkei.nodes`, `bonkei.edges`, `bonkei.dropped`, `bonkei.layout_ms`; events `bonkei.dropped_lines` with a count per reason and `bonkei.frontmatter_warning` per bad key; status ERROR with `bonkei.error.kind` and `bonkei.error.line` on failure), with a `bonkei.layout` child around the layout alone.

**Alternatives considered.**
- Top-level keys in `config` (`config.mode`, `config.labels`, ...): they collide with Mermaid's own `config` keys and with MER-32's planned `config.theme` / `themeVariables`, and a Mermaid renderer reading the same block would see keys it does not know.
- Keeping `%%{arch: ...}%%`: a private directive no Mermaid tool understands, parsed with a hand-rolled JSON fix-up, duplicating what frontmatter already does.
- A single `onError` with a `severity` field for both problems and failures: an embedder treating every `onError` call as a failure (showing an error screen, failing a build) would be wrong for every dropped line. Splitting the channels costs nothing now, but would be a breaking change once BON-52 publishes the API.
- `JSON_SCHEMA` (Mermaid's choice) or js-yaml's default schema for the frontmatter: `CORE_SCHEMA` reads plain YAML 1.2 scalars (`true`, `3d`) the way authors expect, without the default schema's extra types.
- Merging a props `controls` object into the frontmatter one control by control: it makes "turn on only zoom" from props impossible to say without listing every other control.

**Consequences.** Any string or `GraphInput` becomes either a drawable result with its warnings or one `BonkeiError`; `prepare` never throws synchronously. Authors learn which lines were dropped and why, at the line they wrote. Diagrams carrying `%%{arch}%%` still render (the line is a comment) but its settings are ignored; the playground's large sample still has one, now inert. Embedders who register an OpenTelemetry SDK see parse and layout timings with no setup in Bonkei; everyone else pays only for the no-op API.

## 2026-11-15 — The Bonkei component and render() (BON-51)

**Context.** With options, errors and `prepare` in place (the entry above), core needed the thing embedders actually use: `<Bonkei source={...} />` for React pages and `render(element, source, options)` for every other page. It has to survive several instances on one page, inline props from a parent that re-renders often, sources that fail, and browsers that cannot draw at all. The apps still import the old, uncurated barrel; they move in a later sub-task.

**Decision.**
- **Mode is semi-controlled.** The declared mode (the `mode` prop, else the frontmatter's `config.bonkei.mode`, else `iso`) sets the first view, and a change to it moves the view. The toolbar and the handle's `setMode` move the view too, and those picks stay until the declared mode changes again; they are never reverted by a re-render. The prop sync compares against a `prevMode` ref in the effect body, never inside a state updater. Every change fires `onModeChange(mode, { source })` with `source` `toolbar`, `handle` or `prop`; the first view is not a change and fires nothing.
- **`onReady` means the first frame drawn with this data.** `SceneView` gains an `onFirstFrame` hook: on the first frame with each new `data` it fits with the canvas's real aspect, snaps the camera there if this view has never shown a layout (later updates tween from where the reader was), then fires once. `onReady({ layoutMs, nodes, edges, dropped })` fires from it. The camera gains `fit(width, height)` and `snap()`.
- **Render-time crashes are caught.** A `SceneBoundary` around the scene turns any crash while drawing (no WebGL context, a renderer bug) into the error card and one `onError({ kind: 'render', message })`, telling a WebGL failure apart by its message or by `getContext('webgl2')` returning null. A newly prepared source resets it. The brief asked only for parse errors through `onError`; we went further because the commonest real failure on the open web is a machine without WebGL, and an uncaught render error unmounts the host page's whole React tree.
- **Two channels, counted.** `onError` is called exactly once per failure, and `onWarning` exactly once per warning (dropped lines and frontmatter problems), on success and on failure alike. There is no `severity` field. A first-load failure shows the card ("This diagram couldn't be drawn" and "line N: message"); a failed update keeps the last diagram and shows a strip ("Not updated · line N: …").
- **A graph source is compared by structure.** The `prepare` effect is keyed on the string itself or on a sorted-key JSON of the graph, not on object identity, so an inline literal re-created on every parent render lays out once. Without it, a parent that sets state in `onReady` loops forever. Each run takes a sequence number and only the latest may land, so a slow earlier `prepare` never overwrites a newer one. Callbacks are read through a ref, so inline handlers cause no re-layout either.
- **`onNodeClick({ id, label, kind })`** fires on a click (pointer moved under 4 px) on a node, a group or a sequence participant, whatever `controls` say: clicks are the author's, controls are the reader's. The pointer cursor shows only if the author passed `onNodeClick`.
- **`controls`.** `zoom`: the wheel zooms; off, the wheel is left alone so the page scrolls. `pan`: dragging the ground pans (orbits with the primary button in 3D); off, it does nothing. `move`: dragging a node moves it; off, the drag falls through to the ground. `drillIn`: clicking a group zooms to it. The cursor follows (`grab` only with `move`, `zoom-in` only with `drillIn`) and is set on the instance's own canvas, never on `document.body`. The decisions live in `controls.ts`, pure and tested. No hint text or overlay is drawn unless asked for: the only chrome is the toolbar (flat/iso/3D radiogroup and fit, shown once laid out when `toolbar` is on), the loading text and the error card or strip.
- **`wheelZoom` stays on `SceneView` as a deprecated alias**: when `controls` is not given, `wheelZoom={false}` means zoom off. The site's hero still passes it, and it moves to the public API in a later sub-task; removing the prop here would break this change's own `pnpm -r typecheck` or force a site edit into a core commit. The curation sub-task removes it.
- **Sizing fills the container**: the root is `position: relative; width: 100%; height: 100%; min-height: 0`, with `data-bonkei="loading|ready|error"` for tests and styling. A container with no height draws nothing (and `onReady` does not fire); the embedder gives it a height.
- **Per-instance everything**, building on the per-instance camera entry (BON-70): each `<Bonkei />` makes its own camera with `useState(createCamera)` and holds its own state, cursor and listeners, so instances on a page share nothing.
- **`render` owns its React root.** `render(element, source, options)` calls `createRoot(element)` and returns a `BonkeiHandle` (`update`, `setMode`, `fit`, `destroy`, extending the component's `BonkeiViewHandle` of `setMode` and `fit`). A `setMode` before the view has mounted is folded into the rendered `mode`, so it is not lost. After `destroy` (which unmounts the root) every call does nothing and throws nothing.
- **Exports.** `bonkei` adds `Bonkei`, `render`, `isBonkeiError` and the public types, and keeps every old export until the apps move. `bonkei/internal` (`src/internal.ts`) carries the renderer, camera, scale, parser, layout, sequence functions, `prepare` and the resolved option types for the workspace's own apps.
- **Telemetry**, through `@opentelemetry/api` as before: `bonkei.first_frame` (from the source being accepted to the first frame; `bonkei.nodes`, `bonkei.edges`, `bonkei.dropped`, `bonkei.layout_ms`), `bonkei.mode_change` (`bonkei.mode`, `bonkei.mode.source`), `bonkei.node_click` (`bonkei.node.kind`: `node` | `group` | `participant`), `bonkei.control` (`bonkei.control`: `zoom` | `pan` | `orbit` | `move`; one span per gesture: wheel gestures end after 300 ms idle, drags on pointer up) and `bonkei.render_error` (`bonkei.render.cause`: `webgl` | `other`, with the exception recorded and status ERROR).

**Alternatives considered.**
- A fully controlled `mode` (the view only moves when the prop does): every embedder would have to wire `onModeChange` back into state just for the built-in toolbar to work.
- An uncontrolled-only mode (the prop is read once): an embedder could not drive the view from its own buttons without the handle.
- `onReady` when layout resolves: the canvas may not have drawn anything yet, so a fade-in or screenshot keyed on it shows an empty frame, and the fit would use a guessed aspect.
- Letting render errors throw: the host's own error boundary (or none) would take down far more than the diagram.
- Keying the effect on the source object: correct for strings but loops on inline graph literals.
- Making `controls` also gate `onNodeClick`: a read-only embed (`controls={false}`) that still opens a side panel on click would be impossible.
- Removing `wheelZoom` now: see above; it breaks the workspace or mixes an app change into a core commit.

**Consequences.** One component and one function cover React and non-React pages, with failures reported rather than thrown. The barrel is temporarily larger than the intended public surface; the curation sub-task trims it and removes `wheelZoom`. The playground's own `fit` still calls `focusOn` directly until it moves to `bonkei/internal` or the public API. In development React also reports errors caught by the boundary to the console; production builds do not.

## 2026-11-xx — Public surface (BON-51)

**Context.** MER-50's barrel (`packages/core/src/index.ts`) exported everything the engine had: the parser, the ELK layout, the layout output types, the renderer, the camera. The entry above added `<Bonkei />`, `render()` and their types next to that and kept the rest until the apps moved. Both the playground (BON-82) and the site (BON-83) now run on the public API, so the barrel can shrink to what embedders are meant to use before BON-52 publishes it. Anything public then is a promise; anything left out can be added later without breaking anyone.

**Decision.**
- **`bonkei` exports exactly this list**, and nothing else:
  - `Bonkei` and `render`;
  - the types `BonkeiProps`, `BonkeiOptions`, `DiagramOptions`, `Controls`, `BonkeiHandle`, `BonkeiViewHandle`, `BonkeiError`, `BonkeiWarning`, `NodeClick`, `ReadyInfo`, `Mode`, `LabelMode`, `Graph`, `GraphInput`, `GNode`, `GGroup`, `GEdge`, `Shape` and `Dropped`;
  - `isBonkeiError`.
  `Dropped` and `GraphInput` are on it because public types refer to them (`Graph.dropped`, `ReadyInfo`'s count of dropped lines, the `source` prop). Each export carries a one-line comment in `index.ts`.
- **`bonkei/internal` is an unstable subpath** (`packages/core/src/internal.ts`, the package's `./internal` export). It re-exports everything else (renderer, camera, scale, palette, controls, parser, layout, sequence functions, `prepare`, the resolved option types, the layout types) under the header "Internal and unstable: for this repo's stories and tools; may change in any release." Apps use only `bonkei`; stories may use `bonkei/internal` (today only `scene.stories.tsx` does).
- **`parse`, `layout`, `LayoutEngine` and the layout output types (`Box`, `Route`, `LayoutResult`) stay internal.** Exporting them would freeze the layout's internals (box levels, route points, the ELK-shaped engine signature) before themes (MER-32) and the docs plugins exist and tell us what they need from it. Adding them later is not a breaking change; removing them would be.
- **Passing a custom `LayoutEngine` through options is deferred again**, for the same reason: its signature is not settled.
- **`SceneView.wheelZoom` is removed.** It was a deprecated alias kept so each earlier sub-task type-checked on its own; the site no longer passes it.

**Alternatives considered.**
- Exporting `parse`, `layout` and the layout types from `bonkei`: useful to tools that want the layout without the scene, but every field becomes a compatibility promise while the layout is still changing, and no embedder has asked for it.
- A separate, semi-stable `bonkei/advanced` subpath for them: a third tier to document and version, with no user yet to tell us what belongs in it. `bonkei/internal` already serves this repo's stories and tools, and promises nothing.

**Consequences.** `SceneView`, `createCamera`, `parse` and the layout types, which were public on main, are now internal: code importing them from `bonkei` must move to `<Bonkei />` / `render()` or, inside this repo, to `bonkei/internal`. This is a breaking change made before anything is published. `SceneView`'s `wheelZoom` prop is gone (use `controls`). `pnpm -r typecheck` is the guard: an app that imports an internal name from `bonkei` fails it.

## 2026-11-16 — Edges in 3D, routed by libavoid (BON-100)

**Context.** BON-99's prototype was approved: ELK places the boxes, one libavoid router routes every line from pins at the four side midpoints, trays are walls with an opening where a line goes in or out, steps and crossing styles are BON-85's. It left three things not met on the 50-node sample at the default level: a line through a foreign tray (it used another line's opening), 4 lines lying on top of each other, and 15 lines doubling back (main: 14).

**Decision.**
- **Routing is libavoid's, then made direct** (`packages/core/src/avoid.ts`, `monotone.ts`). The prototype's router and tray walls are kept. A line libavoid sends back on itself, or through a block or a tray it does not belong to, is replaced by a **monotone** route: every step brings it nearer its target along x and along y, so it is as short as its two side midpoints allow. It is found on a grid of the coordinates that matter (ends, stubs, obstacle edges, lanes a third and two thirds across each gap), keeps the router's buffer from every block and foreign tray, leaves and arrives square to a side, and pays per crossing (the level's cost) and heavily for lying on another line. A line that has no monotone route at all (its target is behind a block or tray it must go round) keeps libavoid's route, or, if that goes through something, takes the cheapest way round on the same grid.
- **Rip-up and re-route** (`refine`): when the lines are first routed with a crossing cost, each direct line is looked for again against the others as they now are (two rounds) and takes the new route when it crosses fewer lines without lying on more. A line that lies on another is also offered lanes beside every other line. Lines that both lie within 2 px are counted as lying on each other.
- **What the levels mean.** off: no crossing cost, every line direct. some (default): crossing cost 1000, every line direct when it can be. strong: crossing cost 3000, and a line libavoid stepped aside to avoid a crossing keeps that jog when going direct would cross more lines (`SLACK`). So "no doubling back" holds at off and some; strong trades it for fewer crossings, which is what the viewer asked for by choosing it.
- **Lines from the same side midpoint** fan out from the corner after their stub; `route-metrics.ts` counts that shared first run with the shared pin stubs, not as lines on top of each other.
- **The rest is the prototype's**: side pins (the router picks the side; ELK's fixed ports are kept for placement only), docks 14 px outside a tray's rim for an edge to the tray, one step outside the outermost tray rim crossed (`edges3d.ts`), BON-85's spacing, crossing styles (none default; bridge, tunnel, portal), the portal budget, the flat-view light. The `routing: basic` and `ends: spread` options the prototype also tried are not built.
- **Telemetry**: `bonkei.route` (layout: level, ms, unroutable, straightened, refined, forced turns, `bonkei.route.fallback` when the wasm fails), `bonkei.reroute` (a re-route at a new level), and `bonkei.crossings.change` / `bonkei.avoid_crossings.change` events for a toolbar pick.

**Measured** (`apps/playground/scripts/route-metrics.ts`, 50-node sample, level some): 0 through a block, 0 through a foreign tray, 0 lying on top of each other, 0 ends off a side midpoint, length / straight distance 1.00 (main 1.12), 2 doubling back (main 14): e0 Client → WAF and e39 OrderQ → NotifSvc, cycle edges whose target is behind blocks and trays every route must go round (no monotone route exists, `canGoDirect` false). Crossings off 90, some 47, strong 26 (main 19 with ELK's routes, which double back 14 times). Small sample: all 0, 1.00. Drag (`drag-check.ts`): 0 frames with a line through a block or a foreign tray in 168; ~30 ms a frame.

**Alternatives considered.**
- Keep libavoid's crossing-avoiding routes as they are (the prototype): 16 crossings at some, but 15 lines doubling back and one through a foreign tray.
- Prefer the way round over the direct route when it crosses fewer lines: 52 crossings, 5 doubling back.
- Every line direct at every level: some and strong both 66 crossings, so "strong" would mean nothing.
- Gates or checkpoints for trays (tried in the prototype): many overlaps or failed routes.

**Consequences.** At some, there are more crossings than with libavoid's own routes (47 against 16): the lines go straight instead of jogging round each other. The crossing styles exist to make those readable; strong is there for a viewer who prefers fewer crossings. Routing the first time costs ~1.8 s on 50 nodes at some (~0.3 s at off); a drag frame never pays the crossing cost or the re-route pass, so a drag can add crossings, and choosing the level again routes everything afresh.

## 2026-11-16 — No line turns back (BON-102)

**Context.** BON-100 left, on the 50-node sample, 2 lines doubling back at some (e0 Client → WAF, e39 OrderQ → NotifSvc) and 15 at strong, where `SLACK.strong = 0` let a line keep a sideways jog. Drag frames could turn a line back too.

**Decision.**
- **A block slides so its line can go direct** (`monotone.ts` `unblock`, called at the end of `layout.ts` `place`). A line with no monotone route at all (`canGoDirect` false) has to turn back whatever the router does. One of its two blocks is moved across the flow (x in TD, y in LR) by the smallest step, 4 px at a time and at most 240 px, that gives the line a direct route. The block has to stay 40 px inside its tray, keep ELK's edge-node gap from every other block and tray, and leave no other line without a direct route. `stats.slid` lists the blocks moved.
- **ELK's cycle breaking is back to its default, GREEDY** (main's). Depth-first put Client below the Platform tray, under WAF's own tray.
- **No level keeps a jog**: `SLACK` is Infinity at every level. Strong now means more rounds of rip-up and re-route (`REFINE_PASSES`: some 2, strong 4) at a higher crossing cost.
- **Checks**: `apps/playground/scripts/routes.test.ts` (`pnpm --filter @bonkei/playground test`) holds the 50-node sample to this at every level and while a node is dragged. `drag-check.ts` counts frames that turn back, and counts apart the frames where the drop leaves no direct route.

**Measured** (50-node sample, `route-metrics.ts`): doubling back 0 at off, some and strong. 0 through a block or foreign tray, 0 lying on top of each other, length / direct 1.00 (main 1.12). Crossings: off 96, some 52, strong 48. Drag (`drag-check.ts`, 168 frames): 0 through a block or tray, 0 turning back where a direct route exists. 13 frames turn back because the drop puts the target straight behind another block, where no route that avoids the block can be monotone.

**Consequences.** Blocks can sit up to 240 px off where ELK put them. While a node is dragged, a line still turns back if the drop leaves no direct route. The drag never slides other blocks, because they would jump under the pointer.

## 2026-11-17 — Bonkei on bonkei.dev (BON-105)

**Context.** The site is to go live on its own domain, bonkei.dev, served by GitHub Pages from the renamed infinitedusky/bonkei repository. The build still targeted the old Pages subpath (`/merman/` and `/merman/app/`), its link preview pointed at infinitedusky.github.io/merman/, and the page titles, the home page and the GitHub links still said merman. Served from the root of bonkei.dev, every asset URL would have 404ed.

**Decision.**
- The site serves at `/` and the viewer at `/app/` on bonkei.dev. Both apps build with those bases in every mode (dev, build and preview), so `apps/site/vite.config.ts` has `base: '/'` and `apps/playground/vite.config.ts` has `base: '/app/'`. The site's `/app` proxy to the viewer's dev server is for dev only; preview turns it off so it serves the built viewer from `dist/app/`.
- The visible name is **Bonkei**: page titles, `og:title`, the home page's nav, hero and footer. Its links go to https://github.com/infinitedusky/bonkei. `VITE_SITE_URL` is `https://bonkei.dev/`, so `og:url` is `https://bonkei.dev/` and `og:image` is `https://bonkei.dev/og.png`.
- The custom domain lives in the repository's Pages settings, because Actions-based Pages deploys ignore a CNAME file in the artifact. `apps/site/public/CNAME` (`bonkei.dev`) is shipped anyway, as a record of the domain in the repo and in case publishing ever switches to a branch.
- `scripts/check-pages.mjs` runs at the end of the root `pnpm build` and guards the artifact: it fails the build, and so the deploy, if `dist/` mentions merman, a page points at a missing file, the bonkei.dev `og:url`/`og:image` or a Bonkei title is missing, or `dist/CNAME` is not `bonkei.dev`.
- `.github/workflows/pages.yml` runs on every push to main and on `workflow_dispatch`, with `concurrency.cancel-in-progress: false` so a deploy that has started finishes and queued runs collapse to the latest.

This supersedes the 'Names (BON-50)' entry's choice to keep the site's copy, its page titles and the `/merman/` base, and the `/merman/` and `/merman/app/` bases set in 'The Pages artifact and the dev proxy (BON-50)'.

**Alternatives considered.**
- Keep the `/merman/` subpath and redirect the domain's root to it: the old name would stay in every public URL, and a static Pages site can only redirect with a meta-refresh page.
- Set the base through an environment variable: one site, one domain, so a variable only adds a way to build a wrong artifact; the check would still be needed.
- Filter the push trigger by path (deploy only when the apps change): the brief asks for every merge to main to publish.

**Consequences.** The old infinitedusky.github.io/merman/ URLs stop working. Internal names still say merman: the Storybook flow `merman.flow.json`, the dev-only capture page (`apps/site/dev/capture.html`) and `sketches/`. None of them reach `dist/`.

## 2026-11-17 — Themes: Classic, Bonkei, Bonkei · landscape, and the brand home (BON-117)

**Context.** BON-116 gives Bonkei its own look, drawn from Utagawa Yoshishige's 1848 tray-landscape prints: a logo, a home page in the brand, and two themes the library draws per diagram. Classic must not change by a pixel. A prototype (`prototype/bonkei-themes-in-the-real-engine-tpvd`) proved the engine side; this is the real build of it.

**Decisions.**
- **A theme is data** (`theme.ts`, plain TS): one typed, JSON-serialisable `Theme` (ground, light, node, tray, label, ink, edge, seq). The scene reads tokens only (`look.tsx`: `ThemeProvider`, `Mat`, `Ink`, `PlateText`, canvas-drawn tray patterns and paper grain, landscape forms); nothing in scene code names a theme. Classic holds the colours that were in `palette.ts` `SCENE` (removed). *Turned down:* a component set per theme, which would fork the scene and is what BON-32 rules out.
- **Picked per diagram, Mermaid's way**: `config.theme` and `config.themeVariables` in the frontmatter (outside `config.bonkei`, where Mermaid keeps them), or the `theme` prop (a name or a whole `Theme`), which wins over the frontmatter name; the frontmatter's variables apply on top of either. `resolveTheme()` is that rule, pure and tested. *Turned down:* variables in props too (one way to override per diagram is enough for now; BON-32 owns the editor).
- **Variables are checked**: a dotted path (`edge.flat`, `tray.colors.0`, or nested maps) must exist, keep the token's type (a nullable token takes null or the type the presets give it), and, for word tokens (`node.form`, `tray.sides.#`, ...), be one of the words. A bad one is skipped and warned (`kind: 'theme'`, with its frontmatter line). An unknown name draws in Classic and warns (line 0 when it came from the prop). *Turned down:* failing the diagram, which would punish a typo in a look.
- **Presets are frozen** and exported (`CLASSIC`, `BONKEI`, `BONKEI_LANDSCAPE`, `THEME_NAMES`, type `Theme`): new public names. Frozen because every diagram on a page shares them; copy to edit.
- **A new look remounts the scene under the canvas** (keyed by the whole token object): the ink pass rescales line widths in place, and only a remount gives each line its token width back. The camera and the first-frame fit stay outside the keyed subtree, so the view keeps its place; drags made before a theme switch are dropped.
- **Ink follows the drawing's scale** (`ink: { ref, min }`, Classic `ref: null` = fixed widths): outline, edge and silhouette widths, cartouche borders and the landscape forms' strokes (re-rasterised in quarter-octave steps) all use `inkPx`, so the ink reads the same on a phone and a desktop.
- **Landscape forms are billboarded SVG cut-outs** on a raised plinth (the node's footprint, a step darker than what it stands on). Lines dock at the plinth's mid-height. Forms write no depth and paint back to front, and landscape label plates join the transparent pass after them, so a label is never hidden behind another node's form (seen in 3D on the mockup sample: Cache's bonsai covered Postgres's label). *Turned down:* modelled meshes (more faithful from low angles, much more work per form).
- **Tray titles go to a free corner** (`tray.titles: 'free'`, Classic `fixed`): the first corner no node or child tray (grown by a form's overhang) covers, kept while it stays free so it does not jump during a drag (`titles.ts`).
- **A tight fit frames what the view shows** (`fit="tight"`): the top-level boxes' corners, on the ground and at the tallest form, projected on the screen's axes, and the camera centred on them (`projectedFit`). The prototype framed the bounding rectangle turned by the yaw, which left a diagonal diagram small in a wide frame (the Themes section at 1280 px). Only with `tight` and only for the whole diagram; flying into a tray and the default fit are unchanged. `minLabelPx` opens a phone on the largest tray with readable labels; `fit()` shows the whole.
- **The home page is `Home.tsx` in the brand**, not a copy beside it: cream paper, ink, Zen Old Mincho headings (`@fontsource/zen-old-mincho`, Latin subsets, served with the site instead of the prototype's Google Fonts request), the logo in nav and footer, the small mark as favicon (site and viewer), every section kept, the hero still Classic and its poster unchanged, and a Themes section after Views. The site's name stays merman (renaming is out of scope). The Themes section's scene is a lazy chunk (`ThemesScene.tsx`) mounted when the section comes near the screen, so the first paint and phones never wait for it; without WebGL 2 it says so.

**Measured.** Classic: 0 differing pixels (exact, no fuzz) against the branch base in flat, iso and 3D on the playground's first sample, canvas only. 60 fps with the Bonkei themes on the large sample on the person's machine (prototype). Tests: `theme.test.ts`, `titles.test.ts`, camera (tight, projected, minLabel), options and diagram (theme request, warnings, span attributes), `flatLine`.

**Telemetry.** New `bonkei.theme` span per look drawn (`bonkei.theme`, `.source` prop/frontmatter/default, `.requested`, `.variables`, `.unknown`); `bonkei.prepare` carries `bonkei.theme.requested` / `.variables` and a `bonkei.frontmatter_warning` event (with `bonkei.warning.kind`) per bad theme name or variable; `bonkei.first_frame` carries `bonkei.theme`.

**Consequences.** Adding a look is a preset plus, for a new capability, a token. Known limits (follow-ups outside this task): the toolbar and error card stay dark on cream; forms are flat cut-outs from low angles; round bowls need a layout change.

## 2026-11-17 — Bonkei as an installable package (BON-52)

**Context.** `bonkei` was consumed only as source inside this workspace ("Source consumption (BON-50)"), on React 18, with ELK in the main import and `@opentelemetry/api` as a peer. People should be able to `npm install` it into a current React app and have it work, and a reviewer should be able to try each PR the way a user would.

**Decision.**
- **Build with tsdown** (`packages/core/tsdown.config.ts`): ESM + `.d.ts` for `bonkei` and `bonkei/internal`, `sideEffects: false`, `files: ["dist"]`. The exports map points at `dist/`. This supersedes "Source consumption (BON-50)": the playground, the site and Storybook now run against `dist/` (`pnpm dev` runs `tsdown --watch` beside the apps), while node tests and scripts still import `src`. Turned down: tsup (in maintenance; tsdown is its successor and runs publint and attw itself), plain `tsc` (no bundling of the wasm fallback or the IIFE), Vite library mode (one more config for what tsdown does with less).
- **React 19 only, with Fiber's own range.** Core, playground and site move to React ^19.3, React Three Fiber 9 and drei 10. The peers are `react` and `react-dom` at exactly Fiber's `peerDependencies` (today `>=19 <19.4`) and `three >=0.170`; `package.test.ts` fails when they drift. Turned down: `^19` (would let a host install a React Fiber refuses, which only shows up as Fiber's peer warning or a runtime break); keeping React 18 (Fiber 8 is the last line for it, and the brief rules it out).
- **`@opentelemetry/api` is a dependency, not a peer.** It is a global-singleton API package, built for exactly this: libraries depend on it, and a host that registers an SDK shares the one instance. A host installs nothing extra and gets no missing-peer warning. Turned down: an optional peer (`peerDependenciesMeta`), which still prints warnings on some package managers and needs a guarded dynamic import.
- **ELK on first layout.** `layout.ts` imports `elkjs/lib/elk.bundled.js` dynamically inside a `bonkei.elk.load` span, so a host's bundler makes it a chunk of its own. Turned down: ELK in a web worker (out of scope for this task).
- **The wasm, found in a fixed order** (`avoid.ts` `findWasm`, inside a `bonkei.wasm.load` span): a URL set with `setAvoidWasm`; else `new URL('./libavoid.wasm', import.meta.url)`, which Vite, webpack and Rollup turn into an asset; else, when that fails, the same bytes from a lazy chunk holding them as base64 (`_libavoid-inline-*.js`, with a `bonkei.wasm.fallback` event). The fallback exists because Vite 5's dev pre-bundling moves the module away from the file, so the URL 404s; with it, a default `vite.config.ts` works on Vite 5 and 8. Turned down: asking hosts to set `optimizeDeps.exclude` (breaks "it just works"); always inlining (adds about 64 kB gzip to every download that would have got the file).
- **The themes' font, found like the wasm** (BON-159; `fonts.ts`). Main's themes (BON-116) bundle Zen Old Mincho Bold, Latin subset (31 KB, 19.6 kB gzip). The file and its SIL OFL text are copied to `dist/fonts/` (`finish-build.mjs`). Its URL is made only when a theme first asks for the font, never on import: from `new URL('./fonts/…', import.meta.url)` in the ESM build (the chunk sits at `dist/`, so the path matches, and a host build emits it as an asset), and from the same `document.currentScript` base as the wasm in the script tag (`fonts/` beside `bonkei.global.js`). Before this, the URL was made at module top level, and the IIFE (no `import.meta.url`) threw `Invalid URL` while the script loaded. `loadFont` fetches the file once inside a `bonkei.font.load` span and checks that it starts like a font. drei gets the bytes as a `blob:` URL, so the file is downloaded once. If the file is missing or is not a font, labels use drei's default font, with a `bonkei.font.fallback` event and an `onWarning` (`kind: 'theme'`, `font mincho could not be loaded from …`). Labels wait for the check with React 19's `use`, inside the Suspense drei's `<Text>` already needs.
  - *Vite 5 dev, seen in the smoke test:* pre-bundling moves the module to `.vite/deps/`, and Vite answers `.vite/deps/fonts/ZenOldMincho-Bold-latin.ttf` with **200 and a 524-byte HTML page**, not a 404. Without the check, troika would get HTML, its loader would never call back, and the theme's labels would never draw. With the check, the labels draw in the default font and the warning names the URL. Current Vite dev, both previews and the script tag fetch the file with 200.
  - Turned down: a fallback copy of the font inlined as base64 like the wasm (it would put 31 KB in a chunk for a cosmetic loss; the brief rules it out of the main chunk); handing troika the URL directly (a 404 or an HTML 200 leaves the labels suspended forever: troika logs and never calls back); a `setAvoidWasm`-style override (`setFont`). No override, because losing the file costs only the typeface (the diagram, its labels and its routes all draw, and the host is told). Losing the wasm costs the routing. The font sits in the same folder as the wasm, found from the same base, so a host that serves `dist/` as it is gets both. A host that wants another face can pass its own theme once the public API (BON-51) settles what `label.font` may hold.
- **The script-tag bundle** (`dist/bonkei.global.js`, IIFE, `window.Bonkei`): everything inside, React and three too, and `libavoid.wasm` found beside the script through `document.currentScript`. Turned down: the wasm inlined in the bundle (`scripts/measure-inline-wasm.mjs`: 1089 kB gzip against 845 + 179 kB, and nothing can be cached apart).
- **Size budget with size-limit** (`packages/core/.size-limit.mjs`, gzip, peers ignored), reported and enforced on every PR by `andresz1/size-limit-action`. Each limit is the first measured size plus a few per cent of headroom.
- **CI smoke test against the packed tarball** (`scripts/smoke/`): `pnpm pack`, install into a clean copy of `examples/vite`, then Playwright under `vite dev` and `vite build` + `vite preview` (and the same pinned to Vite 5), and the script-tag page with and without the wasm. It passes only when libavoid routed the lines (`routingError` null, `routerBuildMs` > 0). Each page draws the default look and the Bonkei theme, and the font must be fetched with 200 (on Vite 5 dev: fall back with a warning and still draw) (BON-159). Turned down: testing the workspace link (it hides missing `files`, exports and peer problems).
- **PR previews with pkg.pr.new**, `examples/vite` as the StackBlitz template. The package stays `"private": true` as a guard against `npm publish`; the CI job drops the flag in its own checkout only, since pkg-pr-new skips private packages.

**Measured** (first build, gzip, 1 kB = 1024 bytes; the budgets were set from these):

| What | Size | Budget |
| --- | --- | --- |
| Main chunk, `import { Bonkei }` (React, three, ELK excluded) | 179.5 kB | 190 kB |
| ELK chunk (fetched on first layout) | 470.0 kB | 480 kB |
| `libavoid.wasm` (fetched on first layout) | 178.7 kB | 183 kB |
| wasm fallback chunk (only if the file is not found) | 242.7 kB | 255 kB |
| `bonkei.global.js` (React, three, ELK inside) | 844.9 kB | 880 kB |

**Re-measured with main's themes merged** (BON-159, same units):

| What | Size | Budget |
| --- | --- | --- |
| Main chunk, `import { Bonkei }` | 188.9 kB (188.4 kB at the merge, a153be6; +0.5 kB the font loading) | 190 kB, unchanged: still under it, now with 1.1 kB to spare |
| Zen Old Mincho font, `dist/fonts/ZenOldMincho-Bold-latin.ttf` (fetched when a theme names it) | 19.6 kB (31.4 kB raw) | 21 kB (new) |
| `bonkei.global.js` | 854.3 kB | 880 kB |

The other rows are as above. The themes (BON-116/117) are the 8.9 kB rise in the main chunk since the first build.

A host Vite 8 build puts ELK in `elk.bundled-*.js` (1,428 kB raw, 442 kB gzip) apart from `index-*.js`; `vite preview` fetches it on first layout in about 35 ms locally. Adding about 22 kB of random data (30 kB as base64) to the main chunk failed the size check: 202.3 kB against 190 kB, exit code 1.

**Consequences.** Running an app or Storybook on its own needs `pnpm --filter bonkei build` first (the root scripts do it). A Fiber bump means copying its React range. The first PR's size comment has no base numbers to compare with, as main has no `.size-limit.mjs`. React 18 hosts cannot use Bonkei.

## 2026-11-17 — Quieter defaults: a short toolbar (BON-161)

**Context.** A Bonkei diagram dropped into a docs page opened in iso, and its toolbar carried the view switch, Fit, the crossing-style group (No hop / Bridge / Tunnel / Portal) and the avoid-crossings group (Off / Some / Strong). In a docs page the crossing style and how hard lines avoid crossing are the author's choices, not the reader's, and a row of unfamiliar buttons gets in the way.

**Decision.**
- **The default `mode` stays `iso`** (BON-51 unchanged). Depth is what sets Bonkei apart, so a diagram leads with it; an author who wants a plain diagram sets `flat` by prop, by `render()` option or in `config.bonkei.mode`.
- **The toolbar is View + Fit by default.** This replaces BON-100's always-on crossing groups. A new option, `crossingControls: boolean` (default `false`), turns both crossing groups on together: one switch, set by prop, by `render()` option or by `config.bonkei.crossingControls`, merged props over frontmatter like every other key. `toolbar: false` still hides everything, crossing groups included.
- **Setting `crossings` / `avoidCrossings` never depends on the controls showing.** The component keeps their state as before and `SceneView` draws it; only the `Toolbar` props are left out when `crossingControls` is off. `crossings: 'bridge'` with no controls draws bridges.
- **Bonkei's own viewer passes `crossingControls` itself**, so it keeps showing every group.
- **Telemetry.** `bonkei.first_frame` gains `bonkei.mode` (the view the diagram opened in) and `bonkei.crossing_controls`, so traces show what readers saw first.

**Alternatives considered.**
- `toolbar: 'full'`, or a per-group `toolbar` object: a step towards the rearrangeable toolbar the brief rules out, and it mixes a mode string into a boolean.
- Two booleans, one per group: the brief asks for one switch.
- Making `flat` the default: depth is what sets Bonkei apart, and an author who wants a plain diagram can set `flat`. The person tried flat as the default (BON-162) and chose iso (BON-165).

**Consequences.** Embeds that relied on the toolbar's crossing groups lose them until they set `crossingControls`. This is a change in behaviour, made before the package is published. Tests: `options.test.ts` (defaults, the frontmatter key and its warning, the merge). Stories: `Bonkei / Overlay Toolbar`, `Overlay Toolbar With Crossing Controls`, `Bridges Without Controls`.

## 2026-11-17 — Embeds: script tag and VitePress (BON-53)

**Context.** People write docs in plain HTML, VitePress and Mintlify; Bonkei should drop into the docs they already have. BON-52 gave a script-tag bundle with `Bonkei.render(el, source)`, which still needs a line of code per diagram, and nothing for a docs site generator.

**Decision.**
- **A `<bonkei-diagram>` custom element in the script tag** (`element.ts`, defined by `global.ts` only; the ESM package defines no element, so importing `bonkei` still runs nothing). Its text is the source, read once and dedented, then cleared; `mode`, `theme` and `height` are attributes; it is `display: block` and gets 420 px when nothing else gives it a height (a page that forgets a height would otherwise draw nothing). `connectedCallback` draws with `render()`, `disconnectedCallback` destroys, so a removed element releases its React root and WebGL context and a moved one draws again. `customElements.get` guards the definition, so a page that loads the script twice does not throw. It fires `bonkei-ready` and `bonkei-error`. Turned down: a shadow root (Bonkei's toolbar and error card are styled inline, and a page could not style the box); observing the text for changes (a docs page's diagram does not change; `Bonkei.render` is there for pages that need it).
- **`<pre class="mermaid">` only on request: `Bonkei.run({ querySelector })`.** It replaces each block holding a flowchart or a sequence diagram with a `<bonkei-diagram>` and leaves every other type as text; it never runs by itself. Turned down: converting `pre.mermaid` automatically, which would take blocks from Mermaid.js on pages that also load it; Mermaid's own `startOnLoad` naming, since our run converts and theirs draws.
- **Which sources Bonkei claims**: a flowchart (`flowchart` / `graph`) or `sequenceDiagram`, after optional frontmatter and `%%` comment lines (`embed.ts` `isSupported`). `@bonkei/vitepress` keeps a copy in its config side, which runs in Node at build time and must not import `bonkei` (React, three, wasm); both test files run the same cases.
- **`@bonkei/vitepress`** (`packages/vitepress`, private): a markdown-it plugin for `markdown.config` that overrides the `fence` rule and chains to the rule that was there (VitePress's code block, or another Mermaid plugin installed earlier); and a Vue component, registered by one line in the theme's `enhanceApp`, that renders an empty box of the set height on the server and loads `bonkei` with a dynamic `import()` in `onMounted`. The source travels percent-encoded in a prop so neither HTML escaping nor Vue's `{{ }}` can touch it. `{height=600}` arrives in `token.attrs` under VitePress (its markdown-it-attrs strips it from `token.info`), so the plugin reads both; `index.test.js` runs it inside VitePress's own `createMarkdownRenderer`. Plain ESM JS with `.d.ts` files and no build step. Turned down: `vitepress-plugin-mermaid` and other Mermaid plugins as a base (they draw with Mermaid.js; ours chains to them instead, so a site can keep one for pie charts); a Vite plugin that rewrites markdown (VitePress's markdown hook is the supported way in); a client-only `<ClientOnly>` wrapper (it renders nothing on the server, so the page would jump).
- **Two install lines, one in the config and one in the theme.** VitePress keeps markdown config and client theme apart, and there is no hook that adds both without patching VitePress.
- **`react`, `react-dom` and `three` are dependencies of `@bonkei/vitepress`, not peers.** A Vue site has none of them, `bonkei` needs them as peers, and the plugin's own dependencies satisfy them, so the site installs one package. The React range is `bonkei`'s own (`>=19 <19.4`). `vitepress` and `vue` are peers. Turned down: peers (every VitePress user would install React and three by hand for a Vue site). Cost: VitePress's `@docsearch/react` asks for React < 19 and the install prints a peer warning for it, harmless unless the site uses Algolia search.
- **Height** is a plugin option for the site (default 420) and `{height=…}` per fence, both in px; the server HTML has the box, so nothing below moves. A non-number height falls back to the site's and `onFence` says so.
- **Telemetry.** `bonkei.element.connect` / `.disconnect` / `.bad_height`, `bonkei.run` (converted, skipped), and `bonkei.vitepress.load` (ms; status ERROR, plus a message in the box, when Bonkei could not be loaded). Build time has `onFence` instead: an OpenTelemetry SDK is rarely registered in a docs build.
- **Mintlify: researched, not built** (`examples/vitepress/mintlify.md`). Components and custom scripts on every plan, npm packages Enterprise-only (React 18, dependencies only, 3 s server render), and Mintlify draws mermaid fences itself; the likely route is a snippet component that loads `bonkei.global.js` from a CDN. Not tried.
- **Smoke** (`scripts/smoke/embeds.mjs`, in `pnpm smoke`): the HTML example with the files from the packed tarball, then `examples/vitepress` with both packages installed from tarballs (the plugin's `bonkei` pointed at the packed core with npm `overrides`), under `vitepress dev` and under `build` + `preview`.
- **Stories.** `Script tag / Elements`, `Elements After Run`, `Elements Added And Removed`, `Element With A Bad Source` frame `examples/html`; `VitePress / Diagrams Page`, `Diagrams Page Before Scripts` (sandboxed, no JS: the reserved boxes), `Page Without A Diagram`, `Mintlify Notes` frame the built `examples/vitepress`.

**Consequences.** Under `vitepress dev` (Vite 5) the wasm file is not served as a file: the loader logs it and Bonkei draws from its inline copy (BON-52's known quirk); build + preview fetch the file. The script-tag bundle grows by about 1 kB gzip (855.2 kB of its 880 kB). VitePress diagrams do not follow the site's dark/light switch (not in this task). `@bonkei/vitepress` is not in the pkg.pr.new preview yet (publishing is not in this task).

## 2026-11-17 — Dev servers on any port (BON-126)

**Context.** In dev the site proxied `/app` to a viewer on a fixed port, 5174 (BON-117 added an undocumented `PLAYGROUND_PORT` override). Prototypes and smoke tests each run their own copy of the site and viewer, so with two copies running, `/app` showed whichever viewer held the port, or nothing.

**Decision.**
- **Two repo-owned variables, read from the shell by both configs: `SITE_PORT` and `VIEWER_PORT`.** `pnpm dev` runs both apps with the same environment, so `SITE_PORT=6100 VIEWER_PORT=6101 pnpm dev` starts a matched pair. They are read inside each `defineConfig` callback, so a test can set them and call the config. They replace `PLAYGROUND_PORT`.
- **Defaults are today's ports.** The viewer listens on `VIEWER_PORT` (default 5174) and is always strict. The site proxies `/app` (with `ws: true`, so HMR passes through) to `http://localhost:${VIEWER_PORT}`. It listens on `SITE_PORT` with `strictPort` only when that is set. When it is unset the site's port is left to Vite (5173), so a plain `pnpm dev` behaves as before.
- **A bad value throws.** Anything that is not an integer 1–65535 stops the server with an error naming the variable.
- **Dev server only.** Only `server` changes. `base`, `build` and `preview` are untouched.
- The three-line `port()` parser is duplicated in each config, because apps never import each other.
- Tests: `apps/playground/vite.config.test.ts` and `apps/site/vite.config.test.ts` (defaults, chosen ports, a bad value), run by `pnpm test`.

**Alternatives considered.**
- Vite's `--port` only: it moves one server, but the site would still not know where the viewer is.
- The viewer on the site's port + 1: hidden coupling, and it breaks when that port is taken. Tools that hand out ports give two, not a pair.
- Reading bare `PORT`: too generic. Shells, CI and other tools set it, and it names only one of the two servers.
- A shared root module for the parser: apps never import each other, and three lines do not justify a package.

**Consequences.** This supersedes the 2026-11-14 entry "The Pages artifact and the dev proxy" on one point: it said the viewer's port 5174 is fixed because the proxy points at it. The default is still 5174, but the proxy now follows `VIEWER_PORT`. The Self Evident prototype command becomes `SITE_PORT=$PORT VIEWER_PORT=$PORT_2 pnpm dev`. A port that is asked for and taken fails loudly instead of drifting. Builds, preview, Pages and Storybook (6006) are unchanged.

## 2026-11-18 — The docs, installed like a user's app (BON-178)

**Context.** BON-127 asked for Bonkei's official docs at bonkei.dev/docs/, written for agents as much as people, and for one real app that uses Bonkei the way users do, so each feature is tried where users meet it. Its prototype was approved; this is the build.

**Decision.**
- **VitePress 1.6, in `docs/`, not a workspace member.** The docs are built with `@bonkei/vitepress`, so the site is the plugin's first real user. Turned down: Docusaurus and MkDocs (not in the brief, and neither would be a use of our own plugin); VitePress 2 (alpha).
- **Installed from packed tarballs with npm, never by workspace link.** `scripts/docs-install.mjs` builds core, `pnpm pack`s `bonkei` and `@bonkei/vitepress` into `docs/.packs/` and `npm install`s them, then refuses a link. `overrides` points the plugin's own `bonkei` dependency (`0.0.0`, unpublished) at the packed one. Turned down: a pnpm workspace member (resolves into `packages/*`); pnpm `injected` (copies the whole package folder, `src/` included, ignoring `files`). npm ships with Node, so CI and Pages need nothing new.
- **`docs/package-lock.json` is committed, without integrity for our two tarballs.** It pins every third-party package; the tarballs change whenever the code does, so the installer drops their `integrity` before and after `npm install` (npm would refuse a changed tarball) and the lock only changes when a dependency does. Turned down: deleting the lock on every install (the prototype: nothing pinned, and the committed lock it had was rewritten on every build); no lock (CI would float).
- **Every example is a ```` ```mermaid ```` fence.** One value per fence (in its frontmatter), so the page's Markdown, `llms.txt`, `llms-full.txt` and Copy page carry every diagram as its source. What the plugin's `{height mode theme}` cannot pass, this site's fence rule in `docs/.vitepress/config.ts` does: `{editor}` (the playground), `{tag}` (a real `<bonkei-diagram>`), `{live}` `{fit=…}` `{minLabelPx=…}` (render() with that prop), `{events}` (every event logged under the diagram), `{stats}` (the `onEdgeStats` count). Turned down: Vue components written in the page (they would vanish from the Markdown agents read).
- **Agents: `vitepress-plugin-llms`** (llmstxt.org): `llms.txt`, `llms-full.txt`, a `.md` beside every page, a Copy page button. Two of its quirks are worked round: `buildEnd` puts `/docs/` back on the API links in `llms.txt`, and the home page has its own Copy page button (`CopyHomePage.vue`, the plugin's composable) because the plugin's asks for `/docs.md` there. Turned down: an MCP server (not in this task).
- **The API reference is TypeDoc (typedoc-plugin-markdown + typedoc-vitepress-theme) on the installed `dist/index.d.ts`**, so it is Markdown and in the agent files too. Descriptions come from JSDoc on each declaration in core (tsdown drops the comment on an `export … from` line); `scripts/dist.test.mjs` now fails for an export without one. `docs/scripts/prepare.mjs` writes each API page's frontmatter description from that JSDoc.
- **Samples are type-checked** with Twoslash (`throws: true`) against the installed package: a sample that names an option Bonkei does not have fails `vitepress build` and names the page (`scripts/smoke/docs-break.mjs` proves it on a copy).
- **"Live example" means a drawn fence.** `scripts/smoke/docs-coverage.mjs` counts an option, event, mode, label or control as shown only if a fence a guide page draws carries it; a type-checked code sample does not count.
- **Telemetry**: `bonkei.docs.playground.edit` (one per edit drawn; status ERROR with the problem), `bonkei.docs.copy_markdown` (with `bonkei.docs.action`), `bonkei.docs.script_tag.load` (ERROR if `bonkei.global.js` could not load), through `@opentelemetry/api`, a no-op unless the site registers an SDK, like Bonkei's own spans. The docs smoke installs a recording stand-in for an SDK and checks they fire.
- **Published inside the one Pages artifact**: `pnpm build` runs `scripts/build-docs.mjs`; `assemble-pages.mjs` copies the build to `dist/docs/`; `check-pages.mjs` fails on a missing index, agent file, `.md` or script-tag file, a link to a missing file, anything that names the workspace or this machine, or a site header without its Docs link. `scripts/serve-dist.mjs` serves `dist/` (or one build under a path) like Pages on `$PORT`.
- **Smoke**: `pnpm docs:smoke` (`scripts/smoke/docs-run.mjs`), last in `pnpm smoke`: build, coverage, a broken sample, every page in Chrome (diagrams drawn = supported fences in its `.md`, no console errors, the playground, Copy page = the `.md`, telemetry, 390/820/1024 px widths, a touch drag), then the four getting-started pages followed word for word in empty projects, the tarballs in place of the npm names.
- **Light only** (`appearance: false`) until diagrams follow VitePress's dark switch. Search is VitePress's local search.
- **Core's look is unchanged.** The prototype's LED track round a tunnel's trench was a scene change with fixed colours outside the theme tokens; the tunnel reads as a dip in iso without it, so it is not in this build.

**Consequences.** Every feature task from here on writes or updates its page in `docs/guide/` and tries the feature there (CONTRIBUTING.md). A renamed option, an export without JSDoc, or an option with no live example fails a check. The Pages build now runs `npm install` against the registry. A core dependency change rewrites the docs lock's two tarball entries.

## 2026-11-18 — Pan, zoom and turn the way people expect (BON-78)

**Context.** A two-finger drag on a trackpad zoomed, 3D could only be moved with a right mouse button (which opens the menu on a Mac), iso diagrams could not be turned, and a diagram in a docs page took the page's scrolling. The prototype (branch `prototype/pan-zoom-and-turn-the-way-people-expect-uw27`) was tried in Storybook and approved; this is its build. The rules are pure functions in `controls.ts` (tested in node); whether a diagram has the gestures is `hold.ts`; `SceneView` wires them to the canvas.

**Decisions.**

- **The wheel moves; pinch and ⌘/Ctrl + wheel zoom** (`wheelAction`), like a map or a design tool. A trackpad sends a two-finger drag as a wheel and a pinch as a wheel with `ctrlKey`, so this one rule covers both inputs. Turned down: the wheel zooming (as before), which makes a two-finger drag zoom and leaves a trackpad no way to move.
- **Flat and iso: a background drag moves, Shift + drag or a right-drag turns, and the turn settles on the nearest quarter turn when let go** (`dragAction`, `settleYaw`); iso stays on its corners and flat stays square. **3D: a drag turns and tilts, and Shift swaps drag and scroll** (Shift + drag or a right-drag moves, Shift + scroll turns). The person chose this after trying the prototype's first pass. Turned down: the same drag in every view (turning is what 3D is for, and it put 3D's main gesture behind a modifier); turning on the right button only (a Mac has no right button without Ctrl, and Ctrl-click opens the menu); free turning in flat and iso (a diagram left at 37° reads badly and cannot get back square without Fit).
- **Touch: one finger moves in every view, two fingers pinch, twist and move; in 3D two fingers up or down tilt** (`twoFingers`). Touch has no Shift, so 3D's drag-turns rule does not carry over; turning goes to the twist. A node drag gives way when a second finger comes down.
- **A diagram in a page that scrolls does not take the page's scrolling.** Until it is taken hold of, a plain wheel or one finger is left to the page and a hint shows ("Click to move the diagram · ⌘ + scroll to zoom"); pinch and ⌘/Ctrl + scroll zoom anyway, as nobody means them as a scroll. A click (a tap, or two fingers) takes hold: a ring and "Esc to let go" show until Esc or a press outside. A diagram with both `pan` and `move` off has nothing to hold (`holdable`), so a click shows no ring. "A page that scrolls" is read live (`inScroller`: an ancestor that scrolls, or the document), so a diagram that fills a page that does not scroll (the viewer, a full-page story) always has its gestures and shows no ring. One finger is kept for the page with `touch-action: pan-x pan-y` until the diagram is held. Turned down: always capturing the wheel (the page gets stuck under the pointer: the complaint this fixes); needing a modifier for every move (the Google Maps embed rule), which makes a trackpad's main gesture a two-hand one; an option to choose (settings for gestures are out of this task).
- **A sideways two-finger swipe over a diagram never goes back a page.** On a Mac a sideways swipe the page does not take is the browser's Back, and Chrome decides from a gesture's first wheel events, so the wheel handler calls `preventDefault` on the first event of every wheel it uses. A diagram not held in a page that scrolls stops a mostly sideways wheel (|deltaX| > |deltaY|) too and shows the hint (`wheelAction`'s `block`), as a page that scrolls up and down has nothing to do with it; a mostly vertical one still goes to the page. The diagram's own box has `overscroll-behavior: none`, so a swipe that reaches its edge does not chain to the page; the host page's html and body are left alone (Bonkei is a library in other people's pages). `inScroller` was checked on the viewer and a full-page story (the document is exactly the window's height, no margin or gutter, so neither counts as a page that scrolls) and needed no change. Turned down: stopping every wheel over a diagram not held (the page gets stuck under the pointer again). A swipe is never quite level, so a stopped one stays stopped (`swipeLatch`): once a wheel is `block`ed, every event until the wheel has been still for `WHEEL_IDLE_MS` (its momentum included) is too; one jittery up-and-down event left to the page would start the page's scrolling, after which Chrome no longer lets the rest be cancelled, and the rest is Back. The wheel is listened for on the diagram's whole box (`data-bonkei-scene`: the canvas, the fps readout, the hint and the ring), not only the canvas. Real swipe navigation can only be confirmed by a person on a Mac trackpad, in Chrome and Safari.
- **The held ring follows the corners of the box that clips the diagram** (`clipRadii`, `insetRadii`): the nearest ancestor that clips and is rounded, less how far the diagram sits inside it, read when it is taken hold of; the chip moves in on a big corner (`chipAt`). Turned down: a fixed 8px radius, wrong for any other box.
- **Fit puts the view back square** (`camera.square()`, then `fit`), turning the short way round (`nearestTurn`), and so does `setMode`. `fit()` itself does not square: it also runs on each new layout, and an edit in the viewer must not undo the reader's turn. The handle's `fit()` squares, like the button.
- **A "?" beside Fit opens a card of the gestures for the input last used** (`gestureRows`): trackpad, mouse or touch, guessed from the device first (`guessInput`: a coarse pointer is touch, a Mac a trackpad, else a mouse) and then from use (`wheelInput`: a mouse wheel moves in lines or big whole steps with no sideways part). The rows differ in 3D. Esc closes it wherever focus is. Turned down: listing every input at once (a long card, most of it about devices not in use); a first-visit coach mark (noise on every docs page).
- **No browser menu over a diagram** (`contextmenu` is prevented on the diagram's box): a right-drag is a gesture there.
- **Telemetry.** `bonkei.control` gains `bonkei.control.via` (`wheel` | `pinch` | `drag` | `touch`; a trackpad pinch is a ctrl wheel in small steps, `isPinch`), `bonkei.control.swapped` (reached with Shift or the right button) and `bonkei.mode`; its `orbit` value is now `turn`. New one-off spans: `bonkei.control.hint` (`bonkei.input`, `bonkei.mode`; once each time the hint appears, not per wheel event), `bonkei.control.hold` (`bonkei.hold` taken | let_go, `bonkei.hold.how` click | touch | esc | outside; only for a diagram in a page that scrolls), `bonkei.help` (`open` | `close`, `bonkei.help.how` button | esc | close, input, mode) and `bonkei.fit` (mode). A two-finger part (zoom, turn, pan) opens its span only past a finger's jitter.
- **Size budget.** The main chunk's limit goes from 190 kB to 197 kB: 188.9 kB before, 192.8 kB with this change (+3.9 kB gzip for the gestures, the hold gate and the card), plus a few per cent, as BON-52 set the others.

**Not in this task.** Keyboard controls, settings to change the gestures, the viewer's crowded top bar at narrow widths. A Mac trackpad's two-finger rotate is not read (only Safari exposes it, as non-standard `gesture*` events); the twist is a touch-screen gesture.

**Consequences.** Code that counted `bonkei.control` spans with `orbit` must look for `turn`. The docs smoke's phone check taps a diagram before dragging it, as a docs page now keeps one finger for scrolling until then. Everything that shows a diagram (viewer, site, docs, stories, `render()`, the script tag, the VitePress plugin) goes through `SceneView`, so all use the same gestures with no change of their own.

## 2026-11-18 — Tunnels you can see: the trench light and rim (BON-181)

**Context.** A tunnel reads as a dark dip that is easy to miss, so the tunnel crossing style hardly shows on dark ground. The docs prototype (BON-127) had a light in the trench, but it was fixed colours outside the theme, and the docs build left it out ("Core's look is unchanged", above). BON-181 brings it back as theme data, with Bonkei's default look untouched. Its prototype (branch `prototype/trench-glow-and-rim-jj8f`) was approved; this is the build.

**Decisions.**
- **The light is theme tokens, `edge.glow` (`Glow`: `core`, `coreWidth`, `halo`, `haloWidth`, `haloOpacity`, `wash`, `washIntensity`), in every preset.** A diagram changes it with `config.themeVariables` like any other token, and its values win over the theme's. Turned down: a separate `bonkei.trenchLight` option (a second way to set a look, outside the theme a diagram already sets).
- **Drawn, not cast.** The floor light is two lines along the floor's outline (a bright core and a wider, faint halo, drei `Line`), and the wash is an emissive colour on the wall material. No scene light is added, so only the trench is lit. Turned down: a point light in the trench (the prototype tried it; it brightened the neighbouring block and line) and a bloom pass (it glows everything bright in the scene, not just the trench, and adds a render pass to every diagram).
- **Defaults: Classic lights its trench grey-white `#e0e0e0` at 30% strength, with no rim (`edge.rim: 'none'`); Bonkei and Bonkei · landscape have the light off (`null` colours) and keep their dark `#2A2622` rim, 2 wide.** The Bonkei looks draw exactly as before (BON-181 keeps Bonkei's default look). Turned down: the colours the prototype went through before the person chose grey-white (a warm gold, then the grid's blue-grey), and a rim in Classic (the light already marks the lip, and Classic's old dark rim, a shade of the surface, is part of what made the trench read as a dip).
- **Strength is a share of a standard light.** The standard (50%) is core 3.5, halo 11 at 0.28 opacity, wash 0.3, kept in Bonkei's (off) light so a Bonkei diagram that only sets a colour gets it; Classic's 30% is 0.6 times those. Only the docs controls speak in %; the tokens are the sizes. Turned down: a single `edge.glow.strength` token (it would multiply three sizes a diagram may also set, and two ways to say one thing disagree).
- **Each part turns off on its own:** `edge.glow.core`, `edge.glow.halo` and `edge.glow.wash` take `null` in every theme (`NULLABLE` in `theme.ts`, though Classic sets them), `edge.glow: off` (or `false`) nulls all three, and `edge.rim: 'none'` draws no rim (`null` still means a dark shade of the surface, as before). Any other value is validated the way every token is (type, not negative, finite) and skipped with an `onWarning`; `edge.glow` with any other word says it is a group that takes `off`. Turned down: `edge.rimWidth: 0` for no rim (a size doing a switch's job, and a diagram that sets a width would bring a rim back by surprise) and `false` for each part (null is how the theme already says "none" for outlines and fonts).
- **The docs controls are data.** `docs/.vitepress/theme/trench.ts` holds what each theme draws on its own, the presets (Theme default; Light only, the light out of the floor and nothing else; All off) and the `themeVariables` a setting writes, tested in `trench.test.ts` against core's own `withVariables`; `TrenchLight.vue` and the Storybook controls story both draw from it. The controls go through the installed package's `render()` handle and write frontmatter shown under the diagram, so what a reader sees is what a fence would do. Turned down: the prototype's two copies of the rules (one in the Vue component, one in the story), which had already drifted on Light only.
- **Telemetry.** `bonkei.theme` gains `bonkei.theme.trench` (the parts drawn: `core,halo,wash`, `rim`, `off`…; `trenchParts` in `theme.ts`). The docs controls add a `bonkei.docs.trench_light.edit` span per change (which control, the parts, strength, whether a colour was picked; ends when drawn, ERROR when it fails; a warning is an event).

**Not in this task.** Bridges and tunnels in the flat view (BON-176). Diagrams without a tunnel draw exactly as before in every theme: `Trench` is the only thing that reads the new tokens.

**Consequences.** Classic tunnels look different (lit, no dark rim); a page that compared Classic tunnel pictures will see the trench change, and only the trench. Dashboards can count lit tunnels by `bonkei.theme.trench`. The root `pnpm test` also runs the docs' `trench.test.ts`.

## 2026-11-19 — The view stays where it is when the diagram changes (BON-195)

**Context.** Every new layout (a new source, a theme set in the frontmatter, a new avoid-crossings level from the frontmatter) ran the first-frame fit again: the camera re-framed the whole diagram and glided there, throwing away the reader's zoom, pan and the tray they had flown into. Editing in the viewer, the docs editor or a `render()` handle was a fight with the view, and the front page's live editor (BON-189) needs the camera to hold still while the visitor types. Its prototype (branch `prototype/the-view-stays-where-it-is-when-the-diag-d6l4`) was approved; this is the build.

**Decisions.**
- **Only the camera's first layout frames the diagram.** `SceneView`'s `FirstFrame` fits and snaps when the camera has no layout yet (`cam.layout` unset, then `cam.adopt`), and hands every later one to `cam.relayout`. The first framing is unchanged (`biggestTray` with `minLabelPx`, `fit: 'tight'`'s content). Fit, `fit()`, `setMode()` and Flat / Iso / 3D frame as before. Turned down: a prop to choose (the brief adds no control; nobody wants the jump back).
- **The view is lined up on what is on screen, not on the diagram's middle.** The camera aims at a point about the diagram's centre, and a diagram that grows to the right moves its centre, so keeping `goal` as it was would slide everything. `relayout` finds the anchor: the node still in the new layout whose middle is nearest the view's centre, else the smallest tray the view's centre is in or near; it must be on screen (within half the view's width of the centre), because a far-off survivor would drag the camera after it. The camera moves by exactly the anchor's move, `goal` and `cur` alike, so there is no glide. With no anchor (everything on screen deleted) it makes up for the centre's move (the origin shift). Sequence diagrams are lined up by their participants (`frameOf`). Turned down: keeping the raw pose (slides on every edit that changes the diagram's size); lining up on the nearest node anywhere (the prototype's first try: deleting what you look at made the camera chase a distant node); the prototype's group ranking, which added 1e6 to a tray's distance and so never let a tray anchor.
- **The tray flown into is followed by id.** `focusOn` takes the tray's id (`Scene`'s drill passes it) as `cam.focusId`. After a new layout the tray is found again and `focus` gets its new middle and size; if it was deleted, the nearest tray that held it in the last layout, else the whole diagram. The camera does not move then; the next mode switch frames the updated `focus` (centring on it, as flying in did) rather than a pan that pointed into a tray that is gone. Without a tray flown into, a mode switch keeps the pan as before.
- **A theme change on the script-tag element is a `setTheme`, not a fresh view.** `render()`'s handle gains `setTheme(theme)` (the same `<Bonkei />`, new `theme` prop), and `<bonkei-diagram>` calls it when its `theme` attribute changes; `mode` still draws afresh, as before. The element's class moved to `elementClass.ts` with `render` passed in, so a test can drive it with a fake. Turned down: keeping destroy-and-redraw for theme (a new camera, so the view resets, against the brief). `@bonkei/vitepress` keeps its destroy-and-redraw on a fence's `theme` change: it happens only while an author edits a page under HMR, and that package is released on its own.
- **Telemetry.** A `bonkei.relayout_kept_view` span per kept layout (`bonkei.view.anchor` node | tray | origin, `bonkei.view.tray` none | found | parent | diagram, `bonkei.view.shift`, `bonkei.view.edits`, `bonkei.mode`): a dashboard sees how often a tray vanished under a reader and how far views were moved to stay put. `bonkei.fit` gains `bonkei.fit.after_edits` (how many layouts the view kept its place through before the reader asked for the whole diagram again). The element adds `bonkei.element.theme_change`.

**Not in this task.** Any change to how Fit or the mode switch frame the diagram; a new control. A `fit: 'tight'` diagram still frames itself again when its container changes size (that is a resize, not a new layout).

**Consequences.** "`fit()` itself does not square: it also runs on each new layout" (BON-78, above) is now only half true: `fit()` still does not square, but it no longer runs on each new layout. Something added out of view stays out of view until the reader moves or presses Fit. Code that drove a view and relied on each new layout re-framing (none in this repo) must call `fit()` itself.

## 2026-11-19 — The docs smoke knows interactive demos (BON-197)

**Context.** The docs smoke checks that every diagram a page draws is a ` ```mermaid ` fence in its `.md`, so agents, llms-full.txt and Copy page carry every diagram. The trench light controls (BON-181) draw a live diagram of their own, so Edge styles drew 15 diagrams against 14 fences and main's CI went red. The page's `.md` also dropped `<TrenchLight />` without a word. Its prototype (branch `prototype/docs-smoke-knows-the-trench-light-demo-2ufy`) was approved; this is the build.

**Decisions.**
- **A demo says what it is: its root carries `data-bonkei-demo="<title>"`.** The check counts the diagrams inside marked roots apart from the fences; each demo must hold exactly one diagram and the page's `.md` must have a heading of that title (outside code fences). Every other diagram is still held to the fence count, so a bare `<Bonkei>` or `<BonkeiLive>` fails as before. Turned down: a list of allowed pages or components in the smoke script (it would pass any diagram added on those pages, and would go stale without anyone seeing); dropping the count by one for Edge styles (the same); counting only diagrams rendered from fences (the stray diagram this check is for would pass).
- **The heading ties the demo to what the Markdown says in its place.** A demo without the heading has nowhere in the `.md` that stands for it, so it fails. Turned down: matching the demo to a fence's source (the demo's source changes with each control).
- **The rule is its own module, `scripts/smoke/diagram-rule.mjs`, tested in `diagram-rule.test.mjs` in the root `pnpm test`.** Turned down: the prototype's self-checks inside `docs.mjs` (they only run in the slow browser smoke).
- **The Markdown carries the frontmatter Light only writes on Classic, as a ` ```yaml ` fence under `<TrenchLight />`**, with a sentence saying so. It is not a ` ```mermaid ` fence, which would draw a second, fixed diagram beside the live one. `trench.test.ts` checks it word for word against `trenchSource`, so a change to the controls' rules that the page does not follow fails `pnpm test`. Turned down: having the docs build write the demo into the `.md` (a change to `vitepress-plugin-llms`'s output for one component).

**Consequences.** A new interactive demo on a docs page marks its root and gets a heading, or the docs smoke fails on its page (CONTRIBUTING says so). The smoke line for a page with a demo names the demo.

## 2026-11-19 — The front page's "Keep the text" section is live (BON-189)

**Context.** The section said the diagram follows the text, beside a read-only `<pre>` and a still (`still-iso.png`, 800×500 at 1x, blurry on a retina screen). BON-195 made `<Bonkei>` keep the view through a new source, so an editor beside a live scene no longer jumps the camera on each keystroke. The page's first load must stay as it was: the hero and Themes already keep the scene out of the entry chunk.

**Decision.**
- **A plain `<textarea>` beside `<Bonkei>`**, the text given to the scene 300 ms after typing stops (`DEBOUNCE_MS`). `<Bonkei>` already keeps the last diagram on a failed update, reports dropped lines through `onWarning` and the failure through `onError`; the section turns those into one short note under the source (`howState.ts`: `howReducer`, `noteOf`). Warnings are gathered per source and shown when it draws, so a note always describes the diagram on screen. Reset puts the sample back; Fit and flat / iso / 3D are the only things that frame the diagram.
- **The hero's gate** (not narrow, not touch-first, WebGL 2), then an IntersectionObserver with a 400px margin, as Themes does. `How.tsx` (in the entry) holds the gate, the observer and the fallback; `HowScene.tsx` (editor and scene) is a `lazy()` chunk; `howGate.ts` (entry) and `howState.ts` (scene chunk) are split so the entry carries only the gate. The entry grows by 2.07 kB (0.61 kB gzip): 237.59 → 239.66 kB.
- **The still comes back** on a phone, without WebGL 2, while the chunk loads, and when the scene fails on its first draw or drawing itself breaks (`fallsBack`: never drawn, or kind `render`). A text that can't be read is not a failure: the last diagram stays with the note.
- **`still-iso.png` is captured at 2x** (1600×1000, shown at 800×500), so the fallback and the Views card are sharp on a retina screen.
- **Telemetry through `@opentelemetry/api`** on a `bonkei-site` tracer (`track.ts`), imported on first use so it is not in the entry chunk. Spans: `site.how.fallback`, `site.how.live`, `site.how.first_edit`, `site.how.update` (one per source given, with its outcome), `site.how.reset`. Fit and mode changes are already `bonkei.fit` / `bonkei.mode_change` from the scene.

**Alternatives considered.**
- **A code editor (CodeMirror, Monaco) with highlighting.** Out of scope for the brief and tens of kB more; a textarea is enough to make the point.
- **Updating on every keystroke.** Each source is a full ELK layout; half-typed lines would flash warnings. 300 ms (the viewer's source panel waits 250 ms) is the prototype's value, tried and approved.
- **The prototype's `site:track` DOM event** for telemetry: not OpenTelemetry, so nothing in the repo's tracing would see it. Turned down for spans on the same API core uses.
- **A static `@opentelemetry/api` import in the site:** about 8 kB more in the entry for a page that registers no SDK. The dynamic import shares the scene's copy.
- **Falling back to the still on any error:** a visitor who deletes everything would lose the scene they were editing. Only a scene that never drew, or a renderer crash, falls back.
- **Turning zoom on in the hero, as the prototype also did:** not part of this section; the hero is left as it was.

**Consequences.** The section is the one place on the front page where a visitor's text reaches the parser and layout; a source that hangs ELK would hang that scene only (it runs in its own `<Bonkei>`). The note's wording depends on core's warning and error messages (`not a node or edge`, `no nodes found`): a change there changes the note. `pnpm --filter @bonkei/site test` now also runs `src/*.test.ts`.

## 2026-11-19 — The home page's live diagrams load onto an empty stage; any change to how Bonkei draws retakes the pictures (BON-209)

**Context.** The hero painted `poster.png` first and faded the live scene over it; the "Keep the text" section painted the source and `still-iso.png` until its scene's chunk came in. Both pictures were older than many of Bonkei's redraws, and the live scene is laid out and framed by today's code, so a visitor saw one layout jump to another, and "Keep the text" changed height when the scene replaced the still. Its prototype (branch `prototype/bon-209-hero-without-a-loading-picture-p-4tql`) was approved; this is the build.

**Decisions.**
- **A desktop never sees a picture first.** The hero decides its path on the first render (`heroGateOf` with `probeGate`, the same gate as "Keep the text": not ≤760px, not a coarse pointer, WebGL 2); the page is client-rendered, so there is no undecided frame. Live: the stage is empty (its own size and background) and the scene fades in on its first real frame; `poster.png` is not in the DOM and not requested. What each part paints is a pure function in `howGate.ts` (`heroShows`, `howShows`), tested in `howGate.test.ts`. Turned down: keeping the poster as a loading screen and keeping it in step with the scene (it would have to match code, theme, camera and the visitor's screen size exactly, and slightly wrong looks worse than nothing for half a second); the prototype's undecided state that painted nothing for a frame and decided in an effect (an extra render for no gain on a client-only page).
- **"Keep the text" shows its own frame while the scene loads.** `Shell` in `How.tsx` is the live section's markup without the scene: the editor's bar, the source read-only, an empty `.how-scene` stage. It shows until the section is near the screen and while the chunk loads, then `HowScene` takes its place and its stage fades in on the first draw, so the section's height does not change. The still is only for a phone, no WebGL 2, a chunk that failed, a scene that threw and a lost context (BON-189's notes unchanged). Turned down: the still as the loading state (the jump this task removes); a blank box of a guessed height (the editor and stage sizes already exist in CSS, so the shell reuses them).
- **The "Keep the text" chunk is fetched when the page is idle** (`requestIdleCallback`, 4 s timeout; 2 s `setTimeout` without it), so the shell is rarely seen for long; mounting still waits for the 400px IntersectionObserver. It shares the Bonkei chunk the hero already fetched. Turned down: prefetching Themes as well, as the prototype did (not part of this task).
- **A hero chunk that fails to load shows the poster** (`SceneBoundary.tsx`, shared with How), instead of unmounting the page.
- **Every picture retaken from today's code** with `pnpm capture`: poster, og, still-flat, still-iso, still-3d, still-seq. `pnpm capture` now builds core first (it failed on a fresh checkout without `packages/core/dist`).
- **Rule: any change to how Bonkei draws (shapes, themes, layout, camera, lines, labels) retakes the pictures with `pnpm capture` in the same PR.** It is in CONTRIBUTING.md, in `.github/pull_request_template.md` (every PR's checklist) and in this PR's PULL_REQUEST.md. Turned down: an automated image-diff check in CI (3D rendering under SwiftShader is not pixel-stable, `still-flat.png` came out different on two runs of the same code, so it would block PRs for no real reason).
- **Telemetry** on BON-189's `track()` (OpenTelemetry spans, a no-op without an SDK; states and times only): `site.hero.path` (`live`, or `poster` with `site.hero.reason` phone | no-webgl2 | forced), `site.hero.ready` (`site.hero.ready_ms`, first render to first frame), `site.hero.fallback` (ERROR, reason `load-error`); `site.how.live` gains `site.how.load_ms` (How's first render to the scene's first frame). The `hero-scene-ready` User Timing mark stays.

**Consequences.** A desktop sees about half a second of empty stage instead of a stale picture. A visitor on a slow connection who scrolls to "Keep the text" before its chunk is in sees the read-only source and an empty stage, not the still. The pictures can still go stale if the rule is ignored: it is a human check on each PR.

## 2026-11-19 — The hero zooms like every other diagram on the site (hotfix)

**Context.** The hero was the only live diagram on the site with zoom off (`controls={{ zoom: false }}`, from BON-83). With zoom off, core passes a pinch or cmd/ctrl + wheel to the page (`wheelAction` returns `pass`), so pinching over the hero zoomed the whole page instead of the diagram. BON-189's prototype turned zoom on in the hero, but its build left the hero as it was.

**Decision.** The hero uses the default controls, zoom included, as "Keep the text" and Themes do. A pinch or cmd/ctrl + wheel over the hero zooms the diagram and the page stays put.

**Alternatives considered.** Keeping zoom off and having core swallow the ctrl wheel anyway: the page could then not be zoomed by a visitor who needs it, and the diagram would not respond either.

**Consequences.** A visitor can zoom the hero away from its framed view; switching mode reframes it. A plain scroll over the hero still scrolls the page until the visitor clicks into it.

## 2026-11-19 — Ishikawa (fishbone) diagrams (BON-142)

**Context.** Bonkei drew flowcharts and sequence diagrams. BON-142 adds Mermaid's `ishikawa-beta`.

**Decision.** A third diagram kind, built the way sequence is: `fish.ts` (parse + our own layout, no ELK) and `FishScene.tsx`, wired through `prepare` (`bonkei.diagram` = `ishikawa`), `SceneView` and the embed/VitePress fence check.
- The keyword is `ishikawa-beta`; `ishikawa` is accepted. The first line after it is the effect (a fish's head), lines at its indent are categories (bones), deeper lines are causes at any depth.
- Category order follows Mermaid: the first are nearest the head, alternating top and bottom (so an existing diagram reads the same).
- Herringbone: every line is level or slanted the bones' way; each item's line leaves its pill's front and ends in an arrowhead on its parent's line; causes of a cause sit on the far side of the parent's line, the first farthest.
- Lines Bonkei cannot read (a tab in the indentation, a line indented less than the effect) are dropped with their line number, like flowcharts'. A keyword-only diagram warns and draws just the spine and head; nothing throws.
- A change of diagram kind in one viewer is framed fresh, not lined up on the last view (BON-195's keep-the-view is for the same kind).

- Checked against Mermaid 11's own drawing (rendered from its CDN in a throwaway page, not kept in the repo): Mermaid reads causes top to bottom on both sides of the spine, so below the spine the first cause is nearest it and its causes hang below it. The layout mirrors that. Differences kept on purpose: our spine has an arrowhead into the head, the head is a fish's, labels are single-line pills (Mermaid wraps them).
- Rows are 54px apart so dense groups clear each other in iso and 3D; in landscape the cause forms are drawn smaller and the pills are not squashed by depth.

**Alternatives considered.** Categories tail-first (as the mockup's first cut): rejected, it reads differently from Mermaid. Running Mermaid's engine: not how Bonkei works.

**Consequences.** Layout sizes are fixed px constants, not measured text; long labels in the landscape theme crowd (its label plates are bigger than the pills). Fit uses the layout's width and height only.

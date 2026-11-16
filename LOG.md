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

## 2026-11-15 — How edges sit in 3D (BON-85)

**Context.** Edges float at the higher of their two ends' heights, so lines between tray levels hang in the air. The person wants React Flow's way of connecting (side midpoints, a turn between levels) applied to every diagram, plus bridges where lines cross.

**Decision.**
- An edge meets a node at the middle of a side, **halfway up the block** (centred vertically), not on the surface it stands on.
- When the two ends are at different heights, the line makes **one** vertical step, straight to the other end's height (never a staircase). It stands just outside the outermost tray rim the line crosses, or, if it crosses none, a short way out from the higher end (the taller block, or a block above a subgraph's rim). The same rule covers any two ends of different height.
- Where lines cross, the horizontal one (in plan) changes; the other stays straight. How it gets past is a **crossing style the viewer selects**, one per diagram. The default is **none**: lines cross flat, as today. Steps are not optional; they are always on. The styles are:
  - **Bridge**: a small vertical hop over the other line, invisible from above.
  - **Tunnel**: down into an open slot cut in the ground (or the tray) along the stretch that dips, under the other line, and back up. The slot is a trough with rounded ends (radius half its width) and an outline at its lip. It is open, so from above you still see the line in it and it is never unclear where it connects. (Two round holes with the line hidden between them were tried first and dropped for that reason.)
  - **Portal**: as in the game Portal, in through one oval and out of another past the crossing, both the same colour (not the game's blue and orange); looking into one you see out of the other, and from behind they are opaque.
- Steps lie in the line's own vertical plane, so flat view shows no steps.
- **More room in the layout**: ELK's node spacing, layer spacing and tray padding go up, so nodes sit further apart and from their tray's edges, and trays come out bigger. Steps outside a rim and tunnel troughs need that room.
- **Flat view lights from almost overhead** (5° off), so shadows are short; iso and 3D keep today's light.
- **Direct routes**: lines take the most direct route ELK can give; none heads off and doubles back. Fixed flow sides (out the bottom, in the top) force U-turns when the target is not downstream, so each end's side is chosen from where the nodes land, as React Flow's floating edges do. Flat view may differ from main wherever ports, spacing and routing change the layout.
- **Portal performance** is accepted as "not measurably slower" than no crossing style; a 10% bound cannot be measured on this machine (±30% run to run).
- BON-85 stays in the Library foundation project.

**Alternatives considered.**
- The line lying on the surface (side midpoint seen from above only): rejected by the person.
- A single riser halfway along, like React Flow's `stepPosition = 0.5`: half the line would float over or cut into a tray.
- A step at every tray edge crossed (a staircase down through nested trays): tried in the sketch, and the person preferred one step straight to the height of where the line is headed.
- 2D line jumps (Visio, JointJS arcs): sideways bulges. The tunnel's flat look (a break between holes) is the same idea as Visio's "gap" style.
- One fixed crossing style: the person wants to choose between bridge, tunnel and portal.

**Consequences.** Between two blocks on the same surface the line runs at mid-block height, not on the surface. Routes need a height per point.

## 2026-11-16 — Lines routed by libavoid (BON-99)

**Context.** BON-85's prototype kept ELK's routes: on the 50-node sample 14 lines still head off and double back (main also has 14), and dragging re-routes straight through nodes. ELK's options (favorStraightEdges, NETWORK_SIMPLEX, cycle breaking, model order, compaction) and choosing sides after a first pass did not fix it.

**Decision.** ELK keeps placing the boxes; **libavoid** (the `libavoid-js` wasm port) routes the lines, orthogonally, around blocks and around trays a line does not go into, from pins at the middle of each side (the router picks the side). Dragging re-routes with libavoid too. The person accepted libavoid-js's licence, LGPL-2.1-or-later: it ships as its own wasm file beside Bonkei.

**Alternatives considered.**
- ELK alone, tuned: tried in BON-85, did not stop the doubling back.
- `@mr_mint/elkjs-libavoid`, JointJS's `@joint/router-avoid`, draw.io's copy: wrappers or tied to another editor; libavoid-js is the plain port.

**Consequences.** A mockup on the 50-node sample (`apps/playground/scripts/avoid-metrics.ts`): length over straight distance 1.03 against ELK's 1.12, a quarter less line, fewer bends, nothing through a block, ~5 ms per drag re-route. libavoid-js has no clusters, so the mockup ran one router per set of trays a line may enter; lines in different routers then overlap (31) and cross more (60 against ELK's 19), and the crossing penalty cannot help across routers. One router for every line, with trays kept closed some other way, is the prototype's question.

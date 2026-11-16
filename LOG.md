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

# Edges in 3D, routed around obstacles (BON-99)

Every edge meets a block at the middle of a side, halfway up the block. Lines route round blocks and trays by the most direct path, step once between heights just outside the outermost tray rim they cross, and can cross as a bridge, tunnel or portal. The viewer picks how hard lines avoid crossing each other: off, some or strong. The decisions are in LOG.md ("Edges in 3D, routed by libavoid (BON-100)" and "No line turns back (BON-102)"). The code map is in CONTRIBUTING.md. TESTING.md is the manual test plan.

## Risks: what this could break, and how you would notice

- **Layout moves.** Blocks sit further apart. ELK's cycle breaking is back to GREEDY, and `unblock` slides a block up to 240 px across the flow. Existing diagrams, the site's stills (`pnpm capture`) and any saved camera framing will look different. You would notice it in the stills diff and in Storybook's Diagram / Edges in 3D stories.
- **First render is slower.** libavoid is a wasm file loaded at run time. Routing the 50-node sample takes about 2.4 s at some and 3 s at strong (0.7 s at off). If the wasm fails to load or route, the lines fall back to ELK's routes. You would notice the delay before lines appear. The viewer's readout shows `ROUTING FELL BACK TO ELK`, and telemetry has `bonkei.route.fallback` and `bonkei.route` with its ms.
- **Hosting the wasm.** The wasm has to be served beside the bundle. Under a different base path (`apps/playground/vite.config.ts` `BASE`) it can 404. Every diagram then silently gets ELK's routes. You would notice that in the network tab and in `bonkei.route.fallback`.
- **Dragging.** Every drag frame re-routes on the kept libavoid router (about 30 ms a frame on 50 nodes). Big diagrams or slow machines may stutter. A line turns back while its block is dropped straight behind another block. You would notice `drag frame` in the readout and the `drag-check.ts` counts.
- **Public options.** `avoidCrossings` and `crossings` are new options, read from frontmatter or props. A bad value in frontmatter gets a warning and falls back to the default (some, and no hop). `pnpm -r typecheck` and `packages/core/src/options.test.ts` guard the option parsing.
- **Portals and tunnels draw extra meshes.** Portals render views of the scene, sharing a per-frame pixel budget (`EdgeScene.tsx` `PIXEL_BUDGET`). A diagram with many crossings uses more GPU. Crossings with no room for a style are drawn plain (the readout's `no room` count). You would notice a frame-rate drop when orbiting Many Crossings.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

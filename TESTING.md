# Manual test plan: edges in 3D (BON-99 / BON-100 / BON-102)

How to check by hand that lines meet side midpoints, route round blocks and trays without turning back, step between levels, and cross in the chosen style. Go through it in this order. The diagrams in the stories are made-up sample data.

Before you start, run the automated checks once. Both must pass:
`pnpm --filter bonkei test` and `pnpm --filter @bonkei/playground test` (the 50-node sample at every level and while a node is dragged).

## 1. Storybook: Diagram / Edges in 3D

Run `pnpm --filter @bonkei/playground exec storybook dev -p 6206` (any free port above 6200 will do) and open `http://localhost:6206`.

1. **Four Directions TD**, then **Four Directions LR**. Every line meets its block at the middle of a side, halfway up the block. None leaves or arrives at a corner.
2. **Nested With Tall Block**. Where a line's ends sit at different heights, it makes one vertical step, just outside the outermost tray rim it crosses. No line hangs in the air between levels. The line to the tall block (Fraud) rises to that block's mid-height.
3. **Sibling Trays** and **Edge To Subgraph**. A line from one tray to another goes out through its own tray's rim and never runs across a tray it does not enter. A line to a subgraph ends just outside that tray's rim, at its height.
4. **Crossing Plain**. The two lines cross flat, as on main.
5. **Crossing** (bridge, iso), then **Crossing Bridge Flat**. In iso, one line hops over the other. In flat (from above), the hop can't be seen.
6. **Crossing Tunnel**, **Crossing Tunnel Flat**, **Crossing On Tray**, **Crossing On Tray 3D**. One line dips into an open trough cut in the ground, or in the tray. The trough shows in every view, flat included.
7. **Crossing Portal**, **Crossing Portal Flat**, **Many Crossings**. One line goes into an oval portal and comes out of a matching one. On Many Crossings, orbiting the camera stays smooth.
8. **Large Sample** (the 50-node diagram). Use the toolbar's **Avoid crossings** control: Off, Some, Strong.
   - At each level, no line turns back on itself: along its run it only ever moves towards its target. No line runs through a block or a tray it does not enter.
   - Going from Off to Some to Strong, the number of crossings drops visibly.
   - Drag a few blocks, including one inside a tray. The lines follow live and never pass through a block. A line turns back only if you drop its block straight behind another block.
9. **Checkout** (LR, Fraud taller). Same as step 8 with the flow left to right.
10. Switch any story to **flat**. The light is nearly overhead, so block shadows are short.

## 2. The viewer: /app/

Run `pnpm --filter @bonkei/playground dev -- --port 6207` and open `http://localhost:6207/app/`.

1. Pick **flow: large (~50 nodes)**. Read the readout line under the diagram. It must show `doubling back 0`, `through blocks 0 / foreign trays 0`, and `length/direct` at or below 1.12 (main's value). There must be no `ROUTING FELL BACK TO ELK`.
2. Click **Off**, **Some** and **Strong** in turn. `doubling back` stays 0 and `crossings` goes down (about 96, 52 and 48).
3. Drag a block 50 to 100 px and let go. While you drag, `drag frame` stays at a few tens of ms and `through blocks` stays 0.
4. Pick **Crossings: Bridge / Tunnel / Portal** in the toolbar. The `(bridge/tunnel/portal drawn)` counts change to match, and the crossings are drawn in that style.
5. Pick **flow: small (sample.mmd)** and **flow: checkout**. Repeat step 1. Every count is 0 and `length/direct` is 1.
6. Pick **seq: login flow**. Sequence diagrams' lines don't change in this task and look as on main.

# Manual test plan: Bonkei as an installable package (BON-52)

In this order. The diagrams are made-up sample data.

1. **Automated checks first.** `pnpm install`, then `pnpm check:package` (publint, are-the-types-wrong and `scripts/dist.test.mjs`: no errors), `pnpm test`, and `pnpm size` (five rows, each under its limit; the numbers match LOG.md, BON-52).
2. **Smoke.** `pnpm smoke`. Look for `ok` on `current vite dev`, `current vite preview`, `vite 5 dev`, `vite 5 preview`, `script tag` and `script tag, wasm missing`. `npm install output lines about peers/warnings: none`, `installed: react 19.3.x`, `@opentelemetry/api in app dependencies: false`, `tsc passed`. The build lists `elk.bundled-*.js` apart from `index-*.js`. Screenshots are in the tmp folder it prints.
3. **The playground on the built package.** `pnpm dev`, open http://localhost:5173/app/. A diagram draws; the readout shows no `ROUTING FELL BACK TO ELK`. In the network tab, `elk.bundled` and `libavoid.wasm` load only after the page, on the first layout. Edit `packages/core/src/Bonkei.tsx` (any visible text), reload: the change is there (tsdown rebuilt `dist/`).
4. **The site.** http://localhost:5173/: the hero draws its diagram.
5. **Script tag.** http://localhost:5173/app/embed/: one `<script>`, a diagram, and in the bottom-left `libavoid routed the lines in … ms`. http://localhost:5173/app/embed/no-wasm/: the diagram still draws, and the line says `libavoid did not load, ELK routes shown: …`.
6. **Storybook.** `pnpm storybook` (or `pnpm --filter bonkei build && pnpm --filter @bonkei/playground storybook`). Script tag / Script Tag and Script Tag Wasm Missing show the two pages above. Any Bonkei story still draws.
7. **A fresh app by hand.** `cd examples/vite && npm install ../../packages/core/<packed .tgz> && npm run dev`: the sample diagram draws.
8. **On the PR** (needs the pkg.pr.new GitHub app, BON-109): the size-limit comment shows the five sizes; the pkg.pr.new comment's `npm i https://pkg.pr.new/...` line installs in a new Vite app and draws; its StackBlitz link opens `examples/vite` drawing a diagram; a new commit updates the comment.

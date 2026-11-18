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

# Manual test plan: themes and the brand home (BON-117)

The diagrams are made-up sample data (the playground's "flow: bonkei mockup" and "seq: login flow", the site's `sample.mmd`). Run `pnpm --filter bonkei test` first; it must pass.

## 3. The viewer: themes

Run the viewer as in section 2 and open `/app/`.

1. **Classic unchanged.** With the Theme menu on **from source**, pick **flow: small (sample.mmd)** and look at flat, iso and 3D. It looks exactly as on main: dark ground, grid, blue and orange blocks, white lines.
2. **Bonkei.** Pick **flow: bonkei mockup**, Theme **bonkei**. Flat, iso, 3D: cream paper ground, an ink outline on every block and tray, flat colour washes, tray sides patterned by depth (lozenges, flowers on Billing), labels on cream plaques and tray titles on indigo plaques, ink lines with their steps and arrowheads. Try **Bridge**, **Tunnel**, **Portal** in the toolbar: each still draws.
3. **Bonkei · landscape.** Theme **bonkei-landscape**, iso then 3D: every node is a house (rect), bonsai (round), rock (cylinder) or peak (diamond) on a raised plinth; each label is in front and readable, also where one node stands behind another; lines meet the plinths.
4. **Resting on trays.** In 3D, drag the background upwards until you look at the trays almost side-on. Every node and plinth sits on its tray's top (Invoices and Paid? on Billing, on Services), none sunk into it. Do it in both Bonkei themes.
5. **Tray titles.** In landscape iso, the Billing and Data titles are on a corner no house, bonsai or rock stands on. Drag a node onto a title's corner: the title moves to a free corner and stays there.
6. **Interactions.** In both themes: drag a node (lines follow), click a tray (the camera flies in), Fit, switch flat / iso / 3D. Pick **seq: login flow**: the sequence diagram draws in paper and ink.
7. **Unknown name.** Theme **nope (unknown name)**: the diagram is drawn in Classic and a warning at the bottom says `unknown theme "nope"`.
8. **From the frontmatter.** Theme **from source**, click **source**, and put this before the diagram: `---` / `config:` / `  theme: bonkei` / `  themeVariables:` / `    edge.flat: true` / `---`. The diagram turns Bonkei with lines lying on the surfaces. Change `edge.flat` to `wide`: a warning names line 5 and the lines are back to normal.
9. **Frame rate.** Pick **flow: large (~50 nodes)** in each Bonkei theme and orbit in 3D: the fps at the start of the readout stays smooth (about 60 on a desktop GPU).

## 4. Storybook: Themes and Mockups / Brand

Run Storybook as in section 1.

1. **Themes / Classic, Bonkei, Landscape × Flat, Iso, 3D**, **From Frontmatter**, **By Prop** (Bonkei · landscape although the frontmatter says classic), **Unknown Theme Warns** (Classic, and the warning box names line 3).
2. **Themes / Override Beside Default**: two Bonkei diagrams; only the left one (`edge.flat: true`) has its lines lying flat.
3. **Mockups / Brand / Home**: the new logo and the name **Bonkei** in the nav and the footer, every section (How it works, Views, Themes, Sequence, Status, the final call), the hero in Classic, cream paper, serif headings. In the Themes section click Classic, Bonkei and Bonkei · landscape: the same diagram turns, live, and the frontmatter box shows the theme's name.
4. **Mockups / Brand / Themes section**: the diagram fills its frame; resize the window and it refits.
5. **Home 390**, **Home 820**, **Home 1024** (or the viewport menu): every section laid out for the width, nothing wider than the screen; at 820 and 390 the theme choices are chips above a full-width scene; at 390 the scene opens flat on the largest tray with readable labels and a **Fit** button shows the whole diagram. Zoom in and out: outlines, patterns and labels stay in proportion.
6. **Marks**: the logo from 160 to 32 px, the small mark at 64, 32, 16 px. Build the site (`pnpm build && pnpm preview`): the browser tab shows the small mark and the title "Bonkei: your Mermaid diagrams as a 3D scene"; the viewer's tab says "Bonkei · viewer".

# Manual test plan: Bonkei as an installable package (BON-52)

In this order. The diagrams are made-up sample data.

1. **Automated checks first.** `pnpm install`, then `pnpm check:package` (publint, are-the-types-wrong and `scripts/dist.test.mjs`: no errors), `pnpm test`, and `pnpm size` (six rows, each under its limit, the Zen Old Mincho font among them; the numbers match LOG.md, BON-52).
2. **Smoke.** `pnpm smoke`. Look for `ok` on `current vite dev`, `current vite preview`, `vite 5 dev`, `vite 5 preview`, `script tag` and `script tag, wasm missing`, each for both `default` and `bonkei` (the Bonkei theme). Each `font:` line shows `200 …ZenOldMincho-Bold-latin….ttf`; on `vite 5 dev` it also says `fell back: … not a font file …` (Vite 5 answers the moved URL with an HTML page) and the diagram is still `ok`. The summary at the end says which way the wasm and the font were found. `npm install output lines about peers/warnings: none`, `installed: react 19.3.x`, `@opentelemetry/api in app dependencies: false`, `tsc passed`. The build lists `elk.bundled-*.js` apart from `index-*.js`. Screenshots are in the tmp folder it prints: the default look on top, the Bonkei theme (cream paper, serif labels) below.
3. **The playground on the built package.** `pnpm dev`, open http://localhost:5173/app/. A diagram draws; the readout shows no `ROUTING FELL BACK TO ELK`. In the network tab, `elk.bundled` and `libavoid.wasm` load only after the page, on the first layout. Edit `packages/core/src/Bonkei.tsx` (any visible text), reload: the change is there (tsdown rebuilt `dist/`).
4. **The site.** http://localhost:5173/: the hero draws its diagram.
5. **Script tag.** http://localhost:5173/app/embed/: one `<script>`, two diagrams of the same sample, the default look on top and the Bonkei theme below. The Bonkei labels are in a serif face (Zen Old Mincho), not the sans default; in the network tab `fonts/ZenOldMincho-Bold-latin.ttf` loads with 200 from beside `bonkei.global.js`. The bottom-left says `libavoid routed the lines in … ms` for each, and no `font …` warning. Delete `apps/playground/public/embed/fonts/` and reload: the Bonkei diagram still draws, its labels in the default font, and the bottom-left line shows `font mincho could not be loaded …`. http://localhost:5173/app/embed/no-wasm/: the diagram still draws, and the line says `libavoid did not load, ELK routes shown: …`.
6. **Storybook.** `pnpm storybook` (or `pnpm --filter bonkei build && pnpm --filter @bonkei/playground storybook`). Script tag / Script Tag and Script Tag Wasm Missing show the two pages above. Any Bonkei story still draws.
7. **A fresh app by hand.** `cd examples/vite && npm install ../../packages/core/<packed .tgz> && npm run dev`: the sample diagram draws twice, the default look and the Bonkei theme with serif labels.
8. **On the PR** (needs the pkg.pr.new GitHub app, BON-109): the size-limit comment shows the six sizes; the pkg.pr.new comment's `npm i https://pkg.pr.new/...` line installs in a new Vite app and draws; its StackBlitz link opens `examples/vite` drawing a diagram; a new commit updates the comment.

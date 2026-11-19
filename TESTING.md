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
8. **Large Sample** (the 50-node diagram). Use the **Avoid crossings** control: Off, Some, Strong. A diagram's toolbar shows it only with `crossingControls` on (BON-161); if this story's toolbar has only Flat / Iso / 3D and Fit, check the levels on **Components / Bonkei / Crossing Styles** (a smaller made-up sample) and on the Large Sample in the viewer (section 2, step 2).
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
4. Pick **Crossings: Bridge / Tunnel / Portal** in the viewer's toolbar. The `(bridge/tunnel/portal drawn)` counts change to match, and the crossings are drawn in that style. The viewer always shows these controls; in Storybook a diagram shows them only with `crossingControls` on, as in **Components / Bonkei / Crossing Styles** (BON-161).
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

# Manual test plan: quieter defaults (BON-161)

How to check by hand that a diagram dropped into a page starts in iso unless the author sets flat or 3D, that its toolbar shows only Flat / Iso / 3D and Fit, and that the crossing controls show only when the author turns them on. Go through it in this order. The diagrams are made-up sample data.

1. **Automated checks first.** `pnpm --filter bonkei test` passes. Then `pnpm --filter bonkei build && pnpm smoke` passes, and in its output, under `--- defaults page under vite dev (BON-161)`, all five `[defaults]` lines say `ok`: `none` (starts Iso, 4 buttons (Flat, Iso, 3D, Fit), no Crossings or Avoid crossings group), `flat` (starts Flat, from `mode="flat"`), `3d` (starts 3D, from the frontmatter), `controls` (starts Iso, both groups present, Off then Bridge gives a bridge count above 0), `bridge` (starts Iso, no crossing groups, a bridge count above 0). The summary at the end says `defaults page ok`.
2. **Storybook.** Run Storybook as in section 1.
   - **Components / Bonkei / In A Docs Page**: the diagram starts in iso, and the toolbar has exactly four buttons: Flat, Iso, 3D and Fit. Iso is the one highlighted.
   - **Components / Bonkei / Starts In Each View**: three diagrams, starting iso (no mode), flat (`mode="flat"`) and 3D (from the frontmatter) in that order; in each the matching View button is highlighted.
   - **Components / Bonkei / Crossing Styles**: the toolbar shows the View group, **Crossings** (No hop, Bridge, Tunnel, Portal), **Avoid crossings** (Off, Some, Strong) and Fit. Click **Bridge**: one line hops over the other where they cross (seen in Iso). Click Tunnel and Portal: each draws.
   - **Components / Bonkei / Crossing Style Without Controls**: the crossings are drawn as bridges (it starts in Iso, where the hops show), and the toolbar has only the four buttons Flat, Iso, 3D and Fit.
   - **Components / Bonkei / Crossings In Frontmatter**: both crossing groups are shown, starting on **Tunnel** and **Strong**.
   - Core's **Bonkei / Overlay Toolbar**: View (one view highlighted) and Fit, nothing else. **Bonkei / Overlay Toolbar With Crossing Controls**: View, Crossings, Avoid crossings and Fit; clicking in each group moves its highlight.
3. **The viewer.** Run the viewer as in section 2 and open `/app/`. Every group is in its toolbar: View, Crossings, Avoid crossings and Fit. Section 2 step 2 (Off / Some / Strong, `crossings` goes down) and step 4 (Bridge / Tunnel / Portal, the drawn counts change) still work.
4. **A fresh app by hand.** `pnpm --filter bonkei build`, `cd packages/core && pnpm pack`, then copy `examples/vite` to a folder outside the repo, `npm install <path to the packed .tgz>` and `npm run dev` in it. Open the page: both diagrams of the sample start in iso, and each toolbar has exactly four buttons: Flat, Iso, 3D and Fit.

# Manual test plan: embeds, script tag and VitePress (BON-53)

In this order. Every diagram is made-up sample data, labelled so on each page.

1. **Automated checks first.** `pnpm install`, `pnpm --filter bonkei build`, then `pnpm test` (core's `embed.test.ts` and `packages/vitepress`'s `index.test.js` among them) and `pnpm smoke`. Under the embeds part every line says `ok`, ending `30/30 checks ok`: the `html:` lines (static files only, two elements ready, 420 and 600 px, added draws, removed cleaned up, moved draws again, broken source fires `bonkei-error`, script loaded twice, `pre.mermaid` before and after `run()`, no console errors, then a page with the script in `<head>`: the element still draws, keeps its stylesheet's `display: none` / `display: grid`, and drops a removed `height`), then for `vitepress dev` and `vitepress build+preview`: the page with no diagram downloads no Bonkei, React or three (`4 scripts` in the build), the three diagrams draw at 420, 420 and 600 px, the pie stays a code block, and (build only) 3 boxes in the server HTML and the paragraph below at the same top before JS and after. The screenshots are in the tmp folder it prints.
2. **The HTML page by hand.** `node examples/html/copy-bundle.mjs && npx serve examples/html` (or any static server on a port above 6200) and open it.
   - Two diagrams draw: the flowchart at 420 px, the sequence diagram at 600 px in the Bonkei theme (cream paper). The folder has only `index.html`, `bonkei.global.js`, `libavoid.wasm` and `fonts/`.
   - **Add a diagram** twice: two 300 px diagrams appear and draw (`Added 1`, `Added 2`). **Remove the last one**: it goes, and the console shows no error.
   - The two `pre.mermaid` blocks are text. **Convert pre.mermaid blocks**: the flowchart becomes a diagram, the pie stays text, and the button says `1 converted`.
   - In the console, `document.body.append(document.querySelector('#slot bonkei-diagram'))`: the diagram moves to the end of the page and draws again.
3. **Storybook.** `pnpm storybook` (it builds core, copies the HTML page and builds the VitePress example first).
   - **Script tag / Elements**: as step 2's first point. **Elements After Run**: the flowchart block drawn, the pie still text. **Elements Added And Removed**: one added diagram, `Added 1`. **Element With A Bad Source**: at the bottom, a 200 px box with "This diagram couldn't be drawn" and the line that failed; the other diagrams draw.
   - **VitePress / Diagrams Page**: a flowchart and a sequence diagram at 420 px, a flowchart at 600 px, then the pie as a grey code block, not an error card. **Diagrams Page Before Scripts**: the same page with no JavaScript: three empty bordered boxes of those heights where the diagrams go. **Page Without A Diagram**: the home page; in the browser's network panel for the frame, nothing named bonkei, three, react, elk, `.wasm` or ZenOldMincho. **Mintlify Notes**: the Mintlify page (step 5).
4. **The VitePress site by hand.** `cd examples/vitepress && npx vitepress dev --port 6240`, open `/diagrams`: the three diagrams draw (the console may log that the wasm fell back to its inline copy: BON-52's known Vite 5 dev quirk). Edit a node's label in `diagrams.md` and save: the diagram updates in place. Change `{height=600}` to `{height=300}`: that box gets shorter. Open `/` with the network panel open: no Bonkei, React or three file. Then `npx vitepress build && npx vitepress preview --port 6241`: the same, and with JavaScript turned off in the browser `/diagrams` still shows the three empty boxes at their heights.
5. **The Mintlify notes.** Open `/mintlify` on the VitePress site (or `examples/vitepress/mintlify.md`). It says: custom React components and custom scripts on every plan; npm packages Enterprise-only (React 18, dependencies only, 3 s server render); Mintlify draws mermaid fences itself; the likely route is a snippet component that loads `bonkei.global.js`; not tried on Mintlify.

# Manual test plan: the docs at bonkei.dev/docs/ (BON-178)

In this order. Every diagram on the docs is made-up sample data. The docs install `bonkei` and `@bonkei/vitepress` from packed tarballs, so what you try is what a user gets.

1. **Automated checks first.** `pnpm install`, then `pnpm build`: it ends `check-pages: dist/ ok`. Then `pnpm docs:smoke` (or `SKIP_DOCS_BUILD=1 pnpm docs:smoke` right after a build). Every line says `ok`: coverage (`29 public exports, 29 with an API page`, then each option, event, mode, label and control with the guide pages that show it live), `a sample with a renamed option fails the docs build and the failure names the page` (the output shows `[2561] … 'avoidCrossing' does not exist in type 'BonkeiOptions'` and `file: …/guide/edge-styles.md`), the page checks (`installed:` copies, `agents:` lines, one pair per page, `playground`, `copy as Markdown`, `telemetry`, the `390 / 820 / 1024 px` lines, the touch drag), and the four `getting started` lines.
2. **Serve the build like Pages.** `PORT=6390 node scripts/serve-dist.mjs dist` (any free port above 6200). Open `http://localhost:6390/`: the site's header has **Docs** first; click it and you are on `/docs/`.
3. **Home** (`/docs/`): the hero, four cards (React, Plain JavaScript, Script tag, VitePress), a live diagram (scroll past it: the page scrolls and a hint shows; click it, then drag: it moves), then the playground. Change a label in the editor: the diagram on the right redraws within a second. Type `--> -->` on a line of its own: a red line under the editor names the problem (`parse line …`), and the last diagram stays with a "Not updated" strip. Press **Copy page** and paste into a text editor: the page's Markdown, the same as `/docs/index.md`. The console shows no errors.
4. **Introduction**: the same playground test (a sequence diagram this time).
5. **Getting started**, React, Plain JavaScript, Script tag and VitePress: each page has its install line, its code, and the diagram the code draws, live. On Script tag the last diagram is a real `<bonkei-diagram>` element (inspect it). To follow a page word for word, do as `scripts/smoke/docs-getting-started.mjs` does: a new empty folder, `npm init -y`, the page's `npm install` line with `docs/.packs/bonkei-0.0.0.tgz` (and `bonkei-vitepress-0.0.0.tgz`) in place of the package names, then the page's code.
6. **Edge styles** (`/docs/guide/edge-styles`), the model of a feature's own page: the sample under the code tabs draws; under **Crossings** four diagrams, none · bridge · tunnel · portal. Turn each to iso (they start there): none crosses plainly, bridge hops, tunnel dips, portal shows two rings. Under **Counting crossings** each diagram has an `onEdgeStats:` line under it (1 crossing found, and 1 drawn as bridge / tunnel / portal). **Letting the reader choose**: the toolbar has the Crossings and Avoid crossings groups. Press **Copy page** under the title and paste: frontmatter, then the page, every diagram as a ```` ```mermaid ```` fence.
7. **Options, The reader's controls, Themes, Errors and warnings**: every value is a live diagram. Options: flat · iso · 3d, top · billboard, fit default beside tight, minLabelPx opens zoomed in. Controls: in the "zoom off" diagram ⌘/Ctrl + scroll does not zoom; "move off" will not let you drag a node. Errors: one error card (the parse error) and its `onError` line in the event log; the warning example draws and logs `onWarning`; click a node in the last example and switch the view: `onNodeClick` and `onModeChange` appear.
8. **Diagram types**: the flowchart and the sequence diagram draw, the playground draws, and the pie fence is a plain code block; the console has no errors.
9. **API** (`/docs/api/`): every export listed; open `render`: its signature, parameters and description. Open **VitePress plugin** and **Script tag element** under Reference.
10. **Agents.** `curl http://localhost:6390/docs/llms.txt`: every page, each with a one-line description. `curl http://localhost:6390/docs/llms-full.txt | grep '^# Function: render'`: found, with its signature and description below. `curl http://localhost:6390/docs/guide/edge-styles.md`: Markdown only, no `<nav>` or `<script>`, the diagrams as mermaid fences.
11. **Phone and tablet.** In Storybook (`pnpm docs:build`, then `pnpm storybook`), **Docs (built)**: Home, Feature page and API page at 390, 820 and 1024. At 390 the nav is folded into the menu button, nothing scrolls sideways except code blocks and wide tables, diagrams fit the width. **Mockups / Docs** shows the design the build follows. Then on a real phone, open the served docs over your network (or the deployed bonkei.dev/docs/): open the home, Edge styles and an API page, tap a diagram (the ring shows) and move it with one finger, pinch it and twist it; before the tap, and beside it, a swipe scrolls the page.
12. **After the deploy.** `https://bonkei.dev/docs/` loads, the header link on `https://bonkei.dev/` goes there, and `curl https://bonkei.dev/docs/llms.txt` answers.

# Manual test plan: pan, zoom and turn the way people expect (BON-78)

In this order, on a Mac with a trackpad and with a mouse, then a phone or tablet. Every diagram is made-up sample data. `pnpm install`, then `pnpm test` (all pass), then `pnpm storybook` (it builds `bonkei` first) and `pnpm dev` for the viewer.

1. **Storybook, Mockups / BON-78 Gestures / Card.** Step `input` through trackpad, mouse and touch and `mode` through flat, iso and 3D: 3D's rows start "Drag · Turn and tilt"; touch in 3D adds "Two fingers up or down · Tilt"; mouse says ⌘ + scroll on a Mac (Ctrl elsewhere).
2. **Full Page, in each view** (`mode` in Controls). Trackpad: a two-finger drag moves the diagram, a pinch zooms it. Mouse: the wheel moves it up and down, ⇧ + wheel sideways (flat, iso), ⌘ + wheel zooms. Flat and iso: drag the background, it moves; ⇧ + drag or a right-drag turns it, and on letting go it settles on the nearest quarter turn (iso on another corner). 3D: a drag turns and tilts, ⇧ + drag and a right-drag move, ⇧ + scroll turns. Right-click and Ctrl-click the diagram: no browser menu. Turn and zoom, then **Fit**: the whole diagram, square again. Press **?**: the card names the input you last used (trackpad, then mouse after a mouse wheel) and its rows change when you switch to 3D; Esc and × close it.
3. **In A Page** (`radius` 8). Scroll down over the diagram: the page keeps scrolling and a hint shows ("Click to move the diagram · ⌘ + scroll to zoom"). Pinch or ⌘ + scroll over it: it zooms, and the page does not move. Click it: a blue ring with rounded corners and "Esc to let go"; the wheel now moves the diagram, not the page. Esc lets go; click it again, then click the page text: it lets go. Set `radius` to 0 (a square ring) and 40 (round ring, the chip set further in, not clipped).
4. **Components / Bonkei / Node Click** (opens in iso): ⇧ + drag about 400px turns it to the next corner without touching Controls. **Controls Setting**: the same in a page that scrolls; `{zoom:false}`: ⌘ + scroll scrolls the page (or zooms the browser), the diagram does not zoom; `{pan:false}`: the wheel scrolls the page with no hint, drags do nothing.
5. **The viewer** (`pnpm dev`, `/app/`): it fills the window, so the wheel moves the diagram at once (no hint, no ring). The same gestures as step 2 in flat, iso and 3D; the caption at the bottom left says them; **?** sits beside Fit.
6. **The site** (`/`): over the hero, the wheel scrolls the page (hint "Click to move the diagram", no zoom mentioned: the hero has zoom off and no toolbar). In the Themes section, click the diagram: the ring follows the card's 12px corners.
7. **The docs** (`pnpm docs:dev`), The reader's controls: the Gestures table; over each diagram the page scrolls with a hint; click one, drag it, Esc.
8. **Touch** (a phone or tablet on the same network, the docs or In A Page): one finger scrolls the page over a diagram, with the hint "Tap, or use two fingers, to move the diagram". Tap it (the ring shows): one finger moves it, pinch zooms, a twist turns (flat and iso settle square on lifting), and in 3D two fingers up or down tilt. Tap outside: one finger scrolls the page again.
9. **Telemetry.** With an OpenTelemetry SDK registered on the page (or the stub tracer of the BON-78 check), use the gestures: `bonkei.control` spans carry `bonkei.control.via` (wheel, pinch, drag, touch), `bonkei.control.swapped` and `bonkei.mode`; `bonkei.control.hint` appears once per hint, `bonkei.control.hold` on taking hold and letting go (how: click, touch, esc, outside), `bonkei.help` on opening and closing the card, `bonkei.fit` on Fit.

# Manual test plan: the trench light (BON-181)

How to check by hand that a tunnel's trench is lit in Classic, unlit in the Bonkei looks, and that each part can be changed or turned off. The tunnel diagram is made-up sample data. First run `pnpm test` (it includes `theme.test.ts` and the docs' `trench.test.ts`).

## 1. Docs: Edge styles, "The trench light"

Run `pnpm docs:dev` and open the Edge styles page, section **The trench light**.

1. The diagram opens in iso, theme `classic`, and no `themeVariables` show under it. The tunnel's trench glows a soft grey-white along its floor and on its walls, with no rim. The blocks and lines beside it look as they do elsewhere on the page.
2. Turn the diagram to 3D with the toolbar: the same light, only in the trench.
3. Press **Light only**: the wall wash and any rim go, the light out of the floor stays; the frontmatter shows `edge.glow.wash: null` and `edge.rim: none`.
4. Press **All off**: no light and no rim; the frontmatter shows `edge.glow: off` and `edge.rim: none`.
5. Press **Theme default**, then pick an orange colour: the light turns orange. Drag **Strength** from 5% to 100%: from a thin line along the floor to a bright channel. **Theme colour** puts the grey-white back.
6. Untick and tick **floor light**, **wall wash** and **rim** one at a time: each part goes and comes back alone, and the frontmatter follows.
7. Pick theme `bonkei`, then `bonkei-landscape`: the light is off and the dark rim is there, as before; no `themeVariables`. Tick floor light and wall wash: a warm light appears.
8. Below the controls, the teal-rim diagram draws a thin teal rim round its trench instead of Bonkei's dark one.
9. On the Themes page, **The trench light** diagram is Bonkei with its light switched on.

## 2. Storybook: Themes

Run `pnpm storybook` (or `pnpm --filter @bonkei/playground exec storybook dev -p 6207`) and open **Themes**.

1. **Tunnel Classic Iso** and **Tunnel Classic 3D**: grey-white light, no rim. **Tunnel Bonkei Iso/3D**, **Tunnel Landscape Iso/3D**: no light, dark rim, as on main.
2. **Tunnel Bonkei Light On**, **Tunnel Landscape Light On**: warm light. **Tunnel Own Rim**: a thin teal rim. **Tunnel Classic Light Only**: the floor light alone.
3. **Tunnel Bad Light Warns**: drawn with Classic's light, and two theme warnings listed (`edge.glow` is a group…, `edge.glow.coreWidth` must be 0 or more).
4. **Tunnel Light Controls**: change theme, preset, the three parts, colour and strength in the controls panel; the frontmatter under the diagram follows each change.
5. Open **Classic Iso**, **Bonkei Iso** and **Landscape Iso** (no tunnel): they look exactly as before.

# Manual test plan: the docs smoke knows the trench light demo (BON-197)

How to check by hand that the docs smoke passes on Edge styles, still fails a diagram that is neither a fence nor a marked demo, and that Copy page gives the demo's Markdown. First run `pnpm test`: it includes `scripts/smoke/diagram-rule.test.mjs` (the rule) and `trench.test.ts` (the fence under the demo is what Light only writes).

## 1. The docs smoke

1. `pnpm --filter bonkei build && pnpm docs:smoke`. Look for `ok page /docs/guide/edge-styles: every diagram is a mermaid fence in its .md (14 drawn, 14 fences); 1 interactive demo(s): The trench light`, then `ok … 15 diagram(s) draw`, `ok copy as Markdown (Edge styles)` and `ok agents: the Edge styles .md has its diagrams as mermaid fences and no HTML chrome`. It ends `docs smoke: all steps ok`, with no `docs smoke: every page FAILED`.
2. A bare diagram still fails. Append `<BonkeiLive source="flowchart%20LR%0A%20%20A%20--%3E%20B" />` to `docs/guide/react.md`, rebuild and run again (`pnpm docs:smoke`): `FAIL page /docs/guide/react: every diagram is a mermaid fence in its .md (3 drawn, 2 fences)`. Put the page back.
3. A demo needs its heading. Change `data-bonkei-demo="The trench light"` in `docs/.vitepress/theme/TrenchLight.vue` to another title, rebuild and run: the Edge styles line fails with `a demo needs one diagram and a heading of its title in the .md: …`. Put it back.

## 2. Docs: Edge styles, Copy page

Run `pnpm docs:dev` (or the docs smoke set-up) and open Edge styles, section **The trench light**.

1. Under the controls, a sentence says what **Light only** on Classic writes, and a YAML block shows that frontmatter and the tunnel diagram. Press **Light only** on the controls: the frontmatter shown under the live diagram is the same.
2. Press **Copy page** under the title and paste: under `### The trench light` there is the Try-it paragraph, the sentence and the ```` ```yaml ```` block; no `<TrenchLight />`, no HTML.
3. `curl <origin>/docs/guide/edge-styles.md`: the same Markdown.

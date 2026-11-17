# Brand from traditional bonkei art: themes, logo and the brand home (BON-116 / BON-117)

Two themes in the library, chosen per diagram: **Bonkei** (paper ground, ink outlines, flat washes, tray sides patterned by depth, plaque labels, lines in ink keeping their steps, tunnels and portals) and **Bonkei · landscape** (nodes become houses, bonsai, rocks and peaks on plinths). A diagram names its theme in its frontmatter (`config.theme`), overrides one setting for itself (`config.themeVariables`), or gets it from the `theme` prop; an unknown name draws in Classic with a warning. Classic is unchanged: 0 differing pixels in flat, iso and 3D. The home page is now in the brand (cream paper, ink, serif headings, the new logo, the small mark as favicon), keeps every section and its Classic hero, and gains a Themes section that switches one live diagram between the three themes.

Decisions: LOG.md, "Themes: Classic, Bonkei, Bonkei · landscape, and the brand home (BON-117)". Code map: CONTRIBUTING.md. Manual test plan: TESTING.md, sections 3 and 4.

## Risks: what this could break, and how you would notice

- **Classic drifting.** Every scene colour now comes from tokens, and labels go through `PlateText`. A slip would change today's look for every diagram. Checked at 0 differing pixels against the branch base; you would notice it in Storybook's Themes/Classic* stories, the site's stills, or a pixel diff of the playground.
- **Public API.** `theme`, `fit`, `minLabelPx` options; `CLASSIC`, `BONKEI`, `BONKEI_LANDSCAPE`, `THEME_NAMES`, type `Theme`; warnings of kind `theme`. Removing or renaming them later is breaking. `pnpm -r typecheck` and `theme.test.ts` / `options.test.ts` guard them.
- **Switching theme remounts the scene.** Nodes dragged before a switch go back to their laid-out places. You would notice it in the playground's Theme menu.
- **Frame rate in the Bonkei themes.** Outlines are one line object per mesh and the ink pass walks the scene when the zoom changes. Slow GPUs may drop frames on big diagrams. You would notice it in the playground's fps readout on the large sample.
- **The home page.** New fonts (served with the site), a second lazy scene chunk (Themes) and a responsive layout. A static `bonkei` import in `Home` would put the scene on first paint; a layout slip would overflow on phones. You would notice it in the build output (the `site-*.js` entry stays about 157 kB), and in Mockups/Brand Home 390 / 820 / 1024.
- **Tight fit and phone framing** change only where `fit="tight"` or `minLabelPx` is passed (the Themes section); the default fit and the hero are as before.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

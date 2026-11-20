# Blueprint, the fourth built-in theme (BON-234)

`theme: blueprint` (frontmatter, prop, script-tag attribute or VitePress fence) draws any flowchart or sequence diagram as an architect's drawing: blue paper with a fine grid and a brighter line every 5 squares, white outlines and pale-blue lines, flat shading, trays and blocks a shade lighter than the paper, hatched tray sides, hand lettering (Architects Daughter, bundled), and each tray's title in a coloured-in box on the surface just in front of the tray, with room made for it so it touches nothing. It works in flat, iso and 3D. Classic, Bonkei and Bonkei · landscape are unchanged, titles and spacing included.

- **Theme** (`packages/core/src/theme.ts`): the `BLUEPRINT` preset, exported; new tokens `ground.major`, `ground.majorColor`, `tray.sides` `hatch`, `tray.titles` `off`, `label.font` `architect` (all checked by `themeVariables`).
- **Font** (`fonts.ts`, `src/fonts/ArchitectsDaughter-Regular-latin.ttf` + its OFL licence, copied to `dist/fonts/` by `finish-build.mjs`, size budget in `.size-limit.mjs`): found and falling back like Zen Old Mincho.
- **Titles off the tray** (`titles.ts offTitleBoxes`): one box, used by the scene (`shapes.tsx OffTitle`, `look.tsx handBox`), the layout (`layout.ts`: room in front of every tray, only for a look that asks), the router (`avoid.ts`: each box an obstacle) and the direct-route passes (`monotone.ts unblock keepOff`). `prepare()` takes the `theme` prop; `<Bonkei>` lays out again when a theme prop changes whether room is needed.
- **Grid and hatching**: `SceneView.tsx` (the heavier grid), `look.tsx` (the `hatch` tile).
- **Homepage**: Blueprint is a live choice in the Themes section (`apps/site/src/Themes.tsx`); Map is still "coming with themes". The section's lead no longer says "the same layout".
- **Stories**: Themes / Blueprint Flat, Iso, 3D, Blueprint Sequence (all `theme: 'blueprint'`), Blueprint Nested Flat, Iso, 3D (a new made-up sample, `flow: nested (4 deep)`, also in the viewer), Blueprint Font Missing; Screens / Site / Themes Blueprint.
- **Tests**: `packages/core/src/blueprint.test.ts`: the three old presets equal main's (`fixtures/themes-main.json`) and lay out two samples exactly as main did (`fixtures/layouts-main.json`, written by main's own code; by prop, frontmatter and no theme); Blueprint's settings; `themeVariables` for the new tokens; which look asks for room; every title box inside its parent or on the paper, touching no tray, block or line; the box's width rule; `unblock` keeping blocks off titles; the font's fallback. `theme.test.ts` and `dist.test.mjs` know Blueprint.
- **Telemetry**: the existing `bonkei.theme` event names `blueprint`; the font's fallback is the existing `bonkei.font.fallback` event and an `onWarning`; `bonkei.route` gains `bonkei.title_room`.

Docs: README (themes list, `theme` prop, `dist/fonts`), docs Themes guide (a Blueprint section with a live diagram and its tokens), Script tag reference, `examples/html/README.md`, the VitePress plugin's types, the Edge styles trench controls (`trench.ts`), CONTRIBUTING's code map. Decision in LOG.md ("Blueprint, the fourth built-in theme, with titles off the tray (BON-234)"); manual test plan in TESTING.md ("Manual test plan: the Blueprint theme (BON-234)").

## Risks: what this could break, and how you would notice

- **Classic or Bonkei laid out differently.** All the title room is behind `titleRoom`; `blueprint.test.ts` fails if their layouts or settings move from main's. A theme prop that overrides a Blueprint frontmatter re-lays the diagram out; if that failed you would see Classic drawn with gaps in front of its trays.
- **A line running over a title, or a title over a block,** in a diagram unlike the samples (very narrow trays, many lines out of a tray's front edge in TD). You would see it in the viewer; the readout's `through blocks` does not count titles. With the libavoid wasm missing, ELK's fallback routes avoid titles only where they can.
- **Long titles drawn small** in narrow trays (the box never passes the middle of the tray's front edge).
- **The font file not served** (a host that does not copy `fonts/`): labels draw in the default font and `onWarning` says `font architect could not be loaded …`.
- **Bundle size**: the main chunk is 196.2 of its 197 kB budget; the next addition may need the budget raised.

## Checklist

- [x] If this changes how Bonkei draws (shapes, themes, layout, camera, lines, labels), the site's pictures are retaken with `pnpm capture` in this PR (`apps/site/public/*.png`: poster, og, still-flat, still-iso, still-3d, still-seq). Not retaken: no picture shows Blueprint, and Classic and Bonkei draw as before (the prototype's capture rewrote five of the six byte-identical, the sixth differing only by renderer noise).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

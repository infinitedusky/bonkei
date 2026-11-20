# Cloud Cartography, the fifth built-in theme (BON-235)

`theme: cloud-cartography` (frontmatter, prop, script-tag attribute or VitePress fence) draws a flowchart like an illustrated map of a system, in flat, iso and 3D: each top-level subgraph a coloured floor with its name in big capitals lying on it (a nested one a stronger tint of its parent's), each node an outlined icon by its shape under a callout card on a dotted leader, links as navy lines on the floor with one arrow partway along, and dotted links (`-.->`) as dashed arcs overhead. A label written over two lines (`A["Order API<br>Go · 3 pods"]`) shows its second line as a smaller grey subtitle on the card. Sequence diagrams draw too. Classic, Bonkei and Bonkei · landscape are unchanged; they still read `<br>` on one line and draw `-.->` as any link.

- **Theme** (`packages/core/src/theme.ts`): the `CLOUD_CARTOGRAPHY` preset, exported; new tokens `node.form` `icon`, `node.icon`, `tray.colorBy` `zone`, `tray.zones`, `tray.zoneMix`, `tray.radius`, `tray.titles` `ground`, `tray.groundFont`, `tray.groundInk`, `label.node.style` `card`, `label.card`, `label.pill`, `edge.arrow` `mid`, `edge.dotted` `arc`, `edge.arc`, all neutral in the older presets and checked by `themeVariables`.
- **Parser** (`parser.ts`, `model.ts`): an edge keeps `dotted`; a node keeps `title`/`sub` beside its one-line `label`.
- **Layout** (`layout.ts`, `diagram.ts`): with `edge.dotted: arc` the dotted links leave placing and routing and come back as `arcs`; with `tray.titles: ground` every tray gets room at its bottom for its name (`groundRoom`); `trimToIcons` brings line ends in to the icon. `<Bonkei>` lays out again when the look changes either.
- **Scene**: `icons.tsx` (icons by shape, callout cards), `EdgeScene.tsx` (mid arrow, pills, `ArcLink` on `arcs.ts arcPath`), `shapes.tsx` (zone floors with rounded corners and ground names; `zones.ts` picks the colours), `SceneView.tsx`, `camera.ts` + `scale.ts headroom` (the fit leaves room for icons and cards).
- **Font**: Archivo Black (SIL OFL), `src/fonts/ArchivoBlack-latin.ttf` + licence, copied to `dist/fonts/`, size budget in `.size-limit.mjs`. The missing-font warning covers every font a theme draws with (`themeFonts`).
- **Homepage**: "Map" is now **Cloud Cartography**, a live choice in the Themes section (`apps/site/src/Themes.tsx`).
- **Stories**: Themes / Cloud Cartography Flat, Iso, 3D, Source In Classic, Brand Iso, Sequence, Sequence 3D, Long Labels, Font Missing; Screens / Site / Themes Cloud Cartography. A made-up sample, `flow: cloud cartography (map)`, in the viewer.
- **Tests**: `packages/core/src/cloud.test.ts`: the three older presets keep main's tokens and lay out two samples exactly as main did (`fixtures/cloud-layouts-main.json`, written by main's own `prepare()`); the parser's `dotted`, `title`, `sub`; arcs left out of the layout (and kept in with `edge.dotted: line`), self-links and links to a tray; the room for zone names; zone colours; `trimToIcons`; `arcPath`; the theme's fonts; the telemetry counts; the fit's headroom; the new `themeVariables`; a sequence diagram. `theme.test.ts`, `blueprint.test.ts` and `dist.test.mjs` know the new preset and font.
- **Telemetry**: `bonkei.theme` names `cloud-cartography`; `bonkei.prepare` gains `bonkei.arcs`, `bonkei.route` `bonkei.ground_room`, and `bonkei.first_frame` (with icons) `bonkei.theme.arcs`, `bonkei.theme.subtitled`, `bonkei.theme.icons.<shape>`; a missing font is the existing `bonkei.font.fallback` event and an `onWarning`.

Docs: README (themes list, `theme` prop, telemetry), docs Themes guide (a Cloud Cartography section with a live diagram and its tokens; the trench table), Script tag reference, `examples/html/README.md`, the VitePress plugin's types, CONTRIBUTING's code map. Decision in LOG.md ("Cloud Cartography, the fifth built-in theme (BON-235)"); manual test plan in TESTING.md ("Manual test plan: the Cloud Cartography theme (BON-235)").

## Risks: what this could break, and how you would notice

- **Classic or Bonkei drawn differently.** Every new path is behind a token the older presets leave off; `cloud.test.ts` fails if their tokens or layouts move from main's. On screen you would see a mid arrow, a pill or a rounded tray in Classic.
- **A different layout from Classic's.** In Cloud Cartography a dotted link takes no part in placing nodes, and every tray is taller by the room for its name, so nodes joined only by a dotted link may sit far apart. You would see it beside the same source in Classic; `themeVariables: { edge.dotted: line }` keeps them in.
- **Cards over zone names.** In iso one zone's cards can cover part of the next zone's name (the map sample's ORDERS). You would see it in the viewer.
- **The font not served** (a host that does not copy `fonts/`): zone and card names draw in the default font and `onWarning` says `font archivo could not be loaded …`.
- **Bundle size**: the main chunk is 200.4 of its 202 kB budget.

## Checklist

- [x] If this changes how Bonkei draws (shapes, themes, layout, camera, lines, labels), the site's pictures are retaken with `pnpm capture` in this PR (`apps/site/public/*.png`). Not retaken: no picture shows Cloud Cartography, and Classic and Bonkei draw as before.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

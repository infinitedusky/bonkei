# Tunnels you can see: trench glow and rim (BON-181)

A tunnel used to read as a dark dip. Its trench can now be lit: a light along the floor, a wash on the walls and a rim round the lip. Each part can be recoloured, made stronger or weaker, or turned off, by a theme or by one diagram.

- **Defaults.** Classic lights its trench grey-white `#e0e0e0` at 30% strength, with no rim. Bonkei and Bonkei · landscape have the light off and draw exactly as before.
- **Tokens.** `edge.glow` (`core`, `coreWidth`, `halo`, `haloWidth`, `haloOpacity`, `wash`, `washIntensity`) in every preset; `edge.rim` takes `none`. In a diagram's `config.themeVariables`: `edge.glow: off`, `edge.glow.core/halo/wash: null`, `edge.rim: none`, and the diagram's own rim colour and width win. Other values are validated and go to `onWarning`.
- **Only the trench is lit.** The light is drawn (lines on the floor, an emissive wash on the walls); no scene light is added.
- **Docs.** Edge styles, "The trench light": live controls (preset Theme default / Light only / All off, the three parts, colour, strength), with the frontmatter they write under the diagram; a fence with its own teal rim. Themes lists the tokens.
- **Telemetry.** `bonkei.theme` gains `bonkei.theme.trench`; the docs controls add `bonkei.docs.trench_light.edit`.

Where to look: `packages/core/src/theme.ts` (tokens, `edge.glow: off`, `trenchParts`), `EdgeScene.tsx` (`Trench`), `theme.test.ts`; `docs/.vitepress/theme/trench.ts` (the controls' rules, tested in `trench.test.ts`) and `TrenchLight.vue`; stories **Themes / Tunnel …**. Decisions in LOG.md ("Tunnels you can see: the trench light and rim (BON-181)"); manual test plan in TESTING.md (same title).

## Risks: what this could break, and how you would notice

- **Classic tunnels look different.** Lit, and without the dark rim they had. Anyone comparing Classic tunnel pictures sees the trench change (and only the trench); a reader who wants the old look sets `edge.glow: off` and `edge.rim: null`.
- **A theme object built by hand before this change** (plain JS, no `edge.glow`): TypeScript now asks for `glow`; without it the trench draws unlit, as before, rather than failing. Copies of a preset (`{ ...CLASSIC.edge, … }`) carry the light. Someone who copied Classic would notice their tunnels are lit now.
- **The light on bright ground.** In the Bonkei looks the walls hide most of the floor light, so a switched-on light shows mostly as the wash; that is a look, not a fault.
- **Diagrams without a tunnel** read none of the new tokens; a pixel difference there would be a bug. Compared against main on samples in flat, iso and 3D in all three themes (see below).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

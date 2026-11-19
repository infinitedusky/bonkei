# The home page's live diagrams load onto an empty stage, never a saved picture first (BON-209)

On a desktop with WebGL 2 the hero and the "Keep the text" section no longer paint a saved picture and then swap it for the live scene, which was laid out and framed differently and made the page jump. The hero shows its empty stage and the scene fades in on its first frame; `poster.png` is not even requested. "Keep the text" shows its own frame (the editor's bar, the source read-only, an empty stage of the scene's size) and the scene fades into it, so the page below doesn't move. The pictures stay for phones, browsers without WebGL 2, and a scene chunk that failed to load. All six pictures (poster, share image, the flat / iso / 3D / sequence cards) are retaken from today's code, and from now on a change to how Bonkei draws retakes them in the same PR.

- **What paints what** is two pure functions in `howGate.ts`: `heroShows` (live or poster) and `howShows` (still, shell or scene), tested in `howGate.test.ts`. The hero decides its path on the first render with the same gate as "Keep the text" (`probeGate`), so there is no undecided frame.
- **`SceneBoundary.tsx`** (moved out of How.tsx) also wraps the hero: a hero chunk that fails to load shows the poster instead of unmounting the page.
- **"Keep the text"'s chunk is fetched when the page is idle**, so the shell is rarely seen for long; mounting still waits for the section to come near the screen.
- **Pictures:** `pnpm capture` (now builds core first) retook `apps/site/public/poster.png`, `og.png`, `still-flat.png`, `still-iso.png`, `still-3d.png`, `still-seq.png`.
- **Rule:** `.github/pull_request_template.md` (new, every PR's checklist) and CONTRIBUTING.md say to retake the pictures; LOG.md records it.
- **Telemetry** (OpenTelemetry spans on `bonkei-site`, states and times only): `site.hero.path` (`live` / `poster` + `site.hero.reason`), `site.hero.ready` (`site.hero.ready_ms`), `site.hero.fallback` (ERROR, `load-error`); `site.how.live` gains `site.how.load_ms`.
- **Size:** entry `site-*.js` 241.84 kB (76.06 kB gzip), +2 kB on BON-189's 239.66 kB; `HowScene-*.js` 4.46 kB.

Where to look: `apps/site/src/Hero.tsx`, `How.tsx`, `HowScene.tsx`, `howGate.ts`, `SceneBoundary.tsx`, `howGate.test.ts`; `apps/site/public/*.png`; root `package.json` (`capture`). Stories **Screens / Site** (Hero Loading, Hero Poster Only, Hero Scene Failed To Load) and **Screens / Site / Keep The Text** (Loading). Docs: README (telemetry), CONTRIBUTING (the rule, the map). Decision in LOG.md ("The home page's live diagrams load onto an empty stage… (BON-209)"); manual test plan in TESTING.md (same title).

## Risks: what this could break, and how you would notice

- **A desktop whose scene never draws** (a GPU that passes the WebGL 2 probe but can't render) now sees an empty stage instead of the poster. You would see `site.hero.path` live without a following `site.hero.ready`.
- **Slow connections** see the empty stage, or the read-only source beside an empty stage in "Keep the text", for longer than they saw the pictures. `site.hero.ready_ms` and `site.how.load_ms` show how long.
- **The idle prefetch** fetches `HowScene-*.js` for desktop visitors who never scroll down (4.5 kB, plus the Bonkei chunk the hero already loaded).
- **Stale pictures** if someone ignores the checklist: the cards and the share image would show an old look. It is a human check.

## Checklist

- [x] If this changes how Bonkei draws (shapes, themes, layout, camera, lines, labels), the site's pictures are retaken with `pnpm capture` in this PR (`apps/site/public/*.png`: poster, og, still-flat, still-iso, still-3d, still-seq).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# The front page's "Keep the text. Get the scene." section is live (BON-189)

On a desktop with WebGL 2 the section's Mermaid source is now an editor, starting from the same sample, and the right side is the real Bonkei scene instead of a picture. It re-lays itself out 300 ms after you stop typing and keeps the camera where you put it (BON-195); only Fit and flat / iso / 3D frame the diagram. A line the scene can't read is named in a short note under the source and the rest still draws; text with nothing readable keeps the last diagram with a note; fixing the text brings updates back. Reset puts the sample back. A phone or a browser without WebGL 2 gets the source and the still, now captured at 2x so it is sharp.

- **Lazy, as the hero.** `How.tsx` (gate, IntersectionObserver with a 400px margin, fallback) is in the entry; the editor and scene are `HowScene.tsx`, a lazy chunk. Entry chunk 237.59 → 239.66 kB (74.61 → 75.22 kB gzip); `HowScene-*.js` 3.39 kB (1.51 kB gzip) pulls in the shared Bonkei chunk on demand.
- **Notes.** `howState.ts` turns `<Bonkei>`'s `onWarning` / `onReady` / `onError` into the note (`howReducer`, `noteOf`) and decides when to give up and show the still (`fallsBack`: never drawn, or the renderer broke).
- **Telemetry.** OpenTelemetry spans on a `bonkei-site` tracer (`track.ts`, `@opentelemetry/api` loaded on first use): `site.how.fallback`, `site.how.live`, `site.how.first_edit`, `site.how.update` (outcome per source), `site.how.reset`.

Where to look: `apps/site/src/How.tsx`, `HowScene.tsx`, `howGate.ts`, `howState.ts`, `track.ts`, `Home.tsx`, `site.css`; `public/still-iso.png` and `scripts/capture-stills.mjs` (scale 2). Tests in `apps/site/src/howState.test.ts` (`pnpm --filter @bonkei/site test`). Stories **Screens / Site / Keep The Text** (Live, Skipped Line, Nothing Readable, Phone Fallback, No WebGL) and **Screens / Site** (Desktop, Phone, No WebGL). Docs: README (`apps/site`, telemetry). Decisions in LOG.md ("The front page's "Keep the text" section is live (BON-189)"); manual test plan in TESTING.md (same title).

## Risks: what this could break, and how you would notice

- **First load.** The entry is 2 kB larger; if the lazy import were ever made static the whole scene would land in the entry. You would see it in `pnpm --filter @bonkei/site build` (the `site-*.js` size jumps by hundreds of kB).
- **Two live scenes on one page** (hero, then this, then Themes) on a weak GPU: more memory and the browser may drop a WebGL context. The section would show the still (`site.how.fallback` with reason `scene-error`) or another scene would show its error card.
- **A visitor's text reaches the parser and ELK.** A source that makes ELK slow would make that scene slow to update (`site.how.update` `site.how.ms` grows); it does not block the rest of the page.
- **The note's wording comes from core's messages** (`not a node or edge`, `no nodes found`); a change in core changes what visitors read.
- **The Views card's iso still is now the 2x file** (173 kB instead of 73 kB, lazy-loaded): a little more to download below the fold.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

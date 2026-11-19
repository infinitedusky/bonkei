# The docs smoke passes on Edge styles with the trench light controls (BON-197)

Main's docs smoke failed on Edge styles, "every diagram is a mermaid fence in its .md (15 drawn, 14 fences)": the trench light controls (BON-181) draw a live diagram of their own. The check now knows interactive demos and still fails any other diagram that is not a fence.

- **The rule.** A demo marks its root `data-bonkei-demo="<title>"`; its one diagram is counted apart from the fences, and the page's `.md` must have a heading of that title. A bare diagram, a demo with no such heading or with two diagrams fail. `scripts/smoke/diagram-rule.mjs`, tested in `diagram-rule.test.mjs` (now in the root `pnpm test`); used by `scripts/smoke/docs.mjs`.
- **TrenchLight** marks its root `data-bonkei-demo="The trench light"`. Nothing it does or shows changes.
- **Copy as Markdown on Edge styles** now holds, under the demo's place, the frontmatter **Light only** writes on Classic, as a ` ```yaml ` fence; `trench.test.ts` keeps it equal to what the controls write.

Where to look: `scripts/smoke/diagram-rule.mjs` and its test, the page check in `scripts/smoke/docs.mjs`, `docs/guide/edge-styles.md` ("The trench light"). Decision in LOG.md ("The docs smoke knows interactive demos"); manual test plan in TESTING.md (same title); CONTRIBUTING says how a new demo is marked.

## Risks: what this could break, and how you would notice

- **A page with a stray diagram inside a marked demo root.** The demo must hold exactly one diagram, so the smoke fails naming the demo; a diagram outside any demo fails the count as before.
- **Renaming the "The trench light" heading** without the attribute (or the other way round) fails the docs smoke on Edge styles and `trench.test.ts`.
- **Changing what Light only writes** (`trench.ts`) without the page's yaml fence fails `trench.test.ts`.
- **Telemetry, the controls and how they look are unchanged**; a difference on the Edge styles page other than the new sentence and yaml block would be a bug.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# The docs run is nightly on main, not on every pull request (BON-217)

The docs run (`pnpm docs:smoke`: build the docs from packed tarballs, then every page in a browser and the four getting-started pages followed word for word) took about fifteen minutes of every pull request's smoke job. It now runs once a night on main and can be started by hand from GitHub or the command line. The three quick checks (the Vite example, the script tag, the embeds) still run on every pull request.

- **`pnpm smoke`** ends at `embeds.mjs`; CI's smoke job runs it as before, and its step name no longer mentions the docs. `pnpm docs:smoke` is unchanged.
- **`.github/workflows/nightly.yml`** (new): job `docs-smoke`, at 08:00 UTC on main and by hand (Actions › Nightly › Run workflow). It installs, builds core, installs Playwright's Chromium and runs `pnpm docs:smoke` with `SMOKE_CHROMIUM=bundled`; the docs run builds and packs the docs itself. Read-only permissions, a 45-minute timeout, and a second hand-started run waits for the first.
- **Seen when it fails:** `scripts/smoke/docs-run.mjs` writes each step's result to the run's summary (`scripts/smoke/docs-summary.mjs`); building the docs is now one of those steps. GitHub notifies whoever last set the schedule of a failed scheduled run.
- **Test:** `scripts/smoke/docs-nightly.test.mjs` in the root `pnpm test`: `pnpm smoke` stops at the embeds, the PR's smoke step does not mention the docs, `nightly.yml` runs on a schedule and by hand with its own set-up and only scripts that exist, and the summary's table.

Where to look: `package.json` (`smoke`), `.github/workflows/ci.yml` (smoke step name), `.github/workflows/nightly.yml`, `scripts/smoke/docs-run.mjs`, `docs-summary.mjs`, `docs-nightly.test.mjs`. Docs: README (`pnpm smoke`), CONTRIBUTING (the `ci.yml`, `nightly.yml` and `docs/` entries), TESTING (the docs plan's first step). Decision in LOG.md ("The docs run is nightly, not on every pull request (BON-217)"); manual test plan in TESTING.md (same title).

## Risks: what this could break, and how you would notice

- **A PR that breaks a docs page now goes green.** The break shows the next morning as a red **Nightly** run on main, its summary naming the failed step. Whoever changes the docs should run `pnpm docs:smoke` before merging.
- **Nobody looks at a red night.** GitHub's failure notification goes to one person (whoever last set the schedule); others see it only on the Actions tab.
- **The schedule stops.** GitHub disables scheduled workflows after 60 days without activity in the repository; Actions › Nightly then shows it disabled, and the runs stop appearing.
- **The workflow cannot be tried before the merge:** GitHub only runs a scheduled or hand-started workflow from the default branch's copy. The first Run workflow after the merge is the check.

## Checklist

- [x] If this changes how Bonkei draws (shapes, themes, layout, camera, lines, labels), the site's pictures are retaken with `pnpm capture` in this PR (`apps/site/public/*.png`: poster, og, still-flat, still-iso, still-3d, still-seq). Not applicable: nothing that draws changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

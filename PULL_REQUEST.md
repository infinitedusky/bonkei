# Bonkei's docs at bonkei.dev/docs/ (BON-178)

Bonkei's official documentation, a VitePress site in `docs/`, published at bonkei.dev/docs/ and linked from the site's header.

- **Installed like a user would.** `docs/` is not a workspace member. `scripts/docs-install.mjs` packs `bonkei` and `@bonkei/vitepress` and `npm install`s the tarballs; `docs/package-lock.json` pins everything else. The API reference is TypeDoc on the installed `dist/index.d.ts`; `twoslash` samples are type-checked against it, so a renamed option fails the docs build and names the page.
- **Pages.** Getting started for React, plain JavaScript, a script tag and VitePress; diagram types (flowchart and sequence draw, any other type stays a code block); options and frontmatter; the reader's controls; edge styles (with live `onEdgeStats` counts); themes; errors and warnings; the script-tag element and the VitePress plugin; the API reference (29 exports). Every example is a live diagram drawn from a ```` ```mermaid ```` fence; the home, Introduction and Diagram types pages have an editable playground.
- **For agents.** `llms.txt`, `llms-full.txt` (every page and every export's signature and description) and a `.md` beside every page, through `vitepress-plugin-llms`; a Copy page button on every page.
- **Core.** Each public export's declaration has its JSDoc (tsdown dropped the comments on `export … from` lines); `dist.test.mjs` fails for an export without one.
- **Telemetry.** `bonkei.docs.playground.edit` (status ERROR with the problem when an edit fails), `bonkei.docs.copy_markdown`, `bonkei.docs.script_tag.load`, through `@opentelemetry/api` (a no-op unless the site registers an SDK); Bonkei's and the plugin's own spans as before.
- **Checks.** `pnpm build` builds the docs into `dist/docs/` and `check-pages.mjs` guards them. `pnpm smoke` ends with `pnpm docs:smoke`: coverage, a broken sample, every page in Chrome (diagrams drawn = mermaid fences in its `.md`, no console errors, agent files, playground, Copy page, telemetry, 390/820/1024 px, a touch drag), and the four getting-started pages followed word for word in empty projects.

Where to look: decisions in LOG.md ("The docs, installed like a user's app (BON-178)"); manual test plan in TESTING.md (same task); stories **Mockups / Docs** and **Docs (built)**; the rule that a feature ships with its docs page in CONTRIBUTING.md.

## Risks: what this could break, and how you would notice

- **The Pages deploy now needs npm and the registry for the docs.** `pnpm build` runs `npm install` in `docs/`; a registry outage or a removed package fails the build, and so the deploy of the site and viewer too. You would see the Pages workflow fail at `pnpm build` in `docs-install`.
- **The docs lock drifts from the workspace's.** VitePress, Vue and the plugins in `docs/` are pinned by `docs/package-lock.json`, not `pnpm-lock.yaml`; Dependabot-style updates of one do not touch the other. A core dependency change rewrites the two tarball entries of the docs lock: commit it with the change.
- **Two VitePress sites now use the plugin** (`examples/vitepress` and `docs/`), with different VitePress versions possible. A plugin change that works in one can break the other; `pnpm smoke` runs both.
- **CI time.** The smoke job builds the docs twice (once on a copy, to prove a broken sample fails) and installs four fresh projects: several minutes more. The check job's `pnpm build` builds the docs once.
- **vitepress-plugin-llms quirks we work round.** It drops the `/docs/` base from the API section links in `llms.txt` (`buildEnd` puts it back) and its Copy page button asks for `/docs.md` on the home page (the home page has its own button, `CopyHomePage.vue`). A plugin update that fixes or changes either shows in the docs smoke's `agents:` and `copy as Markdown` lines.
- **Light only.** `appearance: false`: there is no dark switch until the diagrams follow it.
- **Touch on a real phone is not automated.** The smoke drags with Chrome's touch emulation; a real phone is step 11 of the test plan.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

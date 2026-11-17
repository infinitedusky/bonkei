# Bonkei as an installable package (BON-52)

`bonkei` is an ESM package with types and an exports map, built by tsdown, and nothing runs on import. It is on React 19 with React Three Fiber 9 and drei 10, and its React peer range is Fiber's own (`>=19 <19.4`). The host supplies React, React DOM and three; `@opentelemetry/api` comes with Bonkei. ELK and the libavoid wasm are fetched on the first layout. `dist/bonkei.global.js` serves script-tag embeds. The playground, the site and Storybook run against `dist/`. CI checks the package (publint, attw), the size budget, and the packed tarball drawing in a fresh Vite app and on a plain HTML page; every PR gets a pkg.pr.new build with `examples/vite` as its StackBlitz template. The decisions are in LOG.md ("Bonkei as an installable package (BON-52)"); TESTING.md has the manual test plan.

## Risks: what this could break, and how you would notice

- **Apps need a built core.** The playground, the site and Storybook resolve `bonkei` to `packages/core/dist`. Running one on its own without `pnpm --filter bonkei build` fails to resolve `bonkei`; a stale `dist/` shows old behaviour. The root `pnpm dev`, `build` and `storybook` build it first.
- **React 19 move.** Fiber 9 and drei 10 changed some internals (refs, `RefObject` types). A scene, control or story that relied on React 18 behaviour could break; you would notice it in Storybook and in `pnpm capture`'s stills.
- **Peer range drift.** When Fiber widens its React range, Bonkei's stays narrow until copied, so a host on the newer React gets a peer warning. `package.test.ts` fails as soon as the installed Fiber's range differs.
- **The wasm in other bundlers.** Vite 5 and 8 are tested. webpack, Next.js and others are not; if one moves the wasm, the inline chunk takes over (about 243 kB gzip more on that path). If both fail, lines use ELK's routes, and `routingError`, the `bonkei.wasm.load` span and `bonkei.route.fallback` say why.
- **First layout is later.** ELK (about 440 kB gzip) is fetched on the first layout, not with the page; on a slow network the first diagram waits for it. `bonkei.elk.load` has the ms; a failed fetch fails the layout, the error card shows it, and the next layout tries again.
- **CI.** The size job compares with main, which has no `.size-limit.mjs` until this merges, so the first comment has no base numbers. The pkg.pr.new job needs its GitHub app installed (BON-109); until then that job fails.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

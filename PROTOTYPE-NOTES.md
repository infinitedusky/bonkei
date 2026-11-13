# Marketing site prototype: findings
- First-load JS (site, lazy hero): site 8 kB + shared react chunk 143 kB = 151 kB (~49 kB gz). Scene chunk (three + drei + ELK + app) 2,439 kB (725 kB gz) loads after first paint.
- Eager would be ~2.6 MB (~775 kB gz) before first paint: ~17x more.
- Scene appears: ~0.45-0.6 s after navigation on a warm local server (2.3 s cold, first run, swiftshader software GL). Not measured over a real network.
- Multi-page: Storybook build and dev server (/ and /app/) fine. `vite preview` needs base '/merman/' too (isPreview).
- Singleton `cam`: never a problem here because hero and app are separate pages (module state resets). It would leak between hero remounts in an SPA (e.g. Storybook stories): focusOn/setMode run again on mount so it self-corrects, but `cur` pose starts from the last one.
- Phone (390px/touch) and WebGL-off: poster only, no scene chunk requested (verified: no HeroScene/SceneView request).
- Embedding: wheel was preventDefault'ed on the canvas, which trapped page scroll: added `wheelZoom={false}` for the hero (page scrolls normally, verified). Pointer drags on the ground plane still pan the camera in the hero; on touch we don't load it at all. Canvas takes no focus.
- Stills: taken with playwright-core + Chrome headless (swiftshader) from /app/?bare=1&mode=flat|iso|3d (bare hides the toolbar/fps).
shortcut: poster = iso still (not cropped for 460px stage); clips are placeholders; stars hard-coded 0; OG image URL assumes infinitedusky.github.io/merman.

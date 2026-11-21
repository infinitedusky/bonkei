# A stage from a 3D model: load a glTF and find its named parts (BON-253)

`config.bonkei.stage: kitchen.glb` in the frontmatter (or the `stage` prop) shows a glTF model as a stage in flat, iso and 3D, with the usual toolbar, Fit, pan, zoom and rotate. The model's top-level named objects are its parts, labelled as the author wrote them ("prep line", not prep_line); the named pieces inside a part are not. Each part gets a flat shaded zone; its name lies on the zone if it fits at the one zone size, else is written on the part's own sides, else floats above it with a line down. Zones never overlap and lie wholly on the model's own floor, which is stretched to hold them. A model that is missing, on another site, not a glTF, compressed, or has no named parts shows the error card with a readable message.

- **Core** (`packages/core/src`): `stage.ts` (fetch, check, load with three's `GLTFLoader`, find the parts, telemetry), `stageZones.ts` (zones, where each name goes, the grown floor, the fit's headroom), `StageScene.tsx` (the drawing), `names.ts` (`normaliseName`, exported). `options.ts` (the `stage` option and frontmatter key, the `stage` error and warning kind, `ReadyInfo.stage`), `diagram.ts` (a source with a stage loads it, in its own chunk, which fetches the drawing alongside the model), `Bonkei.tsx` (the stage prop in the source's key; the card says "This stage couldn't be shown"), `SceneView.tsx` (renders the drawing the stage brought, and the headroom), `shapes.tsx` (`rounded`, `mixc` exported).
- **Samples**: `apps/playground/scripts/make-stages.mjs` writes the kitchen, the house, a wrapper-node model, two parts named alike, no named parts, Draco, KTX2 and a text file, into the playground's `public/stages/`, the core tests' `fixtures/stages/` and `docs/public/stages/`. The viewer has ten `stage:` samples, opens one with `/app/?sample=stage: kitchen`, and lists a stage's parts with a find box (`StageParts.tsx`).
- **Stories**: Components / Bonkei / Stage, Stage House Flat, Stage From Prop 3d, Stage Names Alike, Stage Errors, Stage Update Error; Components / Stage parts (Kitchen, Found As Prep Line, Found As Prep Underscore Line, Nothing Found, Many Parts). Storybook serves `public/stages` at `/stages`.
- **Tests**: `packages/core/src/stage.test.ts`: the parts of each sample, names as written, pieces not parts, the wrapper, names alike, the normaliser, each error, the frontmatter key and the error's line, where each name goes on the kitchen and the house, zones apart and on the floor, the grown floor, a base for a model without a floor, the headroom, and the telemetry (a reason word, never the address).
- **Telemetry**: `bonkei.stage.load` and `bonkei.stage.loader.load` spans; `bonkei.prepare` says `bonkei.diagram: stage`.
- **Size**: main chunk 201.50 kB (201.10 on main; budget 202, unchanged); `stage-*` 7.4, `StageScene-*` 2.3 kB, each with its own budget; the script-tag bundle 890.2 kB, its budget raised from 880 to 892 kB (one file holds the loader and the stage code).

Docs: a new guide page, Stages from a 3D model (with a live kitchen), the `stage` row in Options, the `stage` kind in Errors and warnings, README (the option, error, warning, `onReady` and telemetry), CONTRIBUTING's code map. Decision in LOG.md ("A stage from a 3D model (BON-253)"); manual test plan in TESTING.md ("Manual test plan: a stage from a 3D model (BON-253)").

## Risks: what this could break, and how you would notice

- **Diagrams without a stage.** The only changes on their path are the frontmatter key, the error card's title for the new kind, and the source's key. A flowchart with `stage:` in its frontmatter now shows the stage and warns instead of drawing the flowchart; one without it is unchanged (the whole test suite passes). You would see a stage error card on a page that never asked for a stage.
- **A host bundler that does not split** `three/examples/jsm/loaders/GLTFLoader.js` or the stage chunks: they would ride in the host's main bundle. The Network tab would show no separate loader request; `pnpm size` covers Bonkei's own chunks only.
- **A real model unlike the samples**: a scene whose parts sit two wrappers deep has no parts (the "no named parts" card); a model in centimetres is a hundred times too big for the zone and name sizes, which are in metres. You would see the card, or tiny names.
- **The floor guess**: the largest flat object at ground level covering half the footprint is taken as the floor and stretched; a big rug could be taken for it. You would see the rug grow.
- **The script-tag bundle** is 22 kB larger for every page, stage or not; its budget was raised to 892 kB.

## Checklist

- [x] If this changes how Bonkei draws (shapes, themes, layout, camera, lines, labels), the site's pictures are retaken with `pnpm capture` in this PR (`apps/site/public/*.png`). Not retaken: no picture shows a stage, and diagrams draw as before.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

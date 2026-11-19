# The view stays where it is when the diagram changes (BON-195)

Only the first draw frames a diagram now. After that, a new source or a setting that lays it out again (a theme in the frontmatter or from the theme menu, avoid-crossings, `setTheme`) leaves the camera exactly where the reader put it: position, zoom, angle, and the tray they flew into. Fit and Flat / Iso / 3D frame as before. Same in the viewer, the docs, `render()`, the script tag and the front page, as they all draw through `SceneView`.

- **Lined up on what is on screen.** A diagram that grows moves its centre, so the camera moves by exactly as much as the nearest on-screen node (else the tray the view is in) moved: nothing on screen slides. If everything on screen was deleted it makes up for the centre's move. Something added out of view stays out of view until Fit.
- **The tray flown into is followed by id.** Edited, it is still the tray a mode switch frames; deleted, the camera stays still and the next mode switch frames the tray that held it, or the whole diagram.
- **`render()` handle: `setTheme(theme)`.** `<bonkei-diagram>` uses it when its `theme` attribute changes (it used to destroy and redraw, which reset the view). `mode` still draws afresh.
- **Telemetry.** `bonkei.relayout_kept_view` per kept layout (anchor, what happened to the tray, how far it moved); `bonkei.fit.after_edits` on `bonkei.fit`; `bonkei.element.theme_change`.

Where to look: `packages/core/src/camera.ts` (`relayout`, `adopt`, `frameOf`, `focusId`), `SceneView.tsx` (`FirstFrame`), `render.tsx` (`setTheme`), `elementClass.ts`; tests in `camera.test.ts`, `element.test.ts`, `controls.test.ts`. Stories **Components / Bonkei / Edits Keep The View**, **Render Function** (setTheme buttons), **Script tag / Element Theme Changed**. Docs: Guide → JavaScript (the handle), React, Controls ("When the diagram changes"), Reference → Script tag element; README. Decisions in LOG.md ("The view stays where it is when the diagram changes (BON-195)"); manual test plan in TESTING.md (same title).

## Risks: what this could break, and how you would notice

- **A page that relied on each new source re-framing** (a page that swaps whole different diagrams through one view, like the viewer's sample menu) now keeps the old camera; the new diagram can sit partly off-screen until Fit. You would notice a diagram opening zoomed into a corner after a swap; such a page calls `fit()` after `update()`.
- **Anchor choice.** If the node nearest the centre moves a long way in the new layout (ELK reorders a rank), the view follows it and the rest of the screen changes; a reader sees the node they looked at stay put while its neighbours jump. `bonkei.view.shift` in telemetry shows how far views were moved.
- **Mode switch after an edit while in a tray** now re-centres on that tray (or its parent, or the whole diagram if it was deleted) instead of keeping a pan made inside it. Someone who panned inside a tray, edited, then switched mode would see the view re-centre on the tray.
- **Script-tag theme attribute** now keeps the same React tree; a bug in a theme switch that a fresh mount used to hide (state from the old look) would show as a wrong look after changing `theme` on an element.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

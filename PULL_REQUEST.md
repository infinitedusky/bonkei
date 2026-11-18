# Pan, zoom and turn the way people expect (BON-78)

Moving around a diagram now works like a map or a design tool, the same in the viewer, the site, the docs and every story.

- **Trackpad and mouse.** A two-finger drag or the scroll wheel moves the diagram (⇧ for sideways); pinch or ⌘/Ctrl + scroll zooms. Flat and iso: a background drag moves, ⇧ + drag or a right-drag turns, settling on the nearest quarter turn. 3D: a drag turns and tilts, ⇧ + drag or a right-drag moves, ⇧ + scroll turns, so 3D no longer needs a right mouse button.
- **Touch.** One finger moves, pinch zooms, a twist turns (flat and iso settle square), and in 3D two fingers up or down tilt. A node drag gives way to a second finger.
- **Fit** shows the whole diagram and puts it back square, the short way round (`camera.square()`; also the handle's `fit()`).
- **"?" beside Fit** opens a card of the gestures for the input last used (trackpad, mouse or touch) and the view; Esc or × closes it.
- **A diagram in a page that scrolls** lets the page scroll past it with a short hint; a click (tap, or two fingers) takes hold, shown by a ring that follows the corners of the box that clips the diagram and "Esc to let go", until Esc or a press outside. Pinch and ⌘/Ctrl + scroll always zoom.
- **No right-click menu** over a diagram.
- **Telemetry.** `bonkei.control` gains `via`, `swapped` and `mode` (and `orbit` is now `turn`); new spans `bonkei.control.hint`, `bonkei.control.hold`, `bonkei.help`, `bonkei.fit`.

Where to look: `packages/core/src/controls.ts` (the rules, pure, tested in `controls.test.ts`), `hold.ts` (taking hold), `SceneView.tsx` (the wiring), `Bonkei.tsx` (the card and "?"), `camera.ts` (`square`, `nearestTurn`). Decisions in LOG.md ("Pan, zoom and turn the way people expect (BON-78)"); manual test plan in TESTING.md (same title); stories **Mockups / BON-78 Gestures** (Card, Toolbar With Card, Full Page, In A Page with a corner radius); docs in `docs/guide/controls.md` ("Gestures") and the README.

## Risks: what this could break, and how you would notice

- **Readers used to wheel-to-zoom.** A plain wheel now moves the diagram instead of zooming; a mouse user zooms with ⌘/Ctrl + wheel. You would hear "zoom stopped working"; the "?" card and the hint say how.
- **"Does this page scroll?" is guessed.** A diagram counts as in a page that scrolls when an ancestor or the document can scroll. A host whose page scrolls in a way this misses (a custom scroller with `overflow: hidden` and scripted scrolling) gets a diagram that takes the wheel at once; one that falsely looks scrollable shows the hint in a full-page app. You would see a hint where none is needed, or a page stuck under the pointer.
- **Touch on a page that scrolls.** One finger scrolls the page until the diagram is tapped. A host's own `touch-action` on the canvas is overridden by the diagram's inline style. On a real device, a diagram that moves with one finger before a tap, or a page that will not scroll over it, is the sign.
- **Trackpad pinch detection** relies on browsers sending a pinch as a wheel with `ctrlKey` (Chrome, Safari, Firefox, Edge do). Ctrl + a mouse wheel zooms too, so a browser that differs only changes the `via` attribute, not what happens.
- **Spans.** Dashboards counting `bonkei.control` with `orbit` must use `turn`. The new `via`, `swapped` and `mode` attributes are added, none removed.
- **Bundle.** The main chunk grows 3.9 kB gzip (192.8 kB); its size limit goes from 190 to 197 kB. The size check shows it.
- **Real hardware is not automated.** The checks drive Chrome with synthetic wheel, mouse and CDP touch events; a Mac trackpad, a mouse with Ctrl-click and a phone are steps 2–8 of the test plan.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

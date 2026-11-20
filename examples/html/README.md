# Bonkei by script tag

`index.html` is the whole example: one script tag, `<bonkei-diagram>` elements, no build step.

```sh
pnpm --filter bonkei build
node examples/html/copy-bundle.mjs      # bonkei.global.js, libavoid.wasm and fonts/ beside index.html
npx serve examples/html                 # any static server
```

`bonkei.global.js` finds `libavoid.wasm` and `fonts/` beside itself. Once the package is published, the same page works with
`<script src="https://cdn.jsdelivr.net/npm/bonkei/dist/bonkei.global.js"></script>`.

## What the script defines

- **`<bonkei-diagram>`.** Its text is a Mermaid flowchart or sequence diagram (indent it as you like). Attributes: `height`
  (a number is px; default 420 px when nothing else gives the element a height), `mode` (`flat`, `iso`, `3d`), `theme`
  (`classic`, `bonkei`, `bonkei-landscape`, `blueprint`). It is `display: block` unless your CSS gives it a display. The script tag may go in `<head>` or at the end of `<body>`. It fires `bonkei-ready` and `bonkei-error` events.
  Removed from the page it releases its scene; one added later draws. Loading the script twice is harmless.
- **`Bonkei.run({ querySelector })`.** Never automatic. Turns each matching block (default `pre.mermaid`) that holds a flowchart
  or a sequence diagram into a `<bonkei-diagram>`; any other type (a pie chart, say) is left as it is. Returns how many it converted.
- **`Bonkei.render(element, source, options)`.** The lower-level call the element uses (BON-52).

`pnpm smoke` (`scripts/smoke/embeds.mjs`) serves this page with the files from the packed tarball and checks all of the above.

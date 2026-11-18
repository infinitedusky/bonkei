# Bonkei by script tag

`index.html` is the whole example: one script tag, `<bonkei-diagram>` elements, no build step.

```sh
pnpm --filter bonkei build
node examples/html/copy-bundle.mjs      # bonkei.global.js, libavoid.wasm and fonts/ beside index.html
npx serve examples/html                 # any static server
```

`bonkei.global.js` finds `libavoid.wasm` and `fonts/` beside itself. After publishing, the same page works with
`<script src="https://cdn.jsdelivr.net/npm/bonkei/dist/bonkei.global.js">`.

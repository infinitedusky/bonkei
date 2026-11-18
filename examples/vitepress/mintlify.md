# Bonkei on Mintlify

What Mintlify allows, as found in the research for BON-53 (sources: mintlify.com/docs: customize/react-components, customize/custom-scripts, customize/third-party-libraries; mintlify.com/pricing). **Not yet tried on Mintlify**: it needs `bonkei` on a CDN and `mint dev`; that belongs to the "Mintlify embed" task.

In short:

| What | Allowed on | Use for Bonkei |
| --- | --- | --- |
| Custom React components (MDX, `/snippets/`) | every plan | yes: the likely route, below |
| Custom JavaScript (`.js` files in the docs folder) | every plan | yes: a second route |
| npm packages (`package.json`) | Enterprise only | no: React 18, deps only, server render within 3 s |
| ` ```mermaid ` fences | drawn by Mintlify itself | no: cannot be taken over |

## What it allows

- **Custom React components: yes, on every plan** (Hobby, the free tier, included). Written inline in MDX (`export const X = () => …`) or as named exports from `.jsx`/`.tsx` files such as `/snippets/`. Hooks (`useState`, `useEffect`, `useRef`) are available without importing. No default exports, no `.json` imports, no `React.lazy` or dynamic `import()`, and imports don't nest. Custom components render **client-side only**, so a component has to reserve its own height or the page jumps.
- **Custom JavaScript: yes, on every plan.** Any `.js` file in the docs folder runs on every page, once per visit after the page is interactive, and again on the `mintlify:navigate` window event. A raw `<script src>` in MDX is discouraged; inject a script element from JS instead.
- **npm packages: Enterprise only.** A `package.json` beside `docs.json`, dependencies only (no peers), a lockfile, each component server-rendered within 3 seconds, 5 MB gzip at most, and Mintlify's example uses React 18. Bonkei needs React 19 and cannot render on a server, so this route is out.
- **Mermaid: Mintlify draws ` ```mermaid ` fences itself.** A plugin cannot take them over, as the VitePress one does.

## The likely route

A snippet component, on any plan, with no npm:

1. It renders a box of the set height (client-side only, so the box is what stops the jump).
2. In `useEffect` it adds `<script src="https://cdn.jsdelivr.net/npm/bonkei/dist/bonkei.global.js">` once (one shared promise for the whole page), waiting for it to load. `libavoid.wasm` and `fonts/` are found beside the script on the CDN.
3. It calls `window.Bonkei.render(ref.current, source)`, and `destroy()` in the effect's cleanup.

```jsx
// snippets/bonkei.jsx: made-up names; untested on Mintlify
const SRC = 'https://cdn.jsdelivr.net/npm/bonkei/dist/bonkei.global.js'
const load = () => (window.__bonkeiLoad ??= new Promise((ok, fail) => {
  const s = document.createElement('script')
  s.src = SRC; s.onload = ok; s.onerror = fail
  document.head.appendChild(s)
}))

export const BonkeiDiagram = ({ source, height = 420 }) => {
  const ref = useRef(null)
  useEffect(() => {
    let handle, gone = false
    load().then(() => { if (!gone) handle = window.Bonkei.render(ref.current, source) })
    return () => { gone = true; handle?.destroy() }
  }, [source])
  return <div ref={ref} style={{ position: 'relative', height }} />
}
```

`load()` adds the script tag once per page and shares its promise. A custom `.js` file that injects `bonkei.global.js` (which defines `<bonkei-diagram>`) is a second route, with the diagrams written as `<bonkei-diagram>` in MDX; whether Mintlify's MDX passes unknown custom elements through is not verified.

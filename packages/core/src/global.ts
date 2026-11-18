// Entry of the script-tag bundle (bonkei.global.js): `Bonkei.render(el, source)` on a page with no build step,
// the <bonkei-diagram> element, and `Bonkei.run()` for <pre class="mermaid"> blocks (opt-in).
import { defineElement } from './element'
export { render } from './render'
export { isBonkeiError } from './diagram'
export { run } from './element'

// Guarded inside defineElement, so loading the script twice does not throw.
defineElement()

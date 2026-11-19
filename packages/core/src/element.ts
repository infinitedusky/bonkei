// The script tag's two ways in (BON-53): the <bonkei-diagram> custom element, and Bonkei.run() for <pre class="mermaid"> blocks.
// Both sit on render(). Only the IIFE entry (global.ts) imports this file: the ESM package defines no elements.
// Decisions: LOG.md, "Embeds: script tag and VitePress (BON-53)".
import { render } from './render'
import { makeElement, ELEMENT_NAME } from './elementClass'
import type { BonkeiOptions } from './options'
import { instant } from './telemetry'
import { dedent, isSupported } from './embed'

export { ELEMENT_NAME }

/** Defines <bonkei-diagram> once: loading the script a second time does nothing; outside a browser it does nothing. */
export function defineElement(name = ELEMENT_NAME): void {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get(name)) return
  customElements.define(name, makeElement(render))
}

export interface RunOptions {
  /** Which blocks to convert. Default 'pre.mermaid'. */
  querySelector?: string
  /** Or the exact nodes (querySelector is then ignored). */
  nodes?: ArrayLike<HTMLElement>
}

/**
 * Opt-in, never automatic: replaces each block that holds a flowchart or a sequence diagram with a <bonkei-diagram> of the same
 * source. Other diagram types (a pie chart, say) are left as they are. A block's `height` attribute and `id` carry over.
 * Returns how many blocks were converted.
 */
export function run(options: RunOptions = {}): number {
  defineElement()
  const nodes = options.nodes ?? document.querySelectorAll<HTMLElement>(options.querySelector ?? 'pre.mermaid')
  let converted = 0, skipped = 0
  for (const node of Array.from(nodes)) {
    const source = dedent(node.textContent ?? '')
    if (!isSupported(source)) { skipped++; continue }
    const el = document.createElement(ELEMENT_NAME)
    el.textContent = source
    for (const a of ['id', 'height', 'mode', 'theme']) { const v = node.getAttribute(a); if (v !== null) el.setAttribute(a, v) }
    node.replaceWith(el)
    converted++
  }
  instant('bonkei.run', { 'bonkei.run.converted': converted, 'bonkei.run.skipped': skipped, 'bonkei.run.selector': options.nodes ? '(nodes)' : options.querySelector ?? 'pre.mermaid' })
  return converted
}

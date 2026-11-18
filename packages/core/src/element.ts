// The script tag's two ways in (BON-53): the <bonkei-diagram> custom element, and Bonkei.run() for <pre class="mermaid"> blocks.
// Both sit on render(). Only the IIFE entry (global.ts) imports this file: the ESM package defines no elements.
// Decisions: LOG.md, "Embeds: script tag and VitePress (BON-53)".
import { render, type BonkeiHandle } from './render'
import type { BonkeiOptions } from './options'
import { instant } from './telemetry'
import { DEFAULT_HEIGHT, cssHeight, dedent, isSupported } from './embed'

export const ELEMENT_NAME = 'bonkei-diagram'

/**
 * <bonkei-diagram mode="iso" theme="bonkei" height="600">flowchart TD …</bonkei-diagram>
 * The text is the source (read once, dedented, then cleared). `mode` and `theme` map to the options, `height` sets the box;
 * with no height the element keeps a stylesheet's height, or gets DEFAULT_HEIGHT if it has none. It is display:block.
 * Fires `bonkei-ready` and `bonkei-error` (detail: what onReady / onError receive). Removed from the page, it destroys its view;
 * put back (or moved), it draws again from the same source.
 */
// Made on first define, not at load: the bundle must evaluate where HTMLElement does not exist (a server, a test sandbox).
const makeElement = () => class BonkeiDiagramElement extends HTMLElement {
  static observedAttributes = ['mode', 'theme', 'height']
  #source: string | null = null
  #handle: BonkeiHandle | null = null

  connectedCallback() {
    if (this.#source === null) { this.#source = dedent(this.textContent ?? ''); this.textContent = '' }
    if (!this.style.display) this.style.display = 'block'
    this.#applyHeight()
    this.#draw()
    instant('bonkei.element.connect', {
      'bonkei.element.mode': this.getAttribute('mode') ?? '',
      'bonkei.element.theme': this.getAttribute('theme') ?? '',
      'bonkei.element.height': this.style.height,
      'bonkei.element.supported': isSupported(this.#source),
    })
  }

  disconnectedCallback() {
    if (!this.#handle) return
    this.#handle.destroy()
    this.#handle = null
    instant('bonkei.element.disconnect', {})
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (!this.isConnected || this.#source === null || old === value) return
    if (name === 'height') this.#applyHeight()
    else { this.#handle?.destroy(); this.#handle = null; this.#draw() } // mode or theme: a fresh view
  }

  #applyHeight() {
    const attr = this.getAttribute('height')
    const h = cssHeight(attr)
    if (attr !== null && !h) instant('bonkei.element.bad_height', { 'bonkei.element.height': attr })
    if (h) this.style.height = h
    // a box with no content height of its own (a border does not count) gets the default, so the scene has room to draw
    else if (!this.style.height && this.clientHeight === 0) this.style.height = `${DEFAULT_HEIGHT}px`
  }

  #draw() {
    if (this.#handle || this.#source === null) return
    const options: BonkeiOptions = {
      onReady: r => this.dispatchEvent(new CustomEvent('bonkei-ready', { detail: r })),
      onError: e => this.dispatchEvent(new CustomEvent('bonkei-error', { detail: e })),
    }
    const mode = this.getAttribute('mode'), theme = this.getAttribute('theme')
    if (mode === 'flat' || mode === 'iso' || mode === '3d') options.mode = mode
    if (theme) options.theme = theme
    this.#handle = render(this, this.#source, options)
  }
}

/** Defines <bonkei-diagram> once: loading the script a second time does nothing; outside a browser it does nothing. */
export function defineElement(name = ELEMENT_NAME): void {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get(name)) return
  customElements.define(name, makeElement())
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

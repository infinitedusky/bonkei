// The script tag's two ways in (BON-53): the <bonkei-diagram> custom element, and Bonkei.run() for <pre class="mermaid"> blocks.
// Both sit on render(); this file is only in the IIFE entry (global.ts), the ESM package does not define elements.
import { render, type BonkeiHandle } from './render'
import { readFrontmatter, type BonkeiOptions } from './options'
import { instant } from './telemetry'

export const DEFAULT_HEIGHT = 420

/** True for a flowchart or a sequence diagram (after optional frontmatter and %% comments): the types Bonkei draws. */
export function isSupported(source: string): boolean {
  const body = readFrontmatter(source).body.replace(/^(\s*%%[^\n]*\n)+/, '')
  return /^\s*(flowchart|graph|sequenceDiagram)\b/.test(body)
}

/** Text content, trimmed and with the common indent removed, so a diagram can be indented inside the page's HTML. */
export function dedent(text: string): string {
  const lines = text.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n')
  const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^\s*/)![0].length))
  return lines.map(l => l.slice(Number.isFinite(indent) ? indent : 0)).join('\n')
}

const px = (v: string) => (/^\d+(\.\d+)?$/.test(v) ? `${v}px` : v)

class BonkeiDiagram extends HTMLElement {
  static observedAttributes = ['mode', 'theme', 'height']
  #source: string | null = null
  #handle: BonkeiHandle | null = null

  connectedCallback() {
    // The source is read once, then the text is cleared: render() fills the element. A moved element keeps its source.
    if (this.#source === null) { this.#source = dedent(this.textContent ?? ''); this.textContent = '' }
    if (!this.style.display) this.style.display = 'block'
    this.#applyHeight()
    this.#draw()
    instant('bonkei.element_connected', { 'bonkei.element.mode': this.getAttribute('mode') ?? '', 'bonkei.element.has_height_attr': this.hasAttribute('height') })
  }
  disconnectedCallback() {
    if (!this.#handle) return
    this.#handle.destroy()
    this.#handle = null
    instant('bonkei.element_disconnected', {})
  }
  attributeChangedCallback(name: string) {
    if (!this.isConnected || this.#source === null) return
    if (name === 'height') this.#applyHeight()
    else { this.#handle?.destroy(); this.#handle = null; this.#draw() } // mode or theme: a new view
  }

  // height="600" sets the box; with none, a stylesheet's height wins, and a box with no content height (a border does not count) gets the default.
  #applyHeight() {
    const h = this.getAttribute('height')
    if (h) this.style.height = px(h)
    else if (!this.style.height && this.clientHeight === 0) this.style.height = `${DEFAULT_HEIGHT}px`
  }
  #draw() {
    if (this.#handle || this.#source === null) return
    const options: BonkeiOptions = {}
    const mode = this.getAttribute('mode'), theme = this.getAttribute('theme')
    if (mode === 'flat' || mode === 'iso' || mode === '3d') options.mode = mode
    if (theme) options.theme = theme
    options.onError = e => this.dispatchEvent(new CustomEvent('bonkei-error', { detail: e }))
    options.onReady = r => this.dispatchEvent(new CustomEvent('bonkei-ready', { detail: r }))
    this.#handle = render(this, this.#source, options)
  }
}

export function defineElement(name = 'bonkei-diagram') {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) customElements.define(name, BonkeiDiagram)
}

export interface RunOptions {
  /** Which blocks to convert. Default 'pre.mermaid'. */
  querySelector?: string
  /** Or the exact nodes. */
  nodes?: ArrayLike<HTMLElement>
}

/**
 * Mermaid-style, and never automatic: replaces each supported block (flowchart, sequence) with a <bonkei-diagram> of the same source.
 * Other diagram types are left untouched. Returns how many were converted. The block's height is kept if it has one.
 */
export function run(options: RunOptions = {}): number {
  defineElement()
  const nodes = options.nodes ?? document.querySelectorAll<HTMLElement>(options.querySelector ?? 'pre.mermaid')
  let converted = 0, skipped = 0
  for (const node of Array.from(nodes)) {
    const source = dedent(node.textContent ?? '')
    if (!isSupported(source)) { skipped++; continue }
    const el = document.createElement('bonkei-diagram')
    el.textContent = source
    const h = node.getBoundingClientRect().height
    if (node.style.height) el.style.height = node.style.height
    else if (h > 200) el.style.height = `${Math.round(h)}px`
    node.replaceWith(el)
    converted++
  }
  instant('bonkei.run', { 'bonkei.run.converted': converted, 'bonkei.run.skipped': skipped })
  return converted
}

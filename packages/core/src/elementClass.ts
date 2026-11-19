// The <bonkei-diagram> element's class, apart from render() so a test can give it a fake one (element.ts wires the real one).
import type { BonkeiHandle } from './render.tsx'
import type { BonkeiOptions } from './options.ts'
import { instant } from './telemetry.ts'
import { DEFAULT_HEIGHT, cssHeight, dedent, isSupported } from './embed.ts'

export const ELEMENT_NAME = 'bonkei-diagram'

/**
 * <bonkei-diagram mode="iso" theme="bonkei" height="600">flowchart TD …</bonkei-diagram>
 * The text is the source (read once, dedented, then cleared). `mode` and `theme` map to the options, `height` sets the box;
 * with no height the element keeps a stylesheet's height, or gets DEFAULT_HEIGHT if it has none. It is display:block unless the
 * page's CSS gives it a display. The script may load in <head>: the source is then read once the page is parsed.
 * Fires `bonkei-ready` and `bonkei-error` (detail: what onReady / onError receive). Removed from the page, it destroys its view;
 * put back (or moved), it draws again from the same source.
 */
// Made on first define, not at load: the bundle must evaluate where HTMLElement does not exist (a server, a test sandbox).
export const makeElement = (draw: (el: HTMLElement, source: string, options: BonkeiOptions) => BonkeiHandle) => class BonkeiDiagramElement extends HTMLElement {
  static observedAttributes = ['mode', 'theme', 'height']
  #source: string | null = null
  #handle: BonkeiHandle | null = null
  #waiting = false
  #ownHeight = false // true once this element (not the page) has written style.height

  connectedCallback() {
    // With the script in <head> (or anywhere before the element), the element connects at its start tag, before the parser has
    // reached its text: read the source once the page is parsed.
    if (this.#source === null && document.readyState === 'loading') {
      if (!this.#waiting) {
        this.#waiting = true
        document.addEventListener('DOMContentLoaded', () => { this.#waiting = false; if (this.isConnected) this.connectedCallback() }, { once: true })
      }
      return
    }
    if (this.#source === null) { this.#source = dedent(this.textContent ?? ''); this.textContent = '' }
    // an element is display:inline unless the page's CSS says otherwise; a page that hides it or lays it out its own way keeps that
    if (!this.style.display && getComputedStyle(this).display === 'inline') this.style.display = 'block'
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
    if (name === 'height') {
      // a removed or unreadable height does not keep the old one: back to the default (measuring now would measure the drawn scene)
      if (this.#ownHeight && !cssHeight(value)) this.style.height = `${DEFAULT_HEIGHT}px`
      this.#applyHeight()
    } else if (name === 'theme' && this.#handle) {
      this.#handle.setTheme(value || undefined) // same view, laid out again: the reader keeps their camera
      instant('bonkei.element.theme_change', { 'bonkei.element.theme': value ?? '' })
    } else { this.#handle?.destroy(); this.#handle = null; this.#draw() } // mode: a fresh view
  }

  #applyHeight() {
    const attr = this.getAttribute('height')
    const h = cssHeight(attr)
    if (attr !== null && !h) instant('bonkei.element.bad_height', { 'bonkei.element.height': attr })
    if (h) { this.style.height = h; this.#ownHeight = true; return }
    if (this.style.height) return
    // a box with no content height of its own (a border does not count) gets the default, so the scene has room to draw;
    // a hidden one (display:none, clientHeight 0) keeps a height its stylesheet gives it
    const cs = getComputedStyle(this)
    const noHeight = cs.display === 'none' ? cs.height === 'auto' : this.clientHeight === 0
    if (noHeight) { this.style.height = `${DEFAULT_HEIGHT}px`; this.#ownHeight = true }
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
    this.#handle = draw(this, this.#source, options)
  }
}


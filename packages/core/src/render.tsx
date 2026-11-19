// render(): <Bonkei /> for pages without React. It owns its React root; the caller never sees React.
import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Bonkei, type BonkeiViewHandle } from './Bonkei'
import type { Mode } from './camera'
import type { GraphInput } from './model'
import type { BonkeiOptions } from './options'

/** The handle render() returns: update(source), setMode(), setTheme(), destroy(). */
export interface BonkeiHandle extends BonkeiViewHandle {
  /** Draw a new source in the same view (same camera). A failed update keeps the last diagram. */
  update(source: string | GraphInput): void
  /** Draw in another theme (a preset name, a Theme, or undefined for the frontmatter's / the default), keeping the view like `update` does. */
  setTheme(theme: BonkeiOptions['theme']): void
  /** Unmount and release the view. Every later call on the handle does nothing. */
  destroy(): void
}

/** Draws `source` into `element` (which it fills) and returns a handle to drive it. */
export function render(element: HTMLElement, source: string | GraphInput, options: BonkeiOptions = {}): BonkeiHandle {
  const root = createRoot(element)
  const view = createRef<BonkeiViewHandle>()
  let alive = true
  let current = source
  let opts: BonkeiOptions = { ...options }
  const draw = () => root.render(<Bonkei ref={view} {...opts} source={current} />)
  draw()
  return {
    update(next) {
      if (!alive) return
      current = next
      draw()
    },
    setMode(m: Mode) {
      if (!alive) return
      if (view.current) view.current.setMode(m)
      else { opts = { ...opts, mode: m }; draw() } // not mounted yet: becomes the first view
    },
    setTheme(theme) {
      if (!alive) return
      opts = { ...opts, theme }
      draw()
    },
    fit() {
      if (alive) view.current?.fit()
    },
    destroy() {
      if (!alive) return
      alive = false
      root.unmount()
    },
  }
}

import { createRoot } from 'react-dom/client'
import { createRef } from 'react'
import { Bonkei, type BonkeiViewHandle } from './Bonkei'
import type { BonkeiOptions } from './options'
import type { Mode } from './camera'

export interface BonkeiHandle {
  /** Draw a new source. If it cannot be drawn the last good diagram stays. */
  update(source: string): void
  setMode(mode: Mode): void
  fit(): void
  /** Unmount and remove the canvas. Calls after this do nothing. */
  destroy(): void
}

/** Draw `source` into `element` with no React in your code. The element needs a size; the diagram fills it. */
export function render(element: HTMLElement, source: string, options: BonkeiOptions = {}): BonkeiHandle {
  const root = createRoot(element)
  const view = createRef<BonkeiViewHandle>()
  let src = source, opts = options, alive = true
  const paint = () => root.render(<Bonkei ref={view} source={src} {...opts} />)
  paint()
  return {
    update(s) { if (!alive) return; src = s; paint() },
    setMode(m) { if (!alive) return; if (view.current) view.current.setMode(m); else { opts = { ...opts, mode: m }; paint() } },
    fit() { if (alive) view.current?.fit() },
    destroy() { if (!alive) return; alive = false; root.unmount(); element.replaceChildren() },
  }
}

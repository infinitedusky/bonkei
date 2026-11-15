import { toCanvas } from 'html-to-image'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

export type RasterEvent =
  | { type: 'rasterized'; id: string; ms: number }
  | { type: 'rasterize-failed'; id: string; error: string }

interface Entry { texture: Texture; data: unknown; w: number; h: number }

/**
 * Pictures of rendered React Flow nodes, one per node id. A node is redone only when its `data` object
 * or measured size changes. Work is queued one node at a time, yielding to the browser between nodes.
 */
export class Rasterizer {
  textures = new Map<string, Texture>()
  private entries = new Map<string, Entry>()
  private pending = new Map<string, { data: unknown; w: number; h: number }>()
  private running = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private dead = false

  constructor(private getDom: () => HTMLElement | null | undefined, private onChange: () => void, private onEvent: (e: RasterEvent) => void) {}

  /** Tell it which custom nodes exist now. */
  sync(nodes: { id: string; data: unknown; w: number; h: number; hold?: boolean }[]) {
    const live = new Set(nodes.map(n => n.id))
    for (const [id, e] of this.entries) if (!live.has(id)) { e.texture.dispose(); this.entries.delete(id); this.textures.delete(id) }
    for (const id of this.pending.keys()) if (!live.has(id)) this.pending.delete(id)
    for (const n of nodes) {
      if (n.hold) { this.pending.delete(n.id); continue } // being resized: keep the old picture, redo when it stops
      const e = this.entries.get(n.id), p = this.pending.get(n.id)
      if (p && p.data === n.data && p.w === n.w && p.h === n.h) continue
      if (!p && e && e.data === n.data && e.w === n.w && e.h === n.h) continue
      this.pending.set(n.id, { data: n.data, w: n.w, h: n.h })
    }
    if (this.pending.size) this.kick()
  }

  private kick() {
    if (this.running || this.timer) return
    // wait for React Flow to commit the changed DOM before taking the picture
    this.timer = setTimeout(() => { this.timer = null; void this.run() }, 60)
  }

  private async run() {
    this.running = true
    while (this.pending.size && !this.dead) {
      const [id, job] = this.pending.entries().next().value as [string, { data: unknown; w: number; h: number }]
      this.pending.delete(id)
      const dom = this.getDom()
      const el = dom?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
      if (!el) continue
      const t0 = performance.now()
      try {
        const canvas = await toCanvas(el, {
          pixelRatio: 2, width: job.w, height: job.h, cacheBust: false,
          // the node is positioned with a transform and inherits visibility from its container: undo both on the copy
          style: { transform: 'none', left: '0', top: '0', margin: '0', visibility: 'visible', opacity: '1' },
        })
        const old = this.entries.get(id)
        const texture = new CanvasTexture(canvas)
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = 8
        old?.texture.dispose()
        this.entries.set(id, { texture, data: job.data, w: job.w, h: job.h })
        this.textures.set(id, texture)
        this.onEvent({ type: 'rasterized', id, ms: performance.now() - t0 })
        this.onChange()
      } catch (err) {
        this.entries.set(id, { texture: this.entries.get(id)?.texture as Texture, data: job.data, w: job.w, h: job.h })
        this.onEvent({ type: 'rasterize-failed', id, error: String(err) })
      }
      await new Promise(r => setTimeout(r, 0))
    }
    this.running = false
  }

  dispose() {
    this.dead = true
    if (this.timer) clearTimeout(this.timer)
    for (const e of this.entries.values()) e.texture?.dispose()
  }
}

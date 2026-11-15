import { useEffect, useRef, useState } from 'react'
import { useNodesInitialized, useStoreApi, type InternalNode } from '@xyflow/react'
import { SceneView, type LayoutResult, type LabelMode, type Mode } from 'bonkei'
import { toLayout, isCustom, type Frame } from './toLayout'
import { Rasterizer, type RasterEvent } from './rasterize'

export type Bonkei3DEvent =
  | RasterEvent
  | { type: 'first-frame'; ms: number }
  | { type: 'layout'; meanMs: number; builds: number }
  | { type: 'fallback-count'; count: number; custom: number }

export interface Bonkei3DProps {
  mode?: Mode
  labelMode?: LabelMode
  /** Show custom nodes as pictures of their rendered DOM. Default true. */
  rasterize?: boolean
  /** Telemetry hook: the library never sends anything itself. */
  onEvent?: (e: Bonkei3DEvent) => void
  /** Called with each layout handed to the 3D scene (for tests and debugging). */
  onLayout?: (l: LayoutResult) => void
  style?: React.CSSProperties
}

export function Bonkei3D({ mode = 'iso', labelMode = 'top', rasterize = true, onEvent, onLayout, style }: Bonkei3DProps) {
  const store = useStoreApi()
  // latch: nodes flip back to uninitialized for a moment whenever one is added; the feed must not restart
  const measured = useNodesInitialized()
  const [ready, setReady] = useState(false)
  useEffect(() => { if (measured) setReady(true) }, [measured])
  const [data, setData] = useState<LayoutResult | null>(null)
  const emit = useRef(onEvent); emit.current = onEvent
  const lay = useRef(onLayout); lay.current = onLayout
  const t0 = useRef(performance.now())

  useEffect(() => {
    if (!ready) return
    let frame: Frame | null = null
    let raf = 0, dirty = true, lastFallback = -1, acc = 0, cnt = 0
    const rz = new Rasterizer(() => store.getState().domNode, () => { dirty = true; schedule() }, e => emit.current?.(e))
    const build = () => {
      raf = 0
      if (!dirty) return
      dirty = false
      const tb = performance.now()
      const s = store.getState()
      const nodes = s.nodeLookup as Map<string, InternalNode>
      if (rasterize) {
        const custom: { id: string; data: unknown; w: number; h: number; hold?: boolean }[] = []
        for (const n of nodes.values()) if (isCustom(n.type) && !n.hidden && n.measured?.width) custom.push({ id: n.id, data: n.data, w: n.measured.width, h: n.measured.height ?? 0, hold: !!n.internals.userNode.resizing })
        rz.sync(custom)
      }
      const r = toLayout(nodes, s.edges, s.connectionMode, rz.textures, frame)
      frame = r.frame
      if (r.fallback !== lastFallback) { lastFallback = r.fallback; emit.current?.({ type: 'fallback-count', count: r.fallback, custom: [...nodes.values()].filter(n => isCustom(n.type)).length }) }
      setData(r.layout); lay.current?.(r.layout)
      acc += performance.now() - tb; if (++cnt === 60) { emit.current?.({ type: 'layout', meanMs: acc / cnt, builds: cnt }); acc = 0; cnt = 0 }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(build) }
    const unsub = store.subscribe(() => { dirty = true; schedule() })
    build()
    return () => { unsub(); cancelAnimationFrame(raf); rz.dispose() }
  }, [store, ready, rasterize]) // eslint-disable-line react-hooks/exhaustive-deps

  const first = useRef(false)
  useEffect(() => {
    if (data && !first.current) { first.current = true; requestAnimationFrame(() => emit.current?.({ type: 'first-frame', ms: performance.now() - t0.current })) }
  }, [data])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <SceneView data={data} labelMode={labelMode} mode={mode} live trayLabel="above" edgeHeight="middle" />
      {!data && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#7f8aa3', font: '13px system-ui' }}>waiting for React Flow to measure nodes…</div>}
    </div>
  )
}

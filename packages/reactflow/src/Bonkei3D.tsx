import { useEffect, useRef, useState } from 'react'
import { useNodesInitialized, useStoreApi, type InternalNode } from '@xyflow/react'
import { SceneView, type LayoutResult, type LabelMode, type Mode } from 'bonkei'
import { toLayout, isCustom, type Frame } from './toLayout'
import { Rasterizer, type RasterEvent } from './rasterize'

export type Bonkei3DEvent =
  | RasterEvent
  | { type: 'first-frame'; ms: number }
  | { type: 'fallback-count'; count: number; custom: number }

export interface Bonkei3DProps {
  mode?: Mode
  labelMode?: LabelMode
  /** Show custom nodes as pictures of their rendered DOM. Default true. */
  rasterize?: boolean
  /** Telemetry hook: the library never sends anything itself. */
  onEvent?: (e: Bonkei3DEvent) => void
  style?: React.CSSProperties
}

export function Bonkei3D({ mode = 'iso', labelMode = 'top', rasterize = true, onEvent, style }: Bonkei3DProps) {
  const store = useStoreApi()
  const initialized = useNodesInitialized()
  const [data, setData] = useState<LayoutResult | null>(null)
  const emit = useRef(onEvent); emit.current = onEvent
  const t0 = useRef(performance.now())

  useEffect(() => {
    if (!initialized && !data) return
    let frame: Frame | null = null
    let raf = 0, dirty = true, lastFallback = -1
    const rz = new Rasterizer(() => store.getState().domNode, () => { dirty = true; schedule() }, e => emit.current?.(e))
    const build = () => {
      raf = 0
      if (!dirty) return
      dirty = false
      const s = store.getState()
      const nodes = s.nodeLookup as Map<string, InternalNode>
      if (rasterize) {
        const custom: { id: string; data: unknown; w: number; h: number }[] = []
        for (const n of nodes.values()) if (isCustom(n.type) && !n.hidden && n.measured?.width) custom.push({ id: n.id, data: n.data, w: n.measured.width, h: n.measured.height ?? 0 })
        rz.sync(custom)
      }
      const r = toLayout(nodes, s.edges, s.connectionMode, rz.textures, frame)
      frame = r.frame
      if (r.fallback !== lastFallback) { lastFallback = r.fallback; emit.current?.({ type: 'fallback-count', count: r.fallback, custom: [...nodes.values()].filter(n => isCustom(n.type)).length }) }
      setData(r.layout)
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(build) }
    const unsub = store.subscribe(() => { dirty = true; schedule() })
    build()
    return () => { unsub(); cancelAnimationFrame(raf); rz.dispose() }
  }, [store, initialized && true, rasterize]) // eslint-disable-line react-hooks/exhaustive-deps

  const first = useRef(false)
  useEffect(() => {
    if (data && !first.current) { first.current = true; requestAnimationFrame(() => emit.current?.({ type: 'first-frame', ms: performance.now() - t0.current })) }
  }, [data])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <SceneView data={data} labelMode={labelMode} mode={mode} live trayLabel="above" />
      {!data && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#7f8aa3', font: '13px system-ui' }}>waiting for React Flow to measure nodes…</div>}
    </div>
  )
}

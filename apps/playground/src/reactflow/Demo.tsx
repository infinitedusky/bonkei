import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, addEdge, useNodesState, useEdgesState, useReactFlow, type Connection } from '@xyflow/react'
import { Bonkei3D, type Bonkei3DEvent } from 'bonkei-reactflow'
import type { Mode } from 'bonkei'
import { nodeTypes } from './nodes'
import { smallFlow, bigFlow } from './flows'

const btn = (on = false): React.CSSProperties => ({ padding: '4px 10px', border: '1px solid #3a4560', background: on ? '#4b6bdc' : '#1a2030', color: '#fff', borderRadius: 5, cursor: 'pointer' })

declare global { interface Window { __bonkei: { events: Bonkei3DEvent[]; autoDrag: (ms: number) => Promise<void>; nodes: () => number } } }

function Inner() {
  const [big, setBig] = useState(() => new URLSearchParams(location.search).has('big'))
  const [init] = useState(() => (new URLSearchParams(location.search).has('big') ? bigFlow() : smallFlow()))
  const [nodes, setNodes, onNodesChange] = useNodesState(init.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(init.edges)
  const [mode, setMode] = useState<Mode>('iso')
  const [hide, setHide] = useState<'no' | 'visibility' | 'display'>(() => (new URLSearchParams(location.search).get('hide') as 'visibility' | 'display') ?? 'no')
  const [raster, setRaster] = useState(true)
  const [log, setLog] = useState('')
  const [seed, setSeed] = useState(0)
  const events = useRef<Bonkei3DEvent[]>([])
  const rf = useReactFlow()
  const counter = useRef(0)

  const load = (b: boolean) => { const f = b ? bigFlow() : smallFlow(); setBig(b); setNodes(f.nodes); setEdges(f.edges); setSeed(s => s + 1); events.current = [] }
  const onConnect = useCallback((c: Connection) => setEdges(es => addEdge({ ...c, type: 'smoothstep' }, es)), [setEdges])

  const onEvent = useCallback((e: Bonkei3DEvent) => {
    events.current.push(e)
    const r = events.current.filter(x => x.type === 'rasterized') as Extract<Bonkei3DEvent, { type: 'rasterized' }>[]
    const fb = [...events.current].reverse().find(x => x.type === 'fallback-count') as Extract<Bonkei3DEvent, { type: 'fallback-count' }> | undefined
    const ff = events.current.find(x => x.type === 'first-frame') as Extract<Bonkei3DEvent, { type: 'first-frame' }> | undefined
    const fail = events.current.filter(x => x.type === 'rasterize-failed').length
    setLog(`first 3D frame ${ff ? Math.round(ff.ms) + 'ms' : '…'} · rasterized ${r.length} (last ${r.length ? r[r.length - 1].ms.toFixed(0) : '-'}ms, mean ${r.length ? (r.reduce((a, x) => a + x.ms, 0) / r.length).toFixed(0) : '-'}ms) · failed ${fail} · plain-box fallbacks ${fb ? fb.count + '/' + fb.custom : '-'}`)
  }, [])

  // moves one node in a circle through the same onNodesChange path a real drag uses
  useEffect(() => {
    window.__bonkei = {
      events: events.current,
      nodes: () => rf.getNodes().length,
      autoDrag: (ms) => new Promise(res => {
        const id = rf.getNodes().find(n => n.type === 'card')!.id
        const p0 = rf.getNode(id)!.position, t0 = performance.now()
        const tick = () => {
          const t = performance.now() - t0
          if (t > ms) return res()
          setNodes(ns => ns.map(n => n.id === id ? { ...n, position: { x: p0.x + 60 * Math.cos(t / 200), y: p0.y + 60 * Math.sin(t / 200) } } : n))
          requestAnimationFrame(tick)
        }
        tick()
      }),
    }
  })

  const add = () => { const id = `new${counter.current++}`; setNodes(ns => [...ns, { id, type: 'card', position: { x: 100 + counter.current * 30, y: -120 }, data: { title: 'New card', emoji: '✨', status: 'ok', body: 'Added in 2D.\nShows in 3D.' } }]) }
  const edit = () => setNodes(ns => ns.map(n => n.id === 'c1' || n.id === 'g0n0' ? { ...n, data: { ...(n.data as object), status: (n.data as { status: string }).status === 'ok' ? 'fail' : 'ok', title: 'Edited ' + Math.round(performance.now() % 1000) } } : n))
  const delSel = () => rf.deleteElements({ nodes: rf.getNodes().filter(n => n.selected), edges: rf.getEdges().filter(e => e.selected) })

  const twoD: React.CSSProperties = hide === 'visibility' ? { visibility: 'hidden' } : hide === 'display' ? { display: 'none' } : {}
  return (
    <div style={{ display: 'flex', height: '100%', color: '#9aa6c0' }}>
      <div style={{ flex: hide === 'no' ? 1 : '0 0 1px', position: hide === 'visibility' ? 'absolute' : 'relative', width: hide === 'visibility' ? '50%' : undefined, height: '100%', borderRight: '1px solid #243044', ...twoD }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView colorMode="dark" minZoom={0.05}>
          <Background /><Controls />
        </ReactFlow>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <Bonkei3D key={seed} mode={mode} rasterize={raster} onEvent={onEvent} />
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['flat', 'iso', '3d'] as Mode[]).map(m => <button key={m} style={btn(mode === m)} onClick={() => setMode(m)}>{m}</button>)}
          <button style={btn(big)} onClick={() => load(!big)}>200 nodes</button>
          <button style={btn()} onClick={add}>+ node</button>
          <button style={btn()} onClick={edit}>edit data</button>
          <button style={btn()} onClick={delSel}>delete selected</button>
          <button style={btn(raster)} onClick={() => setRaster(r => !r)}>pictures</button>
          <select value={hide} onChange={e => { const u = new URL(location.href); u.searchParams.set('hide', e.target.value); location.href = u.href }} style={{ ...btn(), padding: 4 }}>
            <option value="no">2D shown</option><option value="visibility">2D visibility:hidden</option><option value="display">2D display:none</option>
          </select>
          <a href="/app/" style={{ color: '#9aa6c0' }}>viewer</a>
        </div>
        <div style={{ position: 'absolute', left: 8, bottom: 8, font: '11px monospace' }}>{log}</div>
      </div>
    </div>
  )
}

export default function Demo() { return <ReactFlowProvider><Inner /></ReactFlowProvider> }

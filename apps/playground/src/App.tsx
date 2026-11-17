import { useEffect, useState } from 'react'
import { SAMPLES } from './samples'
import { Bonkei, type LabelMode } from 'bonkei'
import type { EdgeStats } from 'bonkei/internal'

const btn = (on: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #3a4560', background: on ? '#4b6bdc' : '#1a2030', color: '#fff', borderRadius: 5, cursor: 'pointer' })

export default function App() {
  const [src, setSrc] = useState(Object.values(SAMPLES)[0])
  const [sel, setSel] = useState(Object.keys(SAMPLES)[0])
  const [debounced, setDebounced] = useState(src)
  const [labelMode, setLabelMode] = useState<LabelMode>('top')
  const [edit, setEdit] = useState(false)
  const [ms, setMs] = useState<number | null>(null)
  const [dropped, setDropped] = useState(0)
  const [edges, setEdges] = useState<EdgeStats | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(src), 250)
    return () => clearTimeout(t)
  }, [src])
  // The dropped count is per source.
  useEffect(() => { setDropped(0) }, [debounced])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Bonkei source={debounced} labels={labelMode}
        onReady={r => setMs(r.layoutMs)}
        onError={() => setMs(null)}
        onEdgeStats={setEdges}
        onWarning={w => { if (w.kind === 'dropped') setDropped(n => n + 1) }} />
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center', color: '#9aa6c0' }}>
        <button style={btn(false)} onClick={() => setLabelMode(l => l === 'top' ? 'billboard' : 'top')}>labels: {labelMode}</button>
        <select value={sel} onChange={e => { setSel(e.target.value); setSrc(SAMPLES[e.target.value]) }} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{Object.keys(SAMPLES).map(k => <option key={k}>{k}</option>)}</select>
        <button style={btn(edit)} onClick={() => setEdit(e => !e)}>source</button>
      </div>
      {/* the route quality readout: what the avoid-crossings setting and a drag do to the lines */}
      <div data-readout style={{ position: 'absolute', top: 48, left: 10, color: '#9aa6c0', font: '12px monospace', pointerEvents: 'none', whiteSpace: 'pre' }}>
        <span>layout {ms === null ? '–' : Math.round(ms)} ms · {dropped} lines dropped{edges && ` · routed in ${Math.round(edges.routeMs)} ms · drag frame ${edges.dragMs.toFixed(1)} ms · ${edges.unroutable} unroutable\n[avoid ${edges.avoidCrossings}] crossings ${edges.quality.crossings} (${edges.bridge}/${edges.tunnel}/${edges.portal} drawn, ${edges.skipped} no room) · overlapping ${edges.quality.overlaps} · doubling back ${edges.quality.doublingBack} · length/direct ${edges.quality.lengthRatio} · through blocks ${edges.quality.throughBlocks} / foreign trays ${edges.quality.throughTrays}${edges.routingError ? ` · ROUTING FELL BACK TO ELK: ${edges.routingError}` : ''}`}</span>
      </div>
      {edit && <textarea value={src} onChange={e => setSrc(e.target.value)} spellCheck={false}
        style={{ position: 'absolute', top: 88, left: 10, width: 360, height: '60%', background: '#10151f', color: '#cfd8ea', border: '1px solid #3a4560', font: '12px monospace' }} />}
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#556', fontSize: 11, pointerEvents: 'none' }}>drag node · drag bg pan (3d: orbit) · wheel zoom · click tray to fly in</div>
    </div>
  )
}

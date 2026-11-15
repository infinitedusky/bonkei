import { useEffect, useRef, useState } from 'react'
import { Bonkei, type BonkeiViewHandle, type BonkeiError, type LabelMode } from 'bonkei'
import { SAMPLES } from './samples'

const btn = (on: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #3a4560', background: on ? '#4b6bdc' : '#1a2030', color: '#fff', borderRadius: 5, cursor: 'pointer' })

export default function App() {
  const [src, setSrc] = useState(Object.values(SAMPLES)[0])
  const [drawn, setDrawn] = useState(src) // the source after the 250ms typing pause
  const [sel, setSel] = useState(Object.keys(SAMPLES)[0])
  const [labels, setLabels] = useState<LabelMode>('top')
  const [edit, setEdit] = useState(false)
  const [ms, setMs] = useState(0)
  const [warn, setWarn] = useState<BonkeiError[]>([])
  const view = useRef<BonkeiViewHandle>(null)

  useEffect(() => { const t = setTimeout(() => setDrawn(src), 250); return () => clearTimeout(t) }, [src])
  useEffect(() => setWarn([]), [drawn])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Bonkei ref={view} source={drawn} labels={labels}
        onReady={r => setMs(r.layoutMs)} onError={e => e.severity === 'warning' && setWarn(w => [...w, e])} />
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center', color: '#9aa6c0' }}>
        <button style={btn(false)} onClick={() => setLabels(l => l === 'top' ? 'billboard' : 'top')}>labels: {labels}</button>
        <button style={btn(false)} onClick={() => view.current?.fit()}>fit</button>
        <select value={sel} onChange={e => { setSel(e.target.value); setSrc(SAMPLES[e.target.value]) }} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{Object.keys(SAMPLES).map(k => <option key={k}>{k}</option>)}</select>
        <button style={btn(edit)} onClick={() => setEdit(e => !e)}>source</button>
        <span>layout {ms}ms{warn.length ? ` · ${warn.length} line${warn.length > 1 ? 's' : ''} skipped` : ''}</span>
      </div>
      {edit && <textarea value={src} onChange={e => setSrc(e.target.value)} spellCheck={false}
        style={{ position: 'absolute', top: 48, left: 10, width: 360, height: '60%', background: '#10151f', color: '#cfd8ea', border: '1px solid #3a4560', font: '12px monospace' }} />}
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#556', fontSize: 11 }}>drag node · drag bg pan (3d: orbit) · wheel zoom · click tray to fly in</div>
    </div>
  )
}

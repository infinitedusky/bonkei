import { useEffect, useState } from 'react'
import { SAMPLES } from './samples'
import { Bonkei, THEME_NAMES, type LabelMode } from 'bonkei'
import type { EdgeStats } from 'bonkei/internal'

// The site sits one level above the viewer (/app/ in dev, /merman/app/ on Pages).
const SITE = import.meta.env.BASE_URL.replace(/app\/$/, '')
// The theme menu: what the source's frontmatter asks for, each built-in theme, and a name nobody knows (drawn in Classic, with a warning).
const FROM_SOURCE = 'from source', UNKNOWN = 'nope (unknown name)'
const THEME_MENU = [FROM_SOURCE, ...THEME_NAMES, UNKNOWN]

const btn = (on: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #3a4560', background: on ? '#4b6bdc' : '#1a2030', color: '#fff', borderRadius: 5, cursor: 'pointer' })

export default function App() {
  const [src, setSrc] = useState(Object.values(SAMPLES)[0])
  const [sel, setSel] = useState(Object.keys(SAMPLES)[0])
  const [debounced, setDebounced] = useState(src)
  const [labelMode, setLabelMode] = useState<LabelMode>('top')
  const [theme, setTheme] = useState(FROM_SOURCE)
  // the last theme warning; line 0 means it came from the theme menu (the prop), so it outlives a new source
  const [warn, setWarn] = useState<{ message: string; line: number } | null>(null)
  const [fps, setFps] = useState(0)
  // page frame rate: frames the browser drew per second (the canvas renders every frame)
  useEffect(() => {
    let n = 0, t0 = performance.now(), id = 0
    const f = (t: number) => { n++; if (t - t0 >= 500) { setFps(Math.round((n * 1000) / (t - t0))); n = 0; t0 = t } id = requestAnimationFrame(f) }
    id = requestAnimationFrame(f)
    return () => cancelAnimationFrame(id)
  }, [])
  const [edit, setEdit] = useState(false)
  const [ms, setMs] = useState<number | null>(null)
  const [dropped, setDropped] = useState(0)
  const [edges, setEdges] = useState<EdgeStats | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(src), 250)
    return () => clearTimeout(t)
  }, [src])
  // The dropped count and the theme warning are per source.
  useEffect(() => { setDropped(0); setWarn(w => (w && w.line === 0 ? w : null)) }, [debounced])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Bonkei source={debounced} labels={labelMode} theme={theme === FROM_SOURCE ? undefined : theme === UNKNOWN ? 'nope' : theme}
        onReady={r => setMs(r.layoutMs)}
        onError={() => setMs(null)}
        onEdgeStats={setEdges}
        onWarning={w => { if (w.kind === 'dropped') setDropped(n => n + 1); else if (w.kind === 'theme') setWarn({ message: w.message, line: w.line }) }} />
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center', color: '#9aa6c0' }}>
        <a href={SITE} style={{ ...btn(false), textDecoration: 'none', font: 'inherit' }}>← Site</a>
        <button style={btn(false)} onClick={() => setLabelMode(l => l === 'top' ? 'billboard' : 'top')}>labels: {labelMode}</button>
        <select value={sel} onChange={e => { setSel(e.target.value); setSrc(SAMPLES[e.target.value]) }} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{Object.keys(SAMPLES).map(k => <option key={k}>{k}</option>)}</select>
        <select aria-label="Theme" value={theme} onChange={e => { setTheme(e.target.value); setWarn(null) }} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{THEME_MENU.map(k => <option key={k}>{k}</option>)}</select>
        <button style={btn(edit)} onClick={() => setEdit(e => !e)}>source</button>
      </div>
      {/* the route quality readout: what the avoid-crossings setting and a drag do to the lines */}
      <div data-readout style={{ position: 'absolute', top: 48, left: 10, color: '#9aa6c0', font: '12px monospace', pointerEvents: 'none', whiteSpace: 'pre' }}>
        <span>{fps} fps · layout {ms === null ? '–' : Math.round(ms)} ms · {dropped} lines dropped{edges && ` · routed in ${Math.round(edges.routeMs)} ms · drag frame ${edges.dragMs.toFixed(1)} ms · ${edges.unroutable} unroutable\n[avoid ${edges.avoidCrossings}] crossings ${edges.quality.crossings} (${edges.bridge}/${edges.tunnel}/${edges.portal} drawn, ${edges.skipped} no room) · overlapping ${edges.quality.overlaps} · doubling back ${edges.quality.doublingBack} · length/direct ${edges.quality.lengthRatio} · through blocks ${edges.quality.throughBlocks} / foreign trays ${edges.quality.throughTrays}${edges.routingError ? ` · ROUTING FELL BACK TO ELK: ${edges.routingError}` : ''}`}</span>
      </div>
      {warn && <div role="status" style={{ position: 'absolute', bottom: 34, left: '50%', maxWidth: '80%', pointerEvents: 'none', transform: 'translateX(-50%)', background: '#4a3a10', color: '#ffd479', padding: '6px 12px', borderRadius: 6, font: '12px monospace' }}>warning{warn.line ? ` (line ${warn.line})` : ''}: {warn.message}</div>}
      {edit && <textarea value={src} onChange={e => setSrc(e.target.value)} spellCheck={false}
        style={{ position: 'absolute', top: 88, left: 10, width: 360, height: '60%', background: '#10151f', color: '#cfd8ea', border: '1px solid #3a4560', font: '12px monospace' }} />}
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#556', fontSize: 11, pointerEvents: 'none' }}>drag node · drag bg pan (3d: orbit) · wheel zoom · click tray to fly in</div>
    </div>
  )
}

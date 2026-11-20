import { useEffect, useState } from 'react'
import { SAMPLES } from './samples'
import { Bonkei, THEME_NAMES, normaliseName, type StageLabelMode, type StageInfo } from 'bonkei'
import type { EdgeStats } from 'bonkei/internal'

// The site sits one level above the viewer (/app/ in dev, /merman/app/ on Pages).
const SITE = import.meta.env.BASE_URL.replace(/app\/$/, '')
// The theme menu: what the source's frontmatter asks for, each built-in theme, and a name nobody knows (drawn in Classic, with a warning).
const FROM_SOURCE = 'from source', UNKNOWN = 'nope (unknown name)'
const THEME_MENU = [FROM_SOURCE, ...THEME_NAMES, UNKNOWN]

const btn = (on: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #3a4560', background: on ? '#4b6bdc' : '#1a2030', color: '#fff', borderRadius: 5, cursor: 'pointer' })

export default function App() {
  // /app/?sample=stage: kitchen opens that sample first (a prefix of its name is enough)
  const first = Object.keys(SAMPLES).find(k => k.startsWith(new URLSearchParams(location.search).get('sample') ?? '\0')) ?? Object.keys(SAMPLES)[0]
  const [src, setSrc] = useState(SAMPLES[first])
  const [sel, setSel] = useState(first)
  const [debounced, setDebounced] = useState(src)
  const [labelMode, setLabelMode] = useState<StageLabelMode | typeof FROM_SOURCE>(FROM_SOURCE) // from source: the frontmatter's, else the default (a stage: sign)
  const [letters, setLetters] = useState<'stacked' | 'side'>('stacked')
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
  const [stage, setStage] = useState<StageInfo | null>(null) // the stage's parts, from onReady
  const [find, setFind] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(src), 250)
    return () => clearTimeout(t)
  }, [src])
  // The dropped count and the theme warning are per source.
  useEffect(() => { setDropped(0); setWarn(w => (w && w.line === 0 ? w : null)) }, [debounced])
  const wanted = normaliseName(find)
  const shown = stage?.parts.filter(p => !wanted || normaliseName(p.name).includes(wanted)) ?? []

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Bonkei source={debounced} labels={labelMode === FROM_SOURCE ? undefined : labelMode} letters={letters} theme={theme === FROM_SOURCE ? undefined : theme === UNKNOWN ? 'nope' : theme}
        crossingControls
        onReady={r => { setMs(r.layoutMs); setStage(r.stage ?? null) }}
        onError={() => setMs(null)}
        onEdgeStats={setEdges}
        onWarning={w => { if (w.kind === 'dropped') setDropped(n => n + 1); else if (w.kind === 'theme' || w.kind === 'stage') setWarn({ message: w.message, line: w.kind === 'stage' ? 0 : w.line }) }} />
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center', color: '#9aa6c0' }}>
        <a href={SITE} style={{ ...btn(false), textDecoration: 'none', font: 'inherit' }}>← Site</a>
        <select aria-label="Labels" value={labelMode} onChange={e => setLabelMode(e.target.value as StageLabelMode)} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{[FROM_SOURCE, 'top', 'billboard', 'base', 'sign', 'diamond', 'zone'].map(k => <option key={k} value={k}>labels: {k}</option>)}</select>
        <select value={sel} onChange={e => { setSel(e.target.value); setSrc(SAMPLES[e.target.value]) }} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{Object.keys(SAMPLES).map(k => <option key={k}>{k}</option>)}</select>
        <select aria-label="Letters" value={letters} onChange={e => setLetters(e.target.value as 'stacked' | 'side')} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{['stacked', 'side'].map(k => <option key={k} value={k}>letters: {k}</option>)}</select>
        <select aria-label="Theme" value={theme} onChange={e => { setTheme(e.target.value); setWarn(null) }} style={{ padding: 5, background: '#1a2030', color: '#fff', border: '1px solid #3a4560', borderRadius: 5 }}>{THEME_MENU.map(k => <option key={k}>{k}</option>)}</select>
        <button style={btn(edit)} onClick={() => setEdit(e => !e)}>source</button>
      </div>
      {/* the route quality readout: what the avoid-crossings setting and a drag do to the lines */}
      <div data-readout style={{ position: 'absolute', top: 48, left: 10, color: '#9aa6c0', font: '12px monospace', pointerEvents: 'none', whiteSpace: 'pre' }}>
        <span>{fps} fps · layout {ms === null ? '–' : Math.round(ms)} ms · {dropped} lines dropped{edges && ` · routed in ${Math.round(edges.routeMs)} ms · drag frame ${edges.dragMs.toFixed(1)} ms · ${edges.unroutable} unroutable\n[avoid ${edges.avoidCrossings}] crossings ${edges.quality.crossings} (${edges.bridge}/${edges.tunnel}/${edges.portal} drawn, ${edges.skipped} no room) · overlapping ${edges.quality.overlaps} · doubling back ${edges.quality.doublingBack} · length/direct ${edges.quality.lengthRatio} · through blocks ${edges.quality.throughBlocks} / foreign trays ${edges.quality.throughTrays}${edges.routingError ? ` · ROUTING FELL BACK TO ELK: ${edges.routingError}` : ''}`}</span>
      </div>
      {stage && (
        <div data-stage-parts style={{ position: 'absolute', top: 88, right: 10, width: 220, background: '#1a2030cc', border: '1px solid #3a4560', borderRadius: 6, padding: 8, color: '#cfd8ea', font: '12px system-ui, sans-serif' }}>
          <b>Stage parts</b> <span style={{ color: '#9aa6c0' }}>({stage.parts.length})</span>
          <input aria-label="Find a part" placeholder="find: Prep Line, prep_line…" value={find} onChange={e => setFind(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: '6px 0', padding: 4, background: '#10151f', color: '#cfd8ea', border: '1px solid #3a4560', borderRadius: 4 }} />
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {shown.map((p, i) => <li key={i} style={{ padding: '2px 0' }}>{p.name} <span style={{ color: '#9aa6c0' }}>· {p.pieces} {p.pieces === 1 ? 'piece' : 'pieces'}</span></li>)}
            {!shown.length && <li style={{ color: '#9aa6c0' }}>no part is called that</li>}
          </ul>
        </div>
      )}
      {warn && <div role="status" style={{ position: 'absolute', bottom: 34, left: '50%', maxWidth: '80%', pointerEvents: 'none', transform: 'translateX(-50%)', background: '#4a3a10', color: '#ffd479', padding: '6px 12px', borderRadius: 6, font: '12px monospace' }}>warning{warn.line ? ` (line ${warn.line})` : ''}: {warn.message}</div>}
      {edit && <textarea value={src} onChange={e => setSrc(e.target.value)} spellCheck={false}
        style={{ position: 'absolute', top: 88, left: 10, width: 360, height: '60%', background: '#10151f', color: '#cfd8ea', border: '1px solid #3a4560', font: '12px monospace' }} />}
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#556', fontSize: 11, pointerEvents: 'none' }}>drag node · drag bg moves (3d: turns) · ⇧ or right-drag swaps · pinch or ⌘/Ctrl + scroll zooms · click tray to fly in · ? for all gestures</div>
    </div>
  )
}

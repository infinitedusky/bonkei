import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { SceneView } from './SceneView'
import { createCamera, type Mode } from './camera'
import { S } from './shapes'
import { prepare, type Prepared } from './diagram'
import type { Graph } from './model'
import { mergeOptions, readFrontmatter, type BonkeiError, type BonkeiOptions } from './options'

export interface BonkeiProps extends BonkeiOptions {
  /** Mermaid source with optional frontmatter, or an already-built graph (then there is no frontmatter; use props). */
  source: string | Graph
}
/** What a mounted diagram lets you do from outside. */
export interface BonkeiViewHandle {
  setMode(mode: Mode): void
  /** Fit the whole diagram in view. */
  fit(): void
}

const C = { bg: '#0f1218', line: '#2a3348', text: '#cfd8ea', dim: '#7f8aa3', blue: '#4b6bdc', red: '#ff8a8a' }
const seg = (on: boolean): React.CSSProperties => ({
  padding: '3px 9px', border: 0, background: on ? C.blue : 'transparent', color: on ? '#fff' : C.text,
  font: '600 11px system-ui', borderRadius: 4, cursor: 'pointer',
})

function Toolbar({ mode, pick, fit }: { mode: Mode; pick: (m: Mode) => void; fit: () => void }) {
  return (
    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
      <div role="radiogroup" aria-label="View" style={{ display: 'flex', padding: 2, background: 'rgba(16,21,31,.85)', border: `1px solid ${C.line}`, borderRadius: 6 }}>
        {(['flat', 'iso', '3d'] as Mode[]).map(m => <button key={m} role="radio" aria-checked={mode === m} style={seg(mode === m)} onClick={() => pick(m)}>{m}</button>)}
      </div>
      <button title="Fit to view" aria-label="Fit to view" onClick={fit}
        style={{ ...seg(false), background: 'rgba(16,21,31,.85)', border: `1px solid ${C.line}`, borderRadius: 6, padding: '3px 8px' }}>⤢</button>
    </div>
  )
}

const where = (e: BonkeiError) => e.line !== undefined && <span style={{ color: C.dim }}>line {e.line}: </span>

function ErrorCard({ error }: { error: BonkeiError }) {
  return (
    <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ maxWidth: 420, border: '1px solid #5a2f36', background: '#1a1216', borderRadius: 8, padding: '12px 14px', color: C.text, font: '13px system-ui' }}>
        <div style={{ color: C.red, fontWeight: 600, marginBottom: 4 }}>This diagram couldn't be drawn</div>
        <div style={{ font: '12px ui-monospace, monospace', color: C.text }}>{where(error)}{error.message}</div>
      </div>
    </div>
  )
}

function ErrorStrip({ error }: { error: BonkeiError }) {
  return (
    <div role="alert" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, padding: '6px 10px', background: 'rgba(26,18,22,.92)', border: '1px solid #5a2f36', borderRadius: 6, color: C.text, font: '12px ui-monospace, monospace' }}>
      <span style={{ color: C.red }}>Not updated · </span>{where(error)}{error.message}
    </div>
  )
}

/**
 * A Mermaid diagram as a 3D scene. Fills the box it is placed in (give the parent a size).
 * Options come from `config.bonkei` in the source's frontmatter; props override them, key by key.
 */
export const Bonkei = forwardRef<BonkeiViewHandle, BonkeiProps>(function Bonkei({ source, mode: modeProp, labels, toolbar, controls, onError, onModeChange, onNodeClick, onReady }, ref) {
  const [camera] = useState(createCamera)
  const fm = useMemo(() => (typeof source === 'string' ? readFrontmatter(source).options : {}), [source])
  const opts = mergeOptions(fm, { mode: modeProp, labels, toolbar, controls })
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [error, setError] = useState<BonkeiError | null>(null)
  const [mode, setMode] = useState<Mode>(opts.mode)
  // Latest callbacks, so a new inline function each render doesn't re-run layout.
  const cb = useRef({ onError, onModeChange, onReady })
  cb.current = { onError, onModeChange, onReady }

  useEffect(() => {
    let alive = true
    setError(null)
    prepare(source).then(p => {
      if (!alive) return
      setPrepared(p); setError(null)
      p.warnings.forEach(w => cb.current.onError?.(w))
      cb.current.onReady?.(p.ready)
    }, (e: BonkeiError) => {
      if (!alive) return
      setError(e); cb.current.onError?.(e)
    })
    return () => { alive = false }
  }, [source])

  const pick = useCallback((m: Mode) => { setMode(m); camera.setMode(m); cb.current.onModeChange?.(m) }, [camera])
  const fit = useCallback(() => { const d = prepared?.data; if (d) camera.focusOn(0, 0, d.width * S, d.height * S) }, [camera, prepared])
  useImperativeHandle(ref, () => ({ setMode: pick, fit }), [pick, fit])
  // A new mode from props (or from the source's frontmatter) moves the view.
  useEffect(() => { setMode(m => (m === opts.mode ? m : (cb.current.onModeChange?.(opts.mode), opts.mode))) }, [opts.mode])

  const failedFirst = !!error && !prepared
  return (
    <div data-bonkei={failedFirst ? 'error' : prepared ? 'ready' : 'loading'}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, background: C.bg, borderRadius: 'inherit', overflow: 'hidden' }}>
      {!failedFirst && <SceneView data={prepared?.data ?? null} camera={camera} mode={mode} labelMode={opts.labels} showFps={false} controls={opts.controls} onNodeClick={onNodeClick} />}
      {!prepared && !error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: C.dim, font: '12px system-ui', pointerEvents: 'none' }}>Laying out…</div>}
      {failedFirst && <ErrorCard error={error} />}
      {error && prepared && <ErrorStrip error={error} />}
      {opts.toolbar && prepared && <Toolbar mode={mode} pick={pick} fit={fit} />}
    </div>
  )
})

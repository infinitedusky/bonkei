// <Bonkei />: a diagram in one component. Decisions: LOG.md, "The Bonkei component and render() (BON-51)".
import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type KeyboardEvent, type CSSProperties } from 'react'
import { SpanStatusCode } from '@opentelemetry/api'
import { SceneView } from './SceneView'
import { createCamera, type Mode } from './camera'
import { prepare, isBonkeiError, type Prepared, type PrepareError } from './diagram'
import { DEFAULTS, mergeOptions, resolveControls, type BonkeiError, type BonkeiOptions, type BonkeiWarning, type ModeChange, type NodeClick } from './options'
import type { GraphInput } from './model'
import { instant, tracer } from './telemetry'
import { UI } from './palette'

/** What a mounted view can be told to do. */
export interface BonkeiViewHandle {
  /** Move the view to a mode; fires `onModeChange` with source `handle`. */
  setMode(mode: Mode): void
  /** Frame the whole diagram again. */
  fit(): void
}

export type BonkeiProps = BonkeiOptions & {
  /** Mermaid text (frontmatter allowed) or a hand-built graph. A graph is compared by structure. */
  source: string | GraphInput
}

type Status = 'loading' | 'ready' | 'error'

// JSON with sorted keys, so two graphs with the same content give the same key.
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}'
}

const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e)
const where = (e: BonkeiError) => e.line !== undefined ? `line ${e.line}: ${e.message}` : e.message

const MODES: readonly { mode: Mode; label: string }[] = [{ mode: 'flat', label: 'Flat' }, { mode: 'iso', label: 'Iso' }, { mode: '3d', label: '3D' }]

const panel: CSSProperties = { background: UI.panel, color: UI.text, border: `1px solid ${UI.border}`, borderRadius: 6, font: '13px system-ui, sans-serif' }

/** Shown until the first layout. */
export function Loading() {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: UI.muted, font: '13px system-ui, sans-serif', pointerEvents: 'none' }}>Laying out…</div>
}

/** Nothing could be drawn. */
export function ErrorCard({ error }: { error: BonkeiError }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="alert" style={{ ...panel, padding: '14px 18px', maxWidth: 480 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>This diagram couldn't be drawn</div>
        <div style={{ color: UI.error, font: '12px ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{where(error)}</div>
      </div>
    </div>
  )
}

/** An update failed; the last diagram is still shown. */
export function ErrorStrip({ error }: { error: BonkeiError }) {
  return (
    <div role="status" style={{ ...panel, position: 'absolute', left: 10, right: 10, bottom: 10, padding: '6px 10px', font: '12px ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <span style={{ color: UI.error }}>Not updated</span> · {where(error)}
    </div>
  )
}

/** Flat / iso / 3D as a radiogroup, plus fit. */
export function Toolbar({ mode, onPick, onFit }: { mode: Mode; onPick: (m: Mode) => void; onFit: () => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const btn = (on: boolean): CSSProperties => ({
    padding: '4px 10px', border: 0, borderRadius: 4, cursor: 'pointer', font: '13px system-ui, sans-serif',
    background: on ? UI.on : 'transparent', color: UI.text,
  })
  const key = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = (MODES.findIndex(m => m.mode === mode) + step + MODES.length) % MODES.length
    onPick(MODES[i].mode)
    refs.current[i]?.focus()
  }
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
      <div role="radiogroup" aria-label="View" onKeyDown={key} style={{ ...panel, display: 'flex', padding: 2 }}>
        {MODES.map(({ mode: m, label }, i) => (
          <button key={m} ref={el => { refs.current[i] = el }} type="button" role="radio" aria-checked={m === mode}
            tabIndex={m === mode ? 0 : -1} onClick={() => onPick(m)} style={btn(m === mode)}>{label}</button>
        ))}
      </div>
      <button type="button" aria-label="Fit the diagram" onClick={onFit} style={{ ...panel, ...btn(false), border: `1px solid ${UI.border}`, background: UI.panel }}>Fit</button>
    </div>
  )
}

function webglMissing(): boolean {
  try { return document.createElement('canvas').getContext('webgl2') === null } catch { return true }
}

// Turns a crash while drawing (no WebGL, a renderer bug) into the error card and `onError`, so
// the host page keeps running. A new `resetKey` (a newly prepared source) tries again.
class SceneBoundary extends Component<{ resetKey: string; onError: (e: BonkeiError) => void; children: ReactNode }, { error: BonkeiError | null; key: string }> {
  state: { error: BonkeiError | null; key: string } = { error: null, key: this.props.resetKey }

  static getDerivedStateFromProps(p: { resetKey: string }, s: { key: string }) {
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null
  }

  static getDerivedStateFromError(e: unknown) {
    return { error: { kind: 'render', message: messageOf(e) } satisfies BonkeiError }
  }

  componentDidCatch(e: unknown) {
    const raw = messageOf(e)
    const cause = /webgl|context/i.test(raw) || webglMissing() ? 'webgl' : 'other'
    const error: BonkeiError = { kind: 'render', message: cause === 'webgl' ? `WebGL is unavailable (${raw})` : raw }
    const span = tracer.startSpan('bonkei.render_error', { attributes: { 'bonkei.render.cause': cause } })
    span.recordException(e instanceof Error ? e : raw)
    span.setStatus({ code: SpanStatusCode.ERROR, message: raw })
    span.end()
    this.setState({ error })
    this.props.onError(error)
  }

  render() {
    return this.state.error ? <ErrorCard error={this.state.error} /> : this.props.children
  }
}

export const Bonkei = forwardRef<BonkeiViewHandle, BonkeiProps>(function Bonkei(props, ref) {
  const { source } = props
  const [camera] = useState(createCamera)
  const [prepared, setPrepared] = useState<(Prepared & { key: string }) | null>(null)
  const [error, setError] = useState<BonkeiError | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [mode, setModeState] = useState<Mode>(() => props.mode ?? DEFAULTS.mode)

  // Callbacks are read through a ref: an inline handler must not cause a new layout.
  const cbs = useRef(props)
  cbs.current = props
  const modeRef = useRef(mode)
  const preparedRef = useRef(prepared)
  preparedRef.current = prepared
  const acceptedAt = useRef(0)

  // A string is its own key; a graph is keyed by structure, so an inline literal is stable.
  const key = useMemo(() => typeof source === 'string' ? 's:' + source : 'g:' + stableStringify(source), [source])
  const sourceRef = useRef(source)
  sourceRef.current = source
  const seq = useRef(0)

  useEffect(() => {
    const run = ++seq.current
    let alive = true
    const accepted = performance.now()
    setStatus('loading')
    prepare(sourceRef.current).then(p => {
      if (!alive || run !== seq.current) return
      acceptedAt.current = accepted
      setPrepared({ ...p, key })
      setError(null)
      for (const w of p.warnings) cbs.current.onWarning?.(w)
    }, (e: unknown) => {
      if (!alive || run !== seq.current) return
      const { warnings = [], ...err }: PrepareError = isBonkeiError(e)
        ? e as PrepareError
        : { kind: typeof sourceRef.current === 'string' ? 'parse' : 'graph', message: messageOf(e), warnings: [] }
      setError(err)
      setStatus('error')
      cbs.current.onError?.(err)
      for (const w of warnings as BonkeiWarning[]) cbs.current.onWarning?.(w)
    })
    return () => { alive = false }
  }, [key])

  // Props over frontmatter; the frontmatter is read once per prepared source.
  const ctlKey = JSON.stringify(props.controls ?? null)
  const opts = useMemo(
    () => mergeOptions({ mode: props.mode, labels: props.labels, toolbar: props.toolbar, controls: props.controls }, prepared?.options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode, props.labels, props.toolbar, ctlKey, prepared])
  const resolvedKey = JSON.stringify(resolveControls(opts.controls))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controls = useMemo(() => resolveControls(opts.controls), [resolvedKey])

  const picked = useRef(false) // a toolbar or handle pick has been made
  const pick = useCallback((m: Mode, from: ModeChange['source']) => {
    if (from !== 'prop') picked.current = true
    if (m === modeRef.current) return
    modeRef.current = m
    camera.setMode(m)
    setModeState(m)
    instant('bonkei.mode_change', { 'bonkei.mode': m, 'bonkei.mode.source': from })
    cbs.current.onModeChange?.(m, { source: from })
  }, [camera])

  // Semi-controlled mode: the declared mode (prop, else frontmatter) sets the first view, and a
  // change to it moves the view; toolbar and handle picks stay until the declared mode changes.
  const declared = opts.mode
  const prevMode = useRef<Mode | null>(null)
  useEffect(() => {
    if (!prepared) return // the frontmatter's mode is not known yet
    if (prevMode.current === null) {
      prevMode.current = declared
      // a handle pick made before the first layout is kept
      if (!picked.current && declared !== modeRef.current) { modeRef.current = declared; camera.setMode(declared); setModeState(declared) }
      return
    }
    if (prevMode.current === declared) return
    prevMode.current = declared
    pick(declared, 'prop')
  }, [declared, prepared, camera, pick])

  const fit = useCallback(() => {
    const p = preparedRef.current
    if (p) camera.fit(p.data.width, p.data.height)
  }, [camera])

  useImperativeHandle(ref, () => ({ setMode: m => pick(m, 'handle'), fit }), [pick, fit])

  const onFirstFrame = useCallback(() => {
    const p = preparedRef.current
    if (!p) return
    setStatus(s => s === 'loading' ? 'ready' : s)
    instant('bonkei.first_frame', {
      'bonkei.nodes': p.ready.nodes, 'bonkei.edges': p.ready.edges,
      'bonkei.dropped': p.ready.dropped, 'bonkei.layout_ms': p.ready.layoutMs,
    }, acceptedAt.current)
    cbs.current.onReady?.({ ...p.ready })
  }, [])

  const onNodeClick = useCallback((n: NodeClick) => {
    instant('bonkei.node_click', { 'bonkei.node.kind': n.kind })
    cbs.current.onNodeClick?.(n)
  }, [])

  const onRenderError = useCallback((e: BonkeiError) => {
    setStatus('error')
    cbs.current.onError?.(e)
  }, [])

  return (
    <div data-bonkei={status} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <SceneBoundary resetKey={prepared?.key ?? ''} onError={onRenderError}>
        <SceneView data={prepared?.data ?? null} labelMode={opts.labels} mode={mode} camera={camera} showFps={false}
          controls={controls} onNodeClick={onNodeClick} hasClick={!!props.onNodeClick} onFirstFrame={onFirstFrame} />
        {prepared && opts.toolbar && <Toolbar mode={mode} onPick={m => pick(m, 'toolbar')} onFit={fit} />}
      </SceneBoundary>
      {!prepared && !error && <Loading />}
      {!prepared && error && <ErrorCard error={error} />}
      {prepared && error && <ErrorStrip error={error} />}
    </div>
  )
})

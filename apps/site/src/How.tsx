import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import sample from './sample.mmd?raw'
import { probeGate, startOf, stillNote, type Gate } from './howGate'
import { track } from './track'

// The scene (three, ELK, the viewer) is its own chunk, fetched when the section comes near the screen. This file,
// like Hero.tsx and Themes.tsx, has no value import of the scene: Home's entry chunk stays as small as it was.
const HowScene = lazy(() => import('./HowScene'))
// Stories only (failLoad): a chunk that does not load, as a dropped connection or a deploy mid-visit does.
const NoScene = lazy(() => Promise.reject(new Error('the scene chunk did not load')))
// Stories only (holdLoad): a chunk still on its way, to show the loading state.
const SlowScene = lazy(() => new Promise<never>(() => {}))

// The scene's chunk failing to load (or the scene throwing while it renders) would otherwise unmount the whole page:
// this turns it into `onFailed`, and How shows the source and the still.
class SceneBoundary extends Component<{ onFailed: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { this.props.onFailed(e instanceof Error ? e.message : String(e)) }
  render() { return this.state.failed ? null : this.props.children }
}

const START = startOf(sample)
const BASE = import.meta.env.BASE_URL

// The source and the still: on a phone, without WebGL 2, or if the scene fails (not while it loads: that is the Shell).
// The still is captured at 2x (scripts/capture-stills.mjs), so it is sharp on a retina screen.
function Fallback({ flash }: { flash: boolean }) {
  const [all, setAll] = useState(false) // phone: the source starts as a few lines
  return (
    <div className={'site-split' + (flash ? ' flash' : '')}>
      <div className="site-src">
        <pre className={all ? '' : 'clamp'}>{START}</pre>
        <button type="button" className="site-srcmore" onClick={() => setAll(v => !v)}>{all ? 'Show less' : 'Show all'}</button>
      </div>
      <img className="site-still" src={BASE + 'still-iso.png'} width={800} height={500} loading="lazy"
        alt="The flowchart from the source beside it, rendered isometrically" />
    </div>
  )
}

// What a desktop shows until the scene has drawn (BON-209): the live section's own frame, with no picture: the editor's
// bar and the source (read-only until the scene's chunk is in) and an empty stage of the scene's size, so nothing moves
// when the scene arrives. It is plain markup, so it needs nothing from the scene's chunk.
function Shell({ flash }: { flash: boolean }) {
  return (
    <div className={'site-split' + (flash ? ' flash' : '')}>
      <div className="how-ed">
        <div className="how-bar"><b>Mermaid</b><span>edit me</span><button type="button" disabled>Reset</button></div>
        <textarea aria-label="Mermaid source of the diagram beside it" readOnly spellCheck={false} value={START} />
        <div className="how-msg" role="status" />
      </div>
      <div className="how-scene" />
    </div>
  )
}

const Note = ({ children }: { children: ReactNode }) => <div className="site-note">{children}</div>

// The home page's "Keep the text. Get the scene." section body (BON-189): an editable Mermaid source beside the live
// scene, mounted when the section comes within 400px of the screen. `live`: true forces the scene (stories), false the
// still (for the reason `fallback`, default phone), unset uses the hero's gate (desktop, fine pointer, WebGL 2).
// `initial` opens the editor on other text (stories); `failLoad` makes the scene's chunk fail to load (stories).
export function How({ live, fallback = 'phone', flash = false, initial, failLoad = false, holdLoad = false }: { holdLoad?: boolean; live?: boolean; fallback?: Exclude<Gate, 'live'>; flash?: boolean; initial?: string; failLoad?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [gate, setGate] = useState<Gate | null>(live === undefined ? null : live ? 'live' : fallback)
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)
  const decidedAt = useRef(0)

  useEffect(() => {
    decidedAt.current = performance.now()
    if (live !== undefined) { setGate(live ? 'live' : fallback); return }
    const g = probeGate()
    setGate(g)
    if (g !== 'live') track('site.how.fallback', { 'site.how.reason': g })
  }, [live, fallback])

  useEffect(() => {
    const el = root.current
    if (!el || gate !== 'live') return
    if (live === true || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect() } }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [gate, live])

  const isLive = gate === 'live' && !failed
  const Scene = failLoad ? NoScene : holdLoad ? SlowScene : HowScene
  const loadFailed = (message: string) => {
    track('site.how.fallback', { 'site.how.reason': 'load-error' }, message)
    setFailed(true)
  }
  // Undecided (before the gate has run) paints nothing; live paints the shell, never the still; the still is only for
  // the fallbacks (phone, no WebGL 2, the chunk or the scene failing).
  return (
    <div ref={root}>
      {gate === null ? <div style={{ minHeight: 460 }} />
        : !isLive ? <Fallback flash={flash} />
        : near
          ? <SceneBoundary onFailed={loadFailed}>
              <Suspense fallback={<Shell flash={flash} />}><Scene start={START} initial={initial} flash={flash} decidedAt={decidedAt.current} onFailed={() => setFailed(true)} /></Suspense>
            </SceneBoundary>
          : <Shell flash={flash} />}
      <Note>{isLive
        ? <>Try it: rename a node, or add a line like <code>UI --&gt; REST</code></>
        : stillNote(gate, failed)}</Note>
    </div>
  )
}

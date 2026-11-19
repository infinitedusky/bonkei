import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import sample from './sample.mmd?raw'
import { probeGate, startOf, stillNote, type Gate } from './howGate'
import { track } from './track'

// The scene (three, ELK, the viewer) is its own chunk, fetched when the section comes near the screen. This file,
// like Hero.tsx and Themes.tsx, has no value import of the scene: Home's entry chunk stays as small as it was.
const HowScene = lazy(() => import('./HowScene'))
// Stories only (failLoad): a chunk that does not load, as a dropped connection or a deploy mid-visit does.
const NoScene = lazy(() => Promise.reject(new Error('the scene chunk did not load')))

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

// The source and the still: on a phone, without WebGL 2, while the scene's chunk loads, or if the scene fails.
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

const Note = ({ children }: { children: ReactNode }) => <div className="site-note">{children}</div>

// The home page's "Keep the text. Get the scene." section body (BON-189): an editable Mermaid source beside the live
// scene, mounted when the section comes within 400px of the screen. `live`: true forces the scene (stories), false the
// still (for the reason `fallback`, default phone), unset uses the hero's gate (desktop, fine pointer, WebGL 2).
// `initial` opens the editor on other text (stories); `failLoad` makes the scene's chunk fail to load (stories).
export function How({ live, fallback = 'phone', flash = false, initial, failLoad = false }: { live?: boolean; fallback?: Exclude<Gate, 'live'>; flash?: boolean; initial?: string; failLoad?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [gate, setGate] = useState<Gate | null>(live === undefined ? null : live ? 'live' : fallback)
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
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
  const Scene = failLoad ? NoScene : HowScene
  const loadFailed = (message: string) => {
    track('site.how.fallback', { 'site.how.reason': 'load-error' }, message)
    setFailed(true)
  }
  return (
    <div ref={root}>
      {isLive && near
        ? <SceneBoundary onFailed={loadFailed}>
            <Suspense fallback={<Fallback flash={flash} />}><Scene start={START} initial={initial} flash={flash} onFailed={() => setFailed(true)} /></Suspense>
          </SceneBoundary>
        : <Fallback flash={flash} />}
      <Note>{isLive
        ? <>Try it: rename a node, or add a line like <code>UI --&gt; REST</code></>
        : stillNote(gate, failed)}</Note>
    </div>
  )
}

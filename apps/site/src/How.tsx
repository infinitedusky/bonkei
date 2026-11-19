import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import sample from './sample.mmd?raw'
import { probeGate, startOf, type Gate } from './howGate'
import { track } from './track'

// The scene (three, ELK, the viewer) is its own chunk, fetched when the section comes near the screen. This file,
// like Hero.tsx and Themes.tsx, has no value import of the scene: Home's entry chunk stays as small as it was.
const HowScene = lazy(() => import('./HowScene'))

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
// still, unset uses the hero's gate (desktop, fine pointer, WebGL 2). `initial` opens the editor on other text (stories).
export function How({ live, flash = false, initial }: { live?: boolean; flash?: boolean; initial?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [gate, setGate] = useState<Gate | null>(live === undefined ? null : live ? 'live' : 'phone')
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (live !== undefined) { setGate(live ? 'live' : 'phone'); return }
    const g = probeGate()
    setGate(g)
    if (g !== 'live') track('site.how.fallback', { 'site.how.reason': g })
  }, [live])

  useEffect(() => {
    const el = root.current
    if (!el || gate !== 'live') return
    if (live === true || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect() } }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [gate, live])

  const isLive = gate === 'live' && !failed
  return (
    <div ref={root}>
      {isLive && near
        ? <Suspense fallback={<Fallback flash={flash} />}><HowScene start={START} initial={initial} flash={flash} onFailed={() => setFailed(true)} /></Suspense>
        : <Fallback flash={flash} />}
      <Note>{isLive
        ? <>Try it: rename a node, or add a line like <code>UI --&gt; REST</code></>
        : 'Edit the source, and the scene re-lays itself out as you type. Try it live on a desktop.'}</Note>
    </div>
  )
}

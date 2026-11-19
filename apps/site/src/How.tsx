import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import sample from './sample.mmd?raw'
import { howShows, probeGate, startOf, stillNote, type Gate } from './howGate'
import { SceneBoundary } from './SceneBoundary'
import { track } from './track'

// The scene (three, ELK, the viewer) is its own chunk, fetched when the section comes near the screen. This file,
// like Hero.tsx and Themes.tsx, has no value import of the scene: Home's entry chunk stays as small as it was.
const HowScene = lazy(() => import('./HowScene'))
// Stories only (failLoad): a chunk that does not load, as a dropped connection or a deploy mid-visit does.
const NoScene = lazy(() => Promise.reject(new Error('the scene chunk did not load')))
// Stories only (holdLoad): a chunk still on its way, to show what a desktop sees while it loads.
const SlowScene = lazy(() => new Promise<never>(() => {}))

// Fetch the scene's chunk once the page is idle (BON-209), so the section rarely waits on it when it is scrolled to;
// mounting it still waits for the section to come near the screen. The chunk shares the Bonkei chunk with the hero.
function prefetchWhenIdle(load: () => Promise<unknown>) {
  const run = () => { load().catch(() => {}) } // a failure shows (as the still) when the section mounts it
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

const START = startOf(sample)
const BASE = import.meta.env.BASE_URL

// The source and the still: on a phone, without WebGL 2, or if the scene fails; never while it loads (that is the Shell).
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

// What a desktop shows until the scene has drawn (BON-209): the live section's own frame and no picture: the editor's bar,
// the source (read-only until the scene's chunk is in) and an empty stage of the scene's size (.how-scene), so nothing
// below moves when the scene arrives. Plain markup: it needs nothing from the scene's chunk.
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
// still (for the reason `fallback`, default phone), unset uses the hero's gate (desktop, fine pointer, WebGL 2), decided
// on the first render. What it paints is howShows() (howGate.ts): on a desktop the Shell, then the scene fading in, and
// never the still first (BON-209). `initial` opens the editor on other text (stories); `failLoad` makes the scene's chunk
// fail to load and `holdLoad` keeps it loading (stories).
export function How({ live, fallback = 'phone', flash = false, initial, failLoad = false, holdLoad = false }: { live?: boolean; fallback?: Exclude<Gate, 'live'>; flash?: boolean; initial?: string; failLoad?: boolean; holdLoad?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const gate = useMemo<Gate>(() => live === undefined ? probeGate() : live ? 'live' : fallback, [live, fallback])
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)
  const decidedAt = useRef(performance.now())

  useEffect(() => {
    if (live === undefined && gate !== 'live') track('site.how.fallback', { 'site.how.reason': gate })
  }, [live, gate])

  useEffect(() => {
    const el = root.current
    if (!el || gate !== 'live') return
    if (!failLoad && !holdLoad) prefetchWhenIdle(() => import('./HowScene'))
    if (live === true || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect() } }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [gate, live, failLoad, holdLoad])

  const shows = howShows(gate, failed, near)
  const Scene = failLoad ? NoScene : holdLoad ? SlowScene : HowScene
  const loadFailed = (message: string) => {
    track('site.how.fallback', { 'site.how.reason': 'load-error' }, message)
    setFailed(true)
  }
  return (
    <div ref={root}>
      {shows === 'still' ? <Fallback flash={flash} />
        : shows === 'shell' ? <Shell flash={flash} />
        : <SceneBoundary onFailed={loadFailed}>
            <Suspense fallback={<Shell flash={flash} />}>
              <Scene start={START} initial={initial} flash={flash} decidedAt={decidedAt.current} onFailed={() => setFailed(true)} />
            </Suspense>
          </SceneBoundary>}
      <Note>{shows !== 'still'
        ? <>Try it: rename a node, or add a line like <code>UI --&gt; REST</code></>
        : stillNote(gate, failed)}</Note>
    </div>
  )
}

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { track } from './track'
import sample from './sample.mmd?raw'
import { Hero } from './Hero'
import { Logo } from './Marks'
import { Themes } from './Themes'
// headings in Zen Old Mincho (SIL OFL), served with the site: the Latin subsets only
import '@fontsource/zen-old-mincho/latin-400.css'
import '@fontsource/zen-old-mincho/latin-700.css'
import '@fontsource/zen-old-mincho/latin-900.css'
import './site.css'

const FIRST_ISSUES = [
  'Edges that cross subgraphs on big diagrams',
  'Readable edge labels at every zoom',
  'True orthographic camera for flat / iso',
  'More Mermaid shapes, classDef / style',
  'Export to PNG / GLB',
]

// The section's scene is its own chunk, fetched when the section nears the screen.
const HowScene = lazy(() => import('./HowScene'))

// Same gate as the hero: not a narrow screen, not touch-first, and a webgl2 context exists.
function canGoLive() {
  if (typeof matchMedia !== 'function') return false
  if (matchMedia('(max-width:760px)').matches || matchMedia('(pointer:coarse)').matches) return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

const START = sample.replace(/^%%.*\n/, '')

// The editable source and live scene, mounted when the section comes near the screen. Without the gate
// (phone, no WebGL 2) or if the scene fails on the sample, it shows the source and a sharp still.
function How({ live, flash }: { live?: boolean; flash: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [gate, setGate] = useState<boolean | null>(live ?? null)
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)
  const [srcAll, setSrcAll] = useState(false) // phone: the source starts as a few lines

  useEffect(() => {
    if (live !== undefined) { setGate(live); return }
    const ok = canGoLive()
    setGate(ok)
    if (!ok) track('how.fallback', { reason: matchMedia('(max-width:760px)').matches || matchMedia('(pointer:coarse)').matches ? 'phone' : 'no-webgl2' })
  }, [live])

  useEffect(() => {
    const el = root.current
    if (!el || !gate) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect() } }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [gate])

  const fallback = (
    <div className={'site-split' + (flash ? ' flash' : '')}>
      <div className="site-src">
        <pre className={srcAll ? '' : 'clamp'}>{START}</pre>
        <button type="button" className="site-srcmore" onClick={() => setSrcAll(v => !v)}>{srcAll ? 'Show less' : 'Show all'}</button>
      </div>
      <Still src="still-iso.png" alt="The flowchart from the source beside it, rendered isometrically" />
    </div>
  )
  const isLive = !!gate && !failed
  return (
    <div ref={root}>
      {isLive && near ? (
        <div className={flash ? 'flash-wrap' : ''}>
          <Suspense fallback={fallback}>
            <HowScene start={START} onReady={() => track('how.mounted')} onFailed={() => { setFailed(true); track('how.fallback', { reason: 'scene-error' }) }} />
          </Suspense>
        </div>
      ) : fallback}
      <div className="site-note">{isLive ? 'Try it: rename a node, or add a line like  UI --> REST' : 'Edit the source, and the scene re-lays itself out as you type. Try it live on a desktop.'}</div>
    </div>
  )
}

const BASE = import.meta.env.BASE_URL
const GH = 'https://github.com/infinitedusky/bonkei'

const Ctas = () => (
  <div className="site-ctas">
    <a className="site-btn primary" href={BASE + 'app/'}>Try it live →</a>
    <a className="site-btn" href={GH}>View on GitHub</a>
  </div>
)

const Still = ({ src, alt }: { src: string; alt: string }) => (
  <img className="site-still" src={BASE + src} width={800} height={500} alt={alt} loading="lazy" />
)

// The marketing site's one page, in the brand drawn from the bonkei prints: cream paper, ink, serif headings, the
// tray-landscape logo. The hero stays in the Classic look. `live`: true forces the live hero, false the poster, unset
// auto-detects; `themesLive` the same for the Themes section's scene (unset: when it comes near the screen, with WebGL).
// Keep this file free of static imports of the scene (SceneView, camera, layout, three): Hero and Themes lazy-load it.
export function Home({ name = 'Bonkei', live, themesLive, howLive }: { name?: string; live?: boolean; themesLive?: boolean; howLive?: boolean }) {
  const [showSrc, setShowSrc] = useState(false)
  return (
    <div className="site">
      <div className="site-wrap">
        <nav className="site-nav">
          <a className="site-logo" href="#"><Logo size={40} title={name} />{name}</a>
          <div className="site-links">
            <a href={BASE + "docs/"}>Docs</a>
            <a href="#how">How it works</a>
            <a href="#views">Views</a>
            <a href="#themes">Themes</a>
            <a href="#sequence">Sequence</a>
            <a href="#status">Status</a>
            <a className="gh" href={GH}>GitHub</a>
          </div>
        </nav>

        <header className="site-hero">
          <div className="site-eyebrow">Open source · MIT · early prototype</div>
          <h1>Your Mermaid diagrams,<br />as a scene you can fly through.</h1>
          <p className="site-sub">Paste the flowchart or sequence diagram you already have. {name} lays it out and shows it flat, isometric or in 3D, with nothing to redraw.</p>
          <Ctas />
          <div className="site-hint">Runs in your browser. Best on desktop.</div>
          <div className="site-hero-stage">
            <Hero live={live} source={sample} onSource={() => { setShowSrc(true); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }) }} />
            <a className="site-try" href="#themes">try a theme ↓</a>
          </div>
        </header>

        <div className="site-proof">
          <span>flowcharts</span><span>·</span><span>sequence diagrams</span><span>·</span><span>themes</span><span>·</span><span>Three.js + ELK</span><span>·</span><span>no account, no upload</span>
        </div>

        <section id="how">
          <h2>Keep the text. Get the scene.</h2>
          <p className="site-lead">Your diagrams already live in READMEs and docs as Mermaid. You don't have to move them into a drawing tool: the same text becomes a 3D scene.</p>
          <How live={howLive ?? live} flash={showSrc} />
        </section>

        <section id="views">
          <h2>One scene, three ways to look at it</h2>
          <p className="site-lead">The camera animates between views, so you keep your place.</p>
          <div className="site-cards">
            <div className="site-card"><Still src="still-flat.png" alt="The flowchart seen flat, from above" /><h3>Flat</h3><p>It reads like the Mermaid you know, for docs and screenshots.</p></div>
            <div className="site-card"><Still src="still-iso.png" alt="The flowchart seen isometrically, with subgraphs as trays" /><h3>Isometric</h3><p>Subgraphs become trays and nodes have depth, so you see the structure at a glance.</p></div>
            <div className="site-card"><Still src="still-3d.png" alt="The flowchart in perspective 3D" /><h3>3D</h3><p>Turn, tilt, zoom and fly into a subgraph to walk through a big system.</p></div>
          </div>
        </section>

        <section id="themes">
          <h2>Use themes to see how far you can go</h2>
          <p className="site-lead">The same diagram, the same layout, a different world. Pick a built-in theme, or override one setting for one diagram. A diagram names its theme in its own frontmatter.</p>
          <Themes live={themesLive} />
        </section>

        <section id="sequence">
          <div className="site-seq">
            <Still src="still-seq.png" alt="A login sequence diagram in 3D: lifelines on the ground, messages as arrows between them" />
            <div>
              <h2>Sequence diagrams too</h2>
              <p className="site-lead">Lifelines lie on the ground, and messages run between them in order.</p>
              <p className="site-lead">loop, alt, opt and par blocks become trays you can see at a glance.</p>
            </div>
          </div>
        </section>

        <section id="status">
          <div className="site-status">
            <div>
              <span className="site-tag">Status: prototype</span>
              <h2>Early, and honest about it</h2>
              <p>It works on the samples. There are rough edges on large diagrams and no tests yet. If you want to help, these are good first issues:</p>
            </div>
            <ul>
              {FIRST_ISSUES.map(t => <li key={t}>{t}</li>)}
              <li><a href={GH + '/blob/main/CONTRIBUTING.md'}>See the full list in CONTRIBUTING →</a></li>
            </ul>
          </div>
        </section>

        <section className="site-final">
          <h2>Paste a diagram and see it in 3D.</h2>
          <p className="site-lead">Nothing to install. Or run it yourself:</p>
          <pre>{`git clone ${GH}\npnpm install && pnpm dev`}</pre>
          <Ctas />
        </section>

        <footer className="site-footer">
          <Logo size={44} title={name} />
          <span>{name} · MIT</span><a href={GH}>GitHub</a><a href={GH + '/blob/main/CONTRIBUTING.md'}>Contributing</a>
          <span className="r">Built with Mermaid syntax, ELK and Three.js. Not affiliated with Mermaid.</span>
        </footer>
      </div>
    </div>
  )
}

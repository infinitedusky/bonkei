import { useState } from 'react'
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
export function Home({ name = 'Bonkei', live, themesLive }: { name?: string; live?: boolean; themesLive?: boolean }) {
  const [showSrc, setShowSrc] = useState(false)
  const [srcAll, setSrcAll] = useState(false) // phone: the source starts as a few lines
  return (
    <div className="site">
      <div className="site-wrap">
        <nav className="site-nav">
          <a className="site-logo" href="#"><Logo size={40} title={name} />{name}</a>
          <div className="site-links">
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
          <div className={'site-split' + (showSrc ? ' flash' : '')}>
            <div className="site-src">
              <pre className={srcAll ? '' : 'clamp'}>{sample.replace(/^%%.*\n/, '')}</pre>
              <button type="button" className="site-srcmore" onClick={() => setSrcAll(v => !v)}>{srcAll ? 'Show less' : 'Show all'}</button>
            </div>
            <Still src="still-iso.png" alt="The flowchart from the source beside it, rendered isometrically" />
          </div>
          <div className="site-note">Edit the source, and the scene re-lays itself out as you type.</div>
        </section>

        <section id="views">
          <h2>One scene, three ways to look at it</h2>
          <p className="site-lead">The camera animates between views, so you keep your place.</p>
          <div className="site-cards">
            <div className="site-card"><Still src="still-flat.png" alt="The flowchart seen flat, from above" /><h3>Flat</h3><p>It reads like the Mermaid you know, for docs and screenshots.</p></div>
            <div className="site-card"><Still src="still-iso.png" alt="The flowchart seen isometrically, with subgraphs as trays" /><h3>Isometric</h3><p>Subgraphs become trays and nodes have depth, so you see the structure at a glance.</p></div>
            <div className="site-card"><Still src="still-3d.png" alt="The flowchart in perspective 3D" /><h3>3D</h3><p>Orbit, zoom and fly into a subgraph to walk through a big system.</p></div>
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

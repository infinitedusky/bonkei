// Mockups of the docs site (BON-127), from sketches/docs-*.html: VitePress's default layout in the bonkei.dev brand, light only.
// The diagrams are the real <Bonkei />, as the VitePress plugin draws them. Every diagram and page here is MADE-UP SAMPLE DATA.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactNode } from 'react'
import { Bonkei, type BonkeiOptions } from 'bonkei'
import './docs-mockup.css'

const meta: Meta = { title: 'Mockups/Docs', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj
const at = (value: string) => ({ viewport: { value, isRotated: false } })

// ---- Sample data (made up) ----
const HERO = `flowchart LR
  Write[Write mermaid] --> Parse(Parse) --> Lay[Lay out in trays] --> Draw[Draw the scene]`
const CROSSING = `flowchart LR
  subgraph Sample[Sample app]
    Client[Client] --> DB[(Database)]
    API(API) --> Cache{Cache}
    Client --> API
    Cache --> DB
  end`
const RENDER = `flowchart LR
  Build[Build] --> Test(Test) --> Ship[Ship]`
const CROSSING_SOURCE = `---
config:
  bonkei:
    crossings: bridge
    avoidCrossings: some
---
${CROSSING}`

// ---- The live diagram, as the plugin draws it: a box of the page's height, Bonkei inside ----
function Diagram({ source, small, ...options }: { source: string; small?: boolean } & BonkeiOptions) {
  return <div className={'docs-diagram' + (small ? ' small' : '')}><Bonkei source={source} theme="bonkei" {...options} /></div>
}

// ---- The chrome: the docs' bar, the Menu / On this page bar, the sidebar and the outline ----
function Bar({ on }: { on?: 'guide' | 'api' }) {
  return (
    <header className="docs-bar">
      <a className="docs-logo" href="#"><i />Bonkei <small>docs</small></a>
      <div className="docs-search">Search docs… ⌘K</div>
      <nav className="docs-nav">
        <a className={on === 'guide' ? 'on' : ''} href="#">Guide</a>
        <a className={on === 'api' ? 'on' : ''} href="#">API</a>
        <a href="#">bonkei.dev ↗</a><a href="#">Viewer ↗</a><a href="#">GitHub</a>
      </nav>
      <div className="docs-icons"><span>⌕</span><span>☰</span></div>
    </header>
  )
}
const GUIDE = [
  ['Getting started', ['Introduction', 'React', 'Plain JavaScript', 'Script tag', 'VitePress']],
  ['Writing diagrams', ['Diagram types', 'Options and frontmatter', "The reader's controls", 'Edge styles', 'Themes', 'Errors and warnings']],
  ['Reference', ['API', 'Script tag element', 'VitePress plugin']],
] as const
const API = [
  ['Components and mounting', ['Bonkei', 'render']],
  ['Props, options, handles', ['BonkeiProps', 'BonkeiOptions', 'DiagramOptions', 'Controls', 'BonkeiHandle', 'BonkeiViewHandle']],
  ['Themes', ['Theme', 'CLASSIC', 'BONKEI', 'BONKEI_LANDSCAPE', 'THEME_NAMES']],
  ['Events', ['BonkeiError', 'BonkeiWarning', 'NodeClick', 'ReadyInfo', 'isBonkeiError']],
  ['Modes, labels, lines', ['Mode', 'LabelMode', 'CrossingStyle', 'AvoidCrossings']],
  ['Hand-built graphs', ['GraphInput', 'Graph', 'GNode', 'GGroup', 'GEdge', 'Shape', 'Dropped']],
  ['Script tag', ['<bonkei-diagram>', 'Bonkei.run']],
  ['VitePress plugin', ['bonkeiMarkdown', 'enhanceAppWithBonkei']],
] as const
function Side({ groups, on, mono }: { groups: typeof GUIDE | typeof API; on: string; mono?: boolean }) {
  return (
    <aside className={'docs-side' + (mono ? ' mono' : '')}>
      {groups.map(([h, links]) => <div key={h}><h4>{h}</h4>{links.map(l => <a key={l} href="#" className={l === on ? 'on' : ''}>{l}</a>)}</div>)}
    </aside>
  )
}
function DocPage({ side, toc, children, on }: { side: ReactNode; toc?: string[]; children: ReactNode; on: 'guide' | 'api' }) {
  return (
    <div className="docs">
      <div className="sample">Mockup, sample data. The docs at bonkei.dev/docs/; diagrams are live.</div>
      <Bar on={on} />
      <div className="docs-local"><span className="menu">☰ Menu</span>{toc && <span>On this page ›</span>}</div>
      <div className={'docs-wrap' + (toc ? '' : ' no-toc')}>
        {side}
        <main className="docs-main">{children}</main>
        {toc && <aside className="docs-toc"><b>On this page</b>{toc.map((t, i) => <a key={t} href="#" className={i === 0 ? 'on' : ''}>{t}</a>)}</aside>}
      </div>
    </div>
  )
}

// A sample in tabs: Markdown, React and Script tag on every one (the person's choice, 2026-11-17).
function Tabs({ markdown, react, html }: { markdown: string; react: string; html: string }) {
  const [tab, setTab] = useState<'Markdown' | 'React' | 'Script tag'>('Markdown')
  const body = { Markdown: markdown, React: react, 'Script tag': html }[tab]
  return (
    <>
      <div className="docs-tabs">{(['Markdown', 'React', 'Script tag'] as const).map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      <pre>{body}</pre>
    </>
  )
}

// ---- The pages ----
function FeaturePage() {
  return (
    <DocPage on="guide" side={<Side groups={GUIDE} on="Edge styles" />} toc={['Crossings', 'Avoiding crossings', 'From code', 'Letting the reader choose']}>
      <h1>Edge styles</h1>
      <p className="lead">How Bonkei draws two lines that cross, and how hard it tries to keep them apart.</p>
      <Diagram source={CROSSING_SOURCE} />
      <div className="live">Live: drawn by Bonkei from the source below. Drag to turn it; Flat / Iso / 3D switch the view.</div>
      <Tabs
        markdown={'```mermaid\n' + CROSSING_SOURCE + '\n```'}
        react={`import { Bonkei } from 'bonkei'\n\n<Bonkei source={source} crossings="bridge" avoidCrossings="some" />`}
        html={`<script src="bonkei.global.js"></script>\n\n<bonkei-diagram>\n  ---\n  config:\n    bonkei:\n      crossings: bridge\n  ---\n  flowchart LR\n    Client --> Database\n</bonkei-diagram>`}
      />

      <h2>Crossings</h2>
      <p>When two lines must cross, <code>crossings</code> says how the crossing is drawn. The default is <code>none</code>.</p>
      <div className="docs-values">
        {(['none', 'bridge', 'tunnel', 'portal'] as const).map(c => (
          <figure key={c}><Diagram small source={CROSSING} crossings={c} mode="flat" toolbar={false} /><figcaption>{c}</figcaption></figure>
        ))}
      </div>
      <div className="live">Four live diagrams: the same source, one value each.</div>

      <h2>Avoiding crossings</h2>
      <p><code>avoidCrossings</code> sets how hard the router keeps lines apart: <code>off</code>, <code>some</code> (default) or <code>strong</code>. Stronger costs routing time when the diagram first draws.</p>
      <div className="docs-table"><table>
        <tbody>
          <tr><th>Option</th><th>Values</th><th>Default</th><th>Frontmatter</th></tr>
          <tr><td><code>crossings</code></td><td>none · bridge · tunnel · portal</td><td>none</td><td><code>config.bonkei.crossings</code></td></tr>
          <tr><td><code>avoidCrossings</code></td><td>off · some · strong</td><td>some</td><td><code>config.bonkei.avoidCrossings</code></td></tr>
          <tr><td><code>crossingControls</code></td><td>true · false</td><td>false</td><td><code>config.bonkei.crossingControls</code></td></tr>
        </tbody>
      </table></div>

      <h2>From code</h2>
      <pre className="solo">{`import { render } from 'bonkei'\n\nrender(el, source, { `}<span className="hover">crossings</span>{`: 'tunnel', avoidCrossings: 'strong' })`}</pre>
      <div className="twoslash">(property) crossings?: CrossingStyle — 'none' | 'bridge' | 'tunnel' | 'portal'</div>
      <div className="live">Type-checked against the installed package when the docs build: a renamed option fails the build.</div>

      <h2>Letting the reader choose</h2>
      <p>The toolbar shows the view and Fit. Set <code>crossingControls: true</code> to add the crossing groups.</p>
      <Diagram source={CROSSING} crossingControls />

      <div className="docs-pager"><a href="#"><small>Previous</small>The reader's controls</a><a href="#"><small>Next</small>Themes</a></div>
      <div className="foot">Edit this page on GitHub · <a href="#">CrossingStyle</a> in the API</div>
    </DocPage>
  )
}

function ApiPage() {
  return (
    <DocPage on="api" side={<Side groups={API} on="render" mono />}>
      <div className="kind">Function · from <code>bonkei</code></div>
      <h1 className="mono">render()</h1>
      <p>Mount a diagram into any DOM element without touching React; returns a handle.</p>
      <pre className="solo">{'function render(el: HTMLElement, source: string | GraphInput, options?: BonkeiOptions): BonkeiHandle'}</pre>
      <h2>Parameters</h2>
      <table className="stack"><tbody>
        <tr><th>Name</th><th>Type</th><th>Description</th></tr>
        <tr><td><code>el</code></td><td><code>HTMLElement</code></td><td>The element to draw in. The diagram fills it.</td></tr>
        <tr><td><code>source</code></td><td><code>string</code> | <a href="#">GraphInput</a></td><td>Mermaid text, or a graph built by hand.</td></tr>
        <tr><td><code>options</code></td><td><a href="#">BonkeiOptions</a></td><td>Diagram options and callbacks. Options here win over the diagram's frontmatter.</td></tr>
      </tbody></table>
      <h2>Returns</h2>
      <p><a href="#" style={{ color: 'var(--blue)' }}>BonkeiHandle</a>: <code>update(source)</code>, <code>setMode(mode)</code>, <code>destroy()</code>.</p>
      <h2>Example</h2>
      <pre className="solo">{`import { render } from 'bonkei'\n\nconst handle = render(document.getElementById('diagram'), \`${RENDER}\`, { mode: 'flat' })`}</pre>
      <Diagram source={RENDER} mode="flat" />
      <div className="foot">Signature, parameters and types generated from the installed package; the description from its doc comment; the example by hand.</div>
    </DocPage>
  )
}

function HomePage() {
  return (
    <div className="docs">
      <div className="sample">Mockup, sample data. Top strip: bonkei.dev's header with the new Docs link. Below: the docs home at bonkei.dev/docs/.</div>
      <div className="docs-site"><b>Bonkei</b><a href="#">How it works</a><a href="#">Views</a><a href="#">Themes</a><a href="#">Sequence</a><a href="#">Status</a><a className="docs-new" href="#">Docs</a><a href="#">GitHub</a></div>
      <Bar />
      <section className="docs-hero">
        <div>
          <h1>Mermaid diagrams, drawn as a scene you can turn.</h1>
          <p>Write the flowchart or sequence diagram you already write. Bonkei lays it out in trays and draws it flat, iso or in 3D, in React, plain JavaScript, a script tag or VitePress.</p>
          <a className="docs-btn p" href="#">Get started</a><a className="docs-btn" href="#">Guide</a><a className="docs-btn" href="#">API</a>
        </div>
        <div><Diagram source={HERO} /><div className="live">Live: this page's own mermaid fence.</div></div>
      </section>
      <div className="docs-block"><pre>{'# React or plain JavaScript\nnpm install bonkei react react-dom three\n# VitePress (one command, so npm picks one React)\nnpm install vitepress @bonkei/vitepress'}</pre></div>
      <div className="docs-block docs-paths">
        <a className="docs-card" href="#"><b>React</b><span><code>{'<Bonkei source={…} />'}</code> in any React 19 app.</span></a>
        <a className="docs-card" href="#"><b>Plain JavaScript</b><span><code>render(el, source)</code>, no framework.</span></a>
        <a className="docs-card" href="#"><b>Script tag</b><span><code>{'<bonkei-diagram>'}</code> in a static page.</span></a>
        <a className="docs-card" href="#"><b>VitePress</b><span>Your <code>```mermaid</code> fences, drawn by Bonkei.</span></a>
      </div>
      <div className="docs-block">
        <h3>Writing diagrams</h3>
        <div className="docs-topics">
          <a href="#">Diagram types<small>What Bonkei draws today: flowcharts and sequence diagrams.</small></a>
          <a href="#">Options and frontmatter<small>Per diagram in config.bonkei, or from code.</small></a>
          <a href="#">The reader's controls<small>Turn, zoom, pan, drill into a tray; the toolbar.</small></a>
          <a href="#">Edge styles<small>Bridges, tunnels, portals, and avoiding crossings.</small></a>
          <a href="#">Themes<small>Classic, Bonkei, Bonkei · landscape, your own variables.</small></a>
          <a href="#">Errors and warnings<small>What a bad line or option does, and how you hear of it.</small></a>
        </div>
      </div>
    </div>
  )
}

// ---- Stories: each page wide, then at the sizes the site is checked at ----
export const Home: Story = { render: () => <HomePage /> }
export const Home390: Story = { name: 'Home 390', render: () => <HomePage />, globals: at('phone390') }
export const Home820: Story = { name: 'Home 820', render: () => <HomePage />, globals: at('tablet820') }
export const Home1024: Story = { name: 'Home 1024', render: () => <HomePage />, globals: at('tablet1024') }

/** A feature's own page, the one it is tried on by hand and ships with. */
export const FeaturePage_: Story = { name: 'Feature page', render: () => <FeaturePage /> }
export const FeaturePage390: Story = { name: 'Feature page 390', render: () => <FeaturePage />, globals: at('phone390') }
export const FeaturePage820: Story = { name: 'Feature page 820', render: () => <FeaturePage />, globals: at('tablet820') }
export const FeaturePage1024: Story = { name: 'Feature page 1024', render: () => <FeaturePage />, globals: at('tablet1024') }

export const ApiPage_: Story = { name: 'API page', render: () => <ApiPage /> }
export const ApiPage390: Story = { name: 'API page 390', render: () => <ApiPage />, globals: at('phone390') }
export const ApiPage820: Story = { name: 'API page 820', render: () => <ApiPage />, globals: at('tablet820') }
export const ApiPage1024: Story = { name: 'API page 1024', render: () => <ApiPage />, globals: at('tablet1024') }

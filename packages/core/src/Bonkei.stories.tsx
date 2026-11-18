// Stories for <Bonkei />, render() and their overlays. Plain CSF objects with no Storybook
// imports, so core keeps no Storybook dependency. Every diagram here is MADE-UP SAMPLE DATA.
import { useEffect, useRef, useState } from 'react'
import { Bonkei, ErrorCard, ErrorStrip, Loading, Toolbar } from './Bonkei'
import { render, type BonkeiHandle } from './render'
import type { Mode } from './camera'
import type { CrossingStyle } from './edges3d'
import type { AvoidCrossings } from './avoid'
import type { GraphInput } from './model'

// Made-up sample: a small shop backend, not a real system.
const SAMPLE_FLOW = `flowchart LR
  subgraph Shop[Sample shop]
    Web[Web app] --> API(Orders API)
    API --> DB[(Orders DB)]
  end
  API -->|charge| Pay{Payments}
`
// Made-up sample: a login exchange between invented participants.
const SAMPLE_SEQ = `sequenceDiagram
  actor U as Sample user
  participant W as Web
  participant A as Auth
  U->>W: sign in
  W->>A: check password
  A-->>W: token
  W-->>U: welcome
`
// Made-up sample: frontmatter that opens flat, billboard labels, no toolbar.
const SAMPLE_FRONTMATTER = `---
config:
  bonkei:
    mode: flat
    labels: billboard
    toolbar: false
---
flowchart TD
  A[Sample start] --> B[Sample end]
`
// Made-up sample: a hand-built graph, re-created as a fresh literal on every render.
const sampleGraph = (): GraphInput => ({
  nodes: [{ id: 'a', label: 'Sample A', shape: 'rect' }, { id: 'b', label: 'Sample B', shape: 'round' }],
  edges: [{ id: 'e', from: 'a', to: 'b', label: 'made up' }],
})
const SAMPLE_BROKEN = '???\n!!!' // made up: nothing readable
// Made-up sample: two sources that each feed three sinks, so their lines cross (routed with avoidCrossings off).
const SAMPLE_CROSSING = `flowchart TD
  A --> C
  A --> D
  B --> C
  B --> D
  A --> E
  B --> E
`

const Frame = ({ children, h = '100vh' }: { children: React.ReactNode; h?: string }) => (
  <div style={{ width: '100%', height: h, background: '#0f1218' }}>{children}</div>
)
const Log = ({ lines }: { lines: string[] }) => (
  <pre style={{ position: 'fixed', left: 8, bottom: 8, margin: 0, padding: 6, maxWidth: '45vw', background: '#000a', color: '#cfd8ea', font: '11px monospace', pointerEvents: 'none', zIndex: 10 }}>
    {lines.slice(-8).join('\n')}
  </pre>
)

export default { title: 'Bonkei' }

/** A flowchart, ready, with the toolbar (View + Fit; crossingControls adds the crossing groups). Events are logged bottom-left. */
export const Flowchart = {
  args: { mode: 'iso' as Mode, labels: 'top' as const, toolbar: true, crossingControls: false },
  argTypes: { mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] }, labels: { control: 'inline-radio', options: ['top', 'billboard'] } },
  render: (args: { mode: Mode; labels: 'top' | 'billboard'; toolbar: boolean; crossingControls: boolean }) => {
    const [log, setLog] = useState<string[]>([])
    const add = (s: string) => setLog(l => [...l, s])
    return (
      <Frame>
        <Bonkei source={SAMPLE_FLOW} {...args}
          onReady={r => add(`ready ${r.nodes} nodes, ${r.edges} edges, ${Math.round(r.layoutMs)} ms`)}
          onModeChange={(m, c) => add(`mode ${m} (${c.source})`)}
          onNodeClick={n => add(`click ${n.kind} ${n.id}`)} />
        <Log lines={log} />
      </Frame>
    )
  },
}

/** A sequence diagram; clicking a participant reports kind `participant`. */
export const Sequence = {
  render: () => {
    const [log, setLog] = useState<string[]>([])
    return (
      <Frame>
        <Bonkei source={SAMPLE_SEQ} onNodeClick={n => setLog(l => [...l, `click ${n.kind} ${n.id}`])} />
        <Log lines={log} />
      </Frame>
    )
  },
}

/** The author picks bridges and no avoiding; the reader sees bridges and only View + Fit in the toolbar. */
export const BridgesWithoutControls = { render: () => <Frame><Bonkei source={SAMPLE_CROSSING} crossings="bridge" avoidCrossings="off" /></Frame> }

/** Options from frontmatter: flat, billboard labels, no toolbar. */
export const FromFrontmatter = { render: () => <Frame><Bonkei source={SAMPLE_FRONTMATTER} /></Frame> }

/** Every reader control off: no zoom (the page scrolls), no pan, no moving nodes, no drill-in. */
export const ControlsOff = {
  render: () => (
    <div style={{ height: '200vh', background: '#1a1f2b' }}>
      <div style={{ height: '60vh' }}><Bonkei source={SAMPLE_FLOW} controls={false} toolbar={false} /></div>
      <p style={{ color: '#cfd8ea', padding: 16 }}>Made-up page text: scroll over the diagram above; the page moves, the view does not.</p>
    </div>
  ),
}

/** A hand-built graph passed as an inline literal: re-renders of the parent do not lay out again. */
export const InlineGraph = {
  render: () => {
    const [ticks, setTicks] = useState(0)
    const [readies, setReadies] = useState(0)
    useEffect(() => { const t = setInterval(() => setTicks(n => n + 1), 500); return () => clearInterval(t) }, [])
    return (
      <Frame>
        <Bonkei source={sampleGraph()} onReady={() => setReadies(n => n + 1)} />
        <Log lines={[`parent renders: ${ticks}`, `onReady calls: ${readies}`]} />
      </Frame>
    )
  },
}

/** A source with nothing readable: the error card, no toolbar. */
export const FirstLoadError = {
  render: () => {
    const [log, setLog] = useState<string[]>([])
    return <Frame><Bonkei source={SAMPLE_BROKEN} onError={e => setLog(l => [...l, `error ${e.kind}: ${e.message}`])} /><Log lines={log} /></Frame>
  },
}

/** A good diagram, then a broken update: the last diagram stays, with the strip. */
export const FailedUpdate = {
  render: () => {
    const [src, setSrc] = useState(SAMPLE_FLOW)
    useEffect(() => { const t = setTimeout(() => setSrc('flowchart TD\n' + SAMPLE_BROKEN), 1500); return () => clearTimeout(t) }, [])
    return <Frame><Bonkei source={src} /></Frame>
  },
}

/** Two instances side by side: each has its own camera and toolbar. */
export const TwoOnOnePage = {
  render: () => (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1 }}><Bonkei source={SAMPLE_FLOW} mode="flat" /></div>
      <div style={{ flex: 1 }}><Bonkei source={SAMPLE_SEQ} mode="3d" /></div>
    </div>
  ),
}

/** The framework-free render(): mounted into a plain div, driven through its handle. */
export const RenderFunction = {
  render: () => {
    const el = useRef<HTMLDivElement>(null)
    const h = useRef<BonkeiHandle | null>(null)
    useEffect(() => {
      h.current = render(el.current!, SAMPLE_FLOW, { toolbar: false })
      h.current.setMode('3d') // before mount: folded into the first render
      return () => h.current?.destroy()
    }, [])
    const btn = { margin: 4, padding: '4px 10px' }
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1218' }}>
        <div>
          {(['flat', 'iso', '3d'] as const).map(m => <button key={m} style={btn} onClick={() => h.current?.setMode(m)}>{m}</button>)}
          <button style={btn} onClick={() => h.current?.fit()}>fit</button>
          <button style={btn} onClick={() => h.current?.update(SAMPLE_SEQ)}>update to sequence</button>
          <button style={btn} onClick={() => h.current?.destroy()}>destroy</button>
        </div>
        <div ref={el} style={{ flex: 1, minHeight: 0 }} />
      </div>
    )
  },
}

// The overlays alone, over a plain background.
const Over = ({ children }: { children: React.ReactNode }) => <div style={{ position: 'relative', height: 320, background: '#0f1218' }}>{children}</div>

export const OverlayLoading = { render: () => <Over><Loading /></Over> }
export const OverlayErrorCard = {
  render: () => <Over><ErrorCard error={{ kind: 'parse', message: 'no nodes found; first unreadable line: 3: ???', line: 3 }} /></Over>,
}
export const OverlayRenderErrorCard = {
  render: () => <Over><ErrorCard error={{ kind: 'render', message: 'WebGL is unavailable (Error creating WebGL context.)' }} /></Over>,
}
export const OverlayErrorStrip = {
  render: () => <Over><ErrorStrip error={{ kind: 'parse', message: 'no nodes found; first unreadable line: 2: !!!', line: 2 }} /></Over>,
}
/** The default toolbar: the View radiogroup and Fit, nothing else. */
export const OverlayToolbar = {
  render: () => {
    const [m, setM] = useState<Mode>('flat')
    return <Over><Toolbar mode={m} onPick={setM} onFit={() => {}} /></Over>
  },
}
/** The toolbar with crossingControls on: View, Crossings, Avoid crossings and Fit. */
export const OverlayToolbarWithCrossingControls = {
  render: () => {
    const [m, setM] = useState<Mode>('flat')
    const [c, setC] = useState<CrossingStyle>('none')
    const [a, setA] = useState<AvoidCrossings>('some')
    return <Over><Toolbar mode={m} onPick={setM} onFit={() => {}} crossings={c} onCrossings={setC} avoid={a} onAvoid={setA} /></Over>
  },
}

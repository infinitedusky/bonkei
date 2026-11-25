// Every state of the public <Bonkei /> component and render(), against the real component.
// Every diagram here is MADE-UP SAMPLE DATA, labelled 'sample data: …' where it is shown.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Bonkei, render, type BonkeiError, type BonkeiHandle, type BonkeiWarning, type Controls } from 'bonkei'

// ---- Sample data (made up) ----

const FLOW = `flowchart LR
  subgraph Shop[Sample shop]
    Web[Web app] --> API(Orders API)
    API --> DB[(Orders DB)]
  end
  API -->|charge| Pay{Payments}
`
const FLOW_ALT = `flowchart TD
  Inbox[Sample inbox] --> Triage{Triage}
  Triage -->|bug| Fix[Fix it]
  Triage -->|idea| Later[(Backlog)]
`
const FLOW_FINAL = `flowchart LR
  Draft[Sample draft] --> Review(Review) --> Ship[Shipped]
`
const SEQ = `sequenceDiagram
  actor U as Sample user
  participant W as Web
  participant A as Auth
  U->>W: sign in
  W->>A: check password
  A-->>W: token
  W-->>U: welcome
`
const FRONTMATTER = `---
config:
  bonkei:
    mode: flat
    labels: billboard
    toolbar: false
---
flowchart TD
  subgraph Team[Sample team]
    Plan[Plan] --> Build(Build)
  end
  Build --> Demo[Demo day]
`
const FRONTMATTER_NO_CONTROLS = `---
config:
  bonkei:
    controls: false
---
${FLOW}`
const BROKEN = '???\n!!!'
const CROSSING = 'flowchart TD\n  A --> C\n  A --> D\n  B --> C\n  B --> D\n  A --> E\n  B --> E'
const FRONTMATTER_3D = `---
config:
  bonkei:
    mode: 3d
---
${FLOW}`

// ---- Shared bits ----

const fmtError = (e: BonkeiError) => `error line ${e.line}: ${e.message}`
const fmtWarning = (w: BonkeiWarning) => `warning line ${w.line}: ${w.message}`

const page: CSSProperties = { minHeight: '100vh', background: '#0f1218', color: '#cfd8ea', font: '14px system-ui, sans-serif', padding: 24, boxSizing: 'border-box' }
const btn: CSSProperties = { padding: '5px 12px', marginRight: 6, border: '1px solid #3a4560', background: '#1a2030', color: '#fff', borderRadius: 5, cursor: 'pointer' }
const tag: CSSProperties = { color: '#7f8aa3', font: '11px ui-monospace, monospace', margin: '4px 0' }

/** A sized box for one diagram, with its sample-data label above it. */
const Box = ({ label, w = 760, h = 380, children }: { label: string; w?: number | string; h?: number; children: ReactNode }) => (
  <div style={{ margin: '8px 0 16px' }}>
    <div style={tag}>sample data: {label}</div>
    <div style={{ width: w, height: h, outline: '1px solid #3a4560' }}>{children}</div>
  </div>
)

// The spy keeps its log in React state, so every callback re-renders the story: that proves
// the component does not lay out again on a parent re-render.
function useSpy() {
  const [log, setLog] = useState<string[]>([])
  const push = useCallback((name: string, text: string) => setLog(l => [...l, `${name}: ${text}`]), [])
  const cbs = {
    onError: (e: BonkeiError) => push('onError', `${fmtError(e)} (kind ${e.kind})`),
    onWarning: (w: BonkeiWarning) => push('onWarning', `${fmtWarning(w)} (kind ${w.kind})`),
    onReady: (r: { layoutMs: number; nodes: number; edges: number; dropped: number }) => push('onReady', `${r.nodes} nodes, ${r.edges} edges, ${r.dropped} dropped`),
    onModeChange: (m: string, c: { source: string }) => push('onModeChange', `${m} (from ${c.source})`),
    onNodeClick: (n: { id: string; kind: string; label: string }) => push('onNodeClick', `${n.id} (kind ${n.kind}, "${n.label}")`),
  }
  return { log, push, cbs }
}
const Spy = ({ title = 'spy', log }: { title?: string; log: string[] }) => (
  <div data-spy={title} style={{ margin: '4px 0 16px', padding: 8, maxWidth: 760, background: '#161c28', border: '1px solid #3a4560', borderRadius: 4, font: '12px ui-monospace, monospace' }}>
    <div style={{ color: '#7f8aa3' }}>{title} · {log.length} call{log.length === 1 ? '' : 's'}</div>
    {log.length === 0 ? <div style={{ color: '#556' }}>(no calls yet)</div> : log.map((l, i) => <div key={i}>{l}</div>)}
  </div>
)

const meta: Meta = { title: 'Components/Bonkei' }
export default meta
type Story = StoryObj

// ---- Stories ----

/** A made-up docs page with the diagram in a 760×380 box. It starts in iso; the toolbar shows Flat / Iso / 3D and Fit. */
export const InADocsPage: Story = {
  render: () => (
    <div style={page}>
      <h1 style={{ margin: '0 0 8px' }}>Sample docs: how an order flows</h1>
      <p style={{ maxWidth: 760 }}>This page is made up. It shows how a docs site drops a diagram into its prose: one component inside a sized box.</p>
      <Box label="a small shop backend"><Bonkei source={FLOW} /></Box>
      <p style={{ maxWidth: 760 }}>The text carries on below the diagram, as it would on a real docs page.</p>
    </div>
  ),
}

/** The same diagram with toolbar={false}. */
export const NoToolbar: Story = {
  render: () => (
    <div style={page}>
      <Box label="a small shop backend, toolbar={false}"><Bonkei source={FLOW} toolbar={false} /></Box>
    </div>
  ),
}

/** BON-100: with crossingControls on, the toolbar adds the crossing style (No hop / Bridge / Tunnel / Portal, default No hop) and Avoid crossings (off / some / strong, default some). A made-up diagram whose lines cross. */
export const CrossingStyles: Story = {
  render: () => (
    <div style={page}>
      <Box label="made-up lines that cross, crossingControls on: pick a crossing style and how hard lines avoid crossing"><Bonkei source={CROSSING} avoidCrossings="off" crossingControls /></Box>
    </div>
  ),
}

/** BON-100: frontmatter sets crossings: tunnel, avoidCrossings: strong and crossingControls: true; the toolbar shows both crossing groups, starting on those. */
export const CrossingsInFrontmatter: Story = {
  render: () => (
    <div style={page}>
      <Box label="frontmatter: crossings tunnel, avoidCrossings strong, crossingControls true"><Bonkei source={'---\nconfig:\n  bonkei:\n    crossings: tunnel\n    avoidCrossings: strong\n    crossingControls: true\n---\nflowchart TD\n  A --> C\n  A --> D\n  B --> C\n  B --> D'} /></Box>
    </div>
  ),
}

/** The author picks bridges and no avoiding, without crossingControls: the lines bridge, and the toolbar shows only Flat / Iso / 3D and Fit. */
export const CrossingStyleWithoutControls: Story = {
  render: () => (
    <div style={page}>
      <Box label="crossing lines, crossings bridge set by the author, no crossing controls"><Bonkei source={CROSSING} crossings="bridge" avoidCrossings="off" /></Box>
    </div>
  ),
}

/** Where a diagram starts: iso with no mode (the default), flat from the prop, 3D from the frontmatter. */
export const StartsInEachView: Story = {
  render: () => (
    <div style={page}>
      <Box label="a small shop backend, no mode (starts in iso, the default)"><Bonkei source={FLOW} /></Box>
      <Box label='a small shop backend, mode="flat"'><Bonkei source={FLOW} mode="flat" /></Box>
      <Box label="a small shop backend, frontmatter config.bonkei.mode: 3d"><Bonkei source={FRONTMATTER_3D} /></Box>
      <pre style={tag}>{FRONTMATTER_3D}</pre>
    </div>
  ),
}

/** Frontmatter sets config.bonkei: mode flat, labels billboard, toolbar false. */
export const OptionsInFrontmatter: Story = {
  render: () => (
    <div style={page}>
      <Box label="frontmatter: mode flat, labels billboard, toolbar false"><Bonkei source={FRONTMATTER} /></Box>
      <pre style={tag}>{FRONTMATTER}</pre>
    </div>
  ),
}

/** The same source; the props mode="3d" and labels="top" win over its frontmatter. */
export const FrontmatterFlatProp3d: Story = {
  render: () => (
    <div style={page}>
      <Box label='frontmatter: flat, billboard, no toolbar; props mode="3d" labels="top"'><Bonkei source={FRONTMATTER} mode="3d" labels="top" /></Box>
      <pre style={tag}>{FRONTMATTER}</pre>
    </div>
  ),
}

/** Nothing readable: the error card, one onError, no throw; the page text below still shows. */
export const ParseError: Story = {
  render: () => {
    const a = useSpy()
    const b = useSpy()
    return (
      <div style={page}>
        <Box label="unreadable text '???\n!!!'"><Bonkei source={BROKEN} onError={a.cbs.onError} onWarning={a.cbs.onWarning} /></Box>
        <Spy title="spy (unreadable text)" log={a.log} />
        <Box label='an empty source=""' h={200}><Bonkei source="" onError={b.cbs.onError} onWarning={b.cbs.onWarning} /></Box>
        <Spy title="spy (empty source)" log={b.log} />
        <p>The rest of the page still renders below the broken diagrams.</p>
      </div>
    )
  },
}

/** A failed update keeps the last good diagram with a strip; rapid updates end on the last one. */
export const UpdateError: Story = {
  render: () => {
    const [src, setSrc] = useState(FLOW)
    const { log, cbs } = useSpy()
    // Each update is committed on its own, so the component really sees all three in a row.
    const rapid = () => { for (const s of [FLOW_ALT, BROKEN, FLOW_FINAL]) flushSync(() => setSrc(s)) }
    return (
      <div style={page}>
        <div>
          <button style={btn} onClick={() => setSrc(BROKEN)}>break</button>
          <button style={btn} onClick={() => setSrc(FLOW)}>fix</button>
          <button style={btn} onClick={rapid}>rapid (good, broken, good)</button>
        </div>
        <Box label={src === FLOW ? 'a small shop backend' : src === BROKEN ? "unreadable text '???\\n!!!'" : src === FLOW_FINAL ? 'rapid: the last good source (draft → review → shipped)' : 'rapid: first good source'}>
          <Bonkei source={src} onError={cbs.onError} onWarning={cbs.onWarning} onReady={cbs.onReady} />
        </Box>
        <Spy log={log} />
      </div>
    )
  },
}

// Made-up sample: an invented backend with a nested tray, the start of the "edits keep the view" story.
const EDIT_BASE = `flowchart LR
  subgraph Back[Sample backend]
    subgraph Api[Sample API]
      Rest[REST API] --> Gql[GraphQL]
    end
    Db[(Sample DB)]
  end
  Web[Sample web] --> Rest
  Gql --> Db
`
const EDITS: { label: string; edit: (s: string) => string }[] = [
  { label: 'add a node and an edge', edit: s => s + '  Db --> Cache[Sample cache]\n' },
  { label: 'add a chain far to the right', edit: s => s + '  Db --> C1[Far 1] --> C2[Far 2] --> C3[Far 3] --> C4[Far 4] --> C5[Far 5]\n' },
  { label: 'rename REST API', edit: s => s.replace('Rest[REST API]', 'Rest[REST API, a longer sample label]') },
  { label: 'delete the Sample API tray', edit: s => s.replace(/    subgraph Api[\s\S]*?    end\n/, '') },
  { label: 'theme bonkei in the frontmatter', edit: s => s.startsWith('---') ? s : '---\nconfig:\n  theme: bonkei\n---\n' + s },
]

/**
 * BON-195: a new layout keeps the view. Zoom, pan, turn or click a tray to fly in, then press an edit (or change Avoid crossings in
 * the toolbar): nothing on screen moves except what the edit changed. Only the first draw frames the diagram; Fit and
 * Flat / Iso / 3D frame it as before (after deleting the tray you are in, the next mode switch frames its parent tray).
 */
export const EditsKeepTheView: Story = {
  render: () => {
    const [src, setSrc] = useState(EDIT_BASE)
    const { log, cbs } = useSpy()
    return (
      <div style={page}>
        <div>
          {EDITS.map(e => <button key={e.label} style={btn} onClick={() => setSrc(e.edit)}>{e.label}</button>)}
          <button style={btn} onClick={() => setSrc(EDIT_BASE)}>back to the start</button>
        </div>
        <Box label="an invented backend with a nested tray (the buttons edit its source)" h={440}>
          <Bonkei source={src} crossingControls onReady={cbs.onReady} />
        </Box>
        <pre style={{ ...tag, whiteSpace: 'pre-wrap', maxWidth: 760 }}>{src}</pre>
        <Spy title="onReady (one per layout; the camera keeps its place after the first)" log={log} />
      </div>
    )
  },
}

/** Two diagrams on one page share nothing: moving one leaves the other still. */
export const TwoOnOnePage: Story = {
  render: () => (
    <div style={page}>
      <Box label="a small shop backend (top)"><Bonkei source={FLOW} /></Box>
      <Box label="a sign-in exchange (bottom)"><Bonkei source={SEQ} /></Box>
    </div>
  ),
}

type ControlsArg = 'default' | 'false' | '{zoom:false}' | '{pan:false}' | '{move:false}' | '{drillIn:false}' | 'frontmatter false'
const CONTROLS: Record<ControlsArg, Controls | undefined> = {
  default: undefined,
  false: false,
  '{zoom:false}': { zoom: false },
  '{pan:false}': { pan: false },
  '{move:false}': { move: false },
  '{drillIn:false}': { drillIn: false },
  'frontmatter false': undefined,
}

/** One controls setting, stepped through by the args radio, inside a page that scrolls. */
export const ControlsSetting: StoryObj<{ controls: ControlsArg }> = {
  args: { controls: 'default' },
  argTypes: { controls: { control: 'radio', options: Object.keys(CONTROLS) } },
  render: ({ controls }) => {
    const fm = controls === 'frontmatter false'
    return (
      <div style={page}>
        <p>controls: <b>{controls}</b>. Scroll down to the diagram: the wheel over it scrolls the page and shows a hint; pinch or ⌘/Ctrl + scroll zooms (when zoom is on); a click takes hold of it until Esc or a click outside.</p>
        <div style={{ height: '60vh', borderLeft: '2px dashed #3a4560', paddingLeft: 8, color: '#556' }}>page text above (spacer so the page scrolls)</div>
        <Box label={fm ? 'a small shop backend, frontmatter controls: false' : `a small shop backend, controls=${controls}`}>
          <Bonkei source={fm ? FRONTMATTER_NO_CONTROLS : FLOW} controls={CONTROLS[controls]} />
        </Box>
        <div style={{ height: '100vh', borderLeft: '2px dashed #3a4560', paddingLeft: 8, color: '#556' }}>page text below (spacer so the page scrolls)</div>
      </div>
    )
  },
}

/** Clicks on nodes, trays and participants reach onNodeClick; a drag does not. */
export const NodeClick: Story = {
  render: () => {
    const { log, cbs } = useSpy()
    return (
      <div style={page}>
        <Box label="a small shop backend (flowchart with a group)"><Bonkei source={FLOW} onNodeClick={cbs.onNodeClick} /></Box>
        <Box label="a sign-in exchange (sequence)"><Bonkei source={SEQ} onNodeClick={cbs.onNodeClick} /></Box>
        <Box label="a small shop backend, controls={{ drillIn: false }}"><Bonkei source={FLOW} controls={{ drillIn: false }} onNodeClick={cbs.onNodeClick} /></Box>
        <Spy log={log} />
      </div>
    )
  },
}

/** A hand-built graph, written inline so it is a fresh literal on every re-render. */
export const FromAGraph: Story = {
  render: () => {
    const { log, cbs } = useSpy()
    return (
      <div style={page}>
        <Box label="hand-built graph">
          <Bonkei
            source={{
              groups: [{ id: 'g', label: 'Sample group' }],
              nodes: [
                { id: 'a', label: 'Sample A', shape: 'rect', parent: 'g' },
                { id: 'b', label: 'Sample B', shape: 'round', parent: 'g' },
                { id: 'c', label: 'Sample C', shape: 'cylinder' },
              ],
              edges: [{ id: 'ab', from: 'a', to: 'b' }, { id: 'bc', from: 'b', to: 'c', label: 'made up' }],
            }}
            onReady={cbs.onReady} onError={cbs.onError}
          />
        </Box>
        <Spy log={log} />
      </div>
    )
  },
}

function RenderFunctionDemo() {
  const el = useRef<HTMLDivElement>(null)
  const handle = useRef<BonkeiHandle | null>(null)
  const { log, push, cbs } = useSpy()
  const cbsRef = useRef(cbs)
  cbsRef.current = cbs
  useEffect(() => {
    const h = render(el.current!, {
      groups: [{ id: 'g', label: 'Sample group' }],
      nodes: [
        { id: 'a', label: 'Sample A', shape: 'rect', parent: 'g' },
        { id: 'b', label: 'Sample B', shape: 'round', parent: 'g' },
        { id: 'c', label: 'Sample C', shape: 'cylinder' },
      ],
      edges: [{ id: 'ab', from: 'a', to: 'b' }, { id: 'bc', from: 'b', to: 'c', label: 'made up' }],
    }, {
      onReady: r => cbsRef.current.onReady(r),
      onError: e => cbsRef.current.onError(e),
      onWarning: w => cbsRef.current.onWarning(w),
      onModeChange: (m, c) => cbsRef.current.onModeChange(m, c),
    })
    handle.current = h
    // Unmount its root after this commit, not inside it.
    return () => { setTimeout(() => h.destroy()) }
  }, [])
  const call = (name: string, f: (h: BonkeiHandle) => void) => () => { push('click', name); if (handle.current) f(handle.current) }
  return (
    <div style={page}>
      <div>
        <button style={btn} onClick={call('update(sequence)', h => h.update(SEQ))}>update</button>
        <button style={btn} onClick={call("setMode('flat')", h => h.setMode('flat'))}>setMode flat</button>
        <button style={btn} onClick={call("setTheme('bonkei')", h => h.setTheme('bonkei'))}>setTheme bonkei</button>
        <button style={btn} onClick={call('setTheme(undefined)', h => h.setTheme(undefined))}>setTheme default</button>
        <button style={btn} onClick={call('destroy()', h => h.destroy())}>destroy</button>
        <button style={btn} onClick={call('update after destroy', h => { h.destroy(); h.update(SEQ) })}>update after destroy</button>
        <button style={btn} onClick={call('setMode after destroy', h => { h.destroy(); h.setMode('3d') })}>setMode after destroy</button>
      </div>
      <div style={tag}>sample data: hand-built graph (update: a sign-in exchange)</div>
      <div ref={el} style={{ width: 760, height: 380, outline: '1px solid #3a4560' }} />
      <Spy log={log} />
    </div>
  )
}
/** render() into a plain div, driven through its handle. */
export const RenderFunction: Story = { render: () => <RenderFunctionDemo /> }

// No WebGL while the story is mounted: getContext returns null for webgl2 / webgl.
type Proto = HTMLCanvasElement & { __bonkeiReal?: HTMLCanvasElement['getContext'] }
function stubWebGL() {
  const proto = HTMLCanvasElement.prototype as Proto
  if (proto.__bonkeiReal) return
  const real = proto.getContext
  proto.__bonkeiReal = real
  proto.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
    if (id === 'webgl2' || id === 'webgl') return null
    return (real as (...a: unknown[]) => unknown).call(this, id, ...rest)
  } as HTMLCanvasElement['getContext']
}
function restoreWebGL() {
  const proto = HTMLCanvasElement.prototype as Proto
  if (!proto.__bonkeiReal) return
  proto.getContext = proto.__bonkeiReal
  delete proto.__bonkeiReal
}
// The crash is induced here, so React's dev build must not re-report it as uncaught once the
// component's boundary has caught it: preventDefault marks that one error as handled.
const induced = (e: ErrorEvent) => { if (/WebGL context/i.test(e.message)) e.preventDefault() }
function NoWebGL({ children }: { children: ReactNode }) {
  const on = () => { stubWebGL(); window.addEventListener('error', induced) }
  useState(on) // before the children first render
  useEffect(() => {
    on()
    return () => { restoreWebGL(); window.removeEventListener('error', induced) }
  }, [])
  return <>{children}</>
}
const noWebGL: Decorator = Story => <NoWebGL><Story /></NoWebGL>

/** A crash while drawing (here: no WebGL) shows the error card and one onError of kind render. */
export const RenderCrash: Story = {
  decorators: [noWebGL],
  render: () => {
    const { log, cbs } = useSpy()
    return (
      <div style={page}>
        <p>WebGL is switched off for this story.</p>
        <Box label="a small shop backend"><Bonkei source={FLOW} onError={cbs.onError} onReady={cbs.onReady} /></Box>
        <Spy log={log} />
        <p>The rest of the page still renders below the diagram.</p>
      </div>
    )
  },
}

// ---- Stages (BON-253) ----
// The sample models are made up, written by apps/playground/scripts/make-stages.mjs and served at /stages/.
const stage = (file: string) => `---\nconfig:\n  bonkei:\n    stage: ${file}\n---\n`
const KITCHEN = stage('stages/kitchen.glb')
/** The parts a stage's onReady reports, for the spy. */
const stageParts = (r: { stage?: { parts: { name: string }[] } }) => `stage parts ${r.stage?.parts.map(p => p.name).join(', ')}`

/** A made-up kitchen as a stage: no areas; grill, prep line, wrap station and register named on their own sides in white with a drop shadow; the unnamed fridge has none; the floor grown at the left, where the grill hangs over it. */
export const Stage: Story = {
  render: () => {
    const { log, push, cbs } = useSpy()
    return (
      <div style={page}>
        <Box label="a kitchen with a grill, prep line, register and wrap station" h={460}>
          <Bonkei source={KITCHEN} onError={cbs.onError} onWarning={cbs.onWarning} onReady={r => push('onReady', stageParts(r))} />
        </Box>
        <Spy log={log} />
      </div>
    )
  },
}

/** A made-up house and phone line, in flat, where sides cannot be seen: every part's name floats with a line down (in iso exchange and server are named on their sides; phone, router and telephone pole float over the walls). */
export const StageHouseFlat: Story = {
  render: () => (
    <div style={page}>
      <Box label="a house, a telephone pole, an exchange and a server" h={460}><Bonkei source={stage('stages/house.glb')} mode="flat" /></Box>
    </div>
  ),
}

/** The `stage` prop over the frontmatter, opening in 3D, where drag turns the view and Shift-drag pans. */
export const StageFromProp3d: Story = {
  render: () => (
    <div style={page}>
      <Box label='the kitchen, stage="stages/kitchen.glb" mode="3d"' h={460}><Bonkei source="" stage="stages/kitchen.glb" mode="3d" /></Box>
    </div>
  ),
}

/** Two parts named alike ("grill" and "Grill"): both drawn, one stage warning. */
export const StageNamesAlike: Story = {
  render: () => {
    const { log, cbs } = useSpy()
    return (
      <div style={page}>
        <Box label="a kitchen with two parts named grill" h={420}><Bonkei source={stage('stages/duplicate.glb')} onWarning={cbs.onWarning} /></Box>
        <Spy log={log} />
      </div>
    )
  },
}

/**
 * Three made-up models the probes tried: a part that is a named empty node (the door: a floating name over the spot, no shape), the
 * kitchen exported in millimetres (shown at its size in metres, like the kitchen), and a model whose only object is the grill (one part, grill).
 */
export const StageOddModels: Story = {
  render: () => {
    const { log, push, cbs } = useSpy()
    const cases: [string, string][] = [
      ['a grill and an empty node named door', 'stages/empty-part.glb'],
      ['the kitchen in millimetres', 'stages/kitchen-mm.glb'],
      ['only the grill, its pieces under it', 'stages/lone-part.glb'],
    ]
    return (
      <div style={page}>
        {cases.map(([label, file]) => <Box key={file} label={label} h={320}><Bonkei source={stage(file)} onError={cbs.onError} onReady={r => push('onReady', stageParts(r))} /></Box>)}
        <Spy log={log} />
      </div>
    )
  },
}

/** Each way a stage can fail shows the error card with a readable message, never a blank screen. */
export const StageErrors: Story = {
  render: () => {
    const cases: [string, string][] = [
      ['a model whose top-level objects have no names', 'stages/blob.glb'],
      ['a file that is not there', 'stages/kichen.glb'],
      ['a text file, not a glTF', 'stages/not-a-model.glb'],
      ['a model with Draco compression', 'stages/kitchen-draco.glb'],
      ['a model on another site that does not allow it (CORS)', 'https://example.com/kitchen.glb'],
    ]
    return (
      <div style={page}>
        {cases.map(([label, file]) => <Box key={file} label={label} h={200}><Bonkei source={stage(file)} /></Box>)}
      </div>
    )
  },
}

/** A bad address while editing keeps the last stage drawn, with the "Not updated" strip. */
export const StageUpdateError: Story = {
  render: () => {
    const [src, setSrc] = useState(KITCHEN)
    return (
      <div style={page}>
        <div>
          <button style={btn} onClick={() => setSrc(stage('stages/kitche.glb'))}>mistype the address</button>
          <button style={btn} onClick={() => setSrc(KITCHEN)}>fix</button>
        </div>
        <Box label="the kitchen, then a mistyped address" h={420}><Bonkei source={src} /></Box>
      </div>
    )
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { isSeq, parse, layout, parseSeq, layoutSeq, SceneView, createCamera, S } from 'bonkei'
import type { LayoutResult, SeqLayout, Mode, LabelMode } from 'bonkei'
import { SAMPLES } from './samples'

// Mockups for BON-51: what <Bonkei /> looks like inside someone else's page.
// `Mock` stands in for the real component until it exists. The scene is the real SceneView; the toolbar, the
// error and the loading state are drawn here. Every diagram and page text below is sample data.

type Opts = { mode?: Mode; labels?: LabelMode; toolbar?: boolean }

/** Splits Mermaid frontmatter off the source and reads `config.bonkei` (mockup only: flat keys, no YAML library). */
function frontmatter(src: string): { body: string; opts: Opts } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return { body: src, opts: {} }
  const opts: Opts = {}
  const block = m[1].split('bonkei:')[1] ?? ''
  for (const line of block.split('\n')) {
    const kv = line.trim().match(/^(\w+):\s*(\S+)/)
    if (!kv) continue
    if (kv[1] === 'mode') opts.mode = kv[2] as Mode
    if (kv[1] === 'labels') opts.labels = kv[2] as LabelMode
    if (kv[1] === 'toolbar') opts.toolbar = kv[2] === 'true'
  }
  return { body: src.slice(m[0].length), opts }
}

const C = { bg: '#0f1218', line: '#2a3348', text: '#cfd8ea', dim: '#7f8aa3', blue: '#4b6bdc', red: '#ff8a8a' }

function Toolbar({ mode, pick, fit }: { mode: Mode; pick: (m: Mode) => void; fit: () => void }) {
  const seg = (on: boolean): React.CSSProperties => ({
    padding: '3px 9px', border: 0, background: on ? C.blue : 'transparent', color: on ? '#fff' : C.text,
    font: '600 11px system-ui', borderRadius: 4, cursor: 'pointer',
  })
  return (
    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
      <div role="radiogroup" aria-label="View" style={{ display: 'flex', padding: 2, background: 'rgba(16,21,31,.85)', border: `1px solid ${C.line}`, borderRadius: 6 }}>
        {(['flat', 'iso', '3d'] as Mode[]).map(m => <button key={m} role="radio" aria-checked={mode === m} style={seg(mode === m)} onClick={() => pick(m)}>{m}</button>)}
      </div>
      <button title="Fit to view" aria-label="Fit to view" onClick={fit}
        style={{ ...seg(false), background: 'rgba(16,21,31,.85)', border: `1px solid ${C.line}`, borderRadius: 6, padding: '3px 8px' }}>⤢</button>
    </div>
  )
}

function ErrorCard({ message, line }: { message: string; line?: number }) {
  return (
    <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ maxWidth: 420, border: `1px solid #5a2f36`, background: '#1a1216', borderRadius: 8, padding: '12px 14px', color: C.text, font: '13px system-ui' }}>
        <div style={{ color: C.red, fontWeight: 600, marginBottom: 4 }}>This diagram couldn't be drawn</div>
        <div style={{ font: '12px ui-monospace, monospace', color: C.text }}>{line !== undefined && <span style={{ color: C.dim }}>line {line}: </span>}{message}</div>
      </div>
    </div>
  )
}

function ErrorStrip({ message, line }: { message: string; line?: number }) {
  return (
    <div role="alert" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, padding: '6px 10px', background: 'rgba(26,18,22,.92)', border: '1px solid #5a2f36', borderRadius: 6, color: C.text, font: '12px ui-monospace, monospace' }}>
      <span style={{ color: C.red }}>Not updated · </span>{line !== undefined && <span style={{ color: C.dim }}>line {line}: </span>}{message}
    </div>
  )
}

function Mock({ source, mode: modeProp, labels: labelsProp, toolbar: toolbarProp, error, staleError, loading }: {
  source: string
  /** Props override frontmatter. */
  mode?: Mode; labels?: LabelMode; toolbar?: boolean
  /** A source that could not be drawn at all: the inline message, nothing else. */
  error?: { message: string; line?: number }
  /** An update that could not be drawn: the last good diagram stays, with a strip. */
  staleError?: { message: string; line?: number }
  loading?: boolean
}) {
  const { body, opts } = frontmatter(source)
  const mode0 = modeProp ?? opts.mode ?? 'iso'
  const labels = labelsProp ?? opts.labels ?? 'top'
  const toolbar = toolbarProp ?? opts.toolbar ?? true
  const [data, setData] = useState<LayoutResult | SeqLayout | null>(null)
  const [camera] = useState(createCamera)
  const [mode, setMode] = useState<Mode>(mode0)
  useEffect(() => { setMode(mode0) }, [mode0])
  useEffect(() => {
    if (error || loading) return
    if (isSeq(body)) setData(layoutSeq(parseSeq(body)))
    else layout(parse(body)).then(setData)
  }, [body, error, loading])
  const pick = (m: Mode) => { setMode(m); camera.setMode(m) }
  const fit = () => data && camera.focusOn(0, 0, data.width * S, data.height * S)
  return (
    // Fills its container: the container decides the size, the diagram takes all of it.
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, background: C.bg, borderRadius: 'inherit', overflow: 'hidden' }}>
      {!error && !loading && <SceneView data={data} camera={camera} mode={mode} labelMode={labels} showFps={false} wheelZoom={false} />}
      {loading && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: C.dim, font: '12px system-ui' }}>Laying out…</div>}
      {error && <ErrorCard {...error} />}
      {staleError && <ErrorStrip {...staleError} />}
      {toolbar && !error && !loading && <Toolbar mode={mode} pick={pick} fit={fit} />}
    </div>
  )
}

// A made-up docs page the diagram sits in.
const Page = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ minHeight: '100vh', background: '#fbfbfd', color: '#1d2230', font: '15px/1.6 system-ui', padding: '32px 0' }}>
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ color: '#8a90a0', fontSize: 12 }}>sample docs page · made-up content</div>
      <h1 style={{ fontSize: 28, margin: '4px 0 12px' }}>{title}</h1>
      {children}
    </article>
  </div>
)
const Code = ({ children }: { children: string }) => (
  <pre style={{ background: '#f1f2f6', border: '1px solid #e2e4ea', borderRadius: 6, padding: '10px 12px', font: '12.5px/1.5 ui-monospace, monospace', overflow: 'auto' }}>{children}</pre>
)
const Frame = ({ height = 380, children }: { height?: number | string; children: React.ReactNode }) => (
  <div style={{ height, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e4ea', margin: '12px 0 20px' }}>{children}</div>
)

const small = SAMPLES['flow: small (sample.mmd)']
const login = SAMPLES['seq: login flow']
const withFrontmatter = `---
config:
  bonkei:
    mode: flat
    labels: billboard
    toolbar: false
---
${small.replace(/^%%.*\n/, '')}`

const meta: Meta = { title: 'Mockups/Bonkei' }
export default meta

/** The React component in a docs page: fills the box it is given, iso by default, toolbar top-right. */
export const InADocsPage: StoryObj = {
  render: () => (
    <Page title="Architecture">
      <p>Our services, as a diagram readers can turn and fly into. Click a tray to fly in; drag to pan.</p>
      <Code>{`import { Bonkei } from 'bonkei'

<div style={{ height: 380 }}>
  <Bonkei source={diagram} />
</div>`}</Code>
      <Frame><Mock source={small} /></Frame>
      <p>The rest of the page carries on below, and the mouse wheel scrolls the page, not the diagram.</p>
    </Page>
  ),
}

/** The same diagram from plain JavaScript: render() into an element, with a handle to change it later. */
export const FromPlainJavaScript: StoryObj = {
  render: () => (
    <Page title="Without React">
      <Code>{`import { render } from 'bonkei'

const view = render(document.getElementById('arch'), diagram, { mode: '3d' })
view.update(newDiagram)
view.setMode('flat')
view.destroy()`}</Code>
      <Frame><Mock source={small} mode="3d" /></Frame>
    </Page>
  ),
}

/** Options written in the diagram itself, under config.bonkei: flat, labels standing up, no toolbar. */
export const OptionsInFrontmatter: StoryObj = {
  render: () => (
    <Page title="Options in the diagram">
      <p>The author sets the view in the diagram's own frontmatter, so it looks the same everywhere it is pasted. Props on the component win over these.</p>
      <Code>{withFrontmatter.split('\n').slice(0, 8).join('\n') + '\n    …'}</Code>
      <Frame><Mock source={withFrontmatter} /></Frame>
    </Page>
  ),
}

/** Toolbar off, by prop: a fixed picture with nothing on top of it. */
export const NoToolbar: StoryObj = {
  render: () => <Page title="Toolbar off"><Code>{`<Bonkei source={diagram} toolbar={false} />`}</Code><Frame><Mock source={small} toolbar={false} /></Frame></Page>,
}

/** A source that cannot be drawn: an inline message where the diagram would be, and onError is called. No throw. */
export const ParseError: StoryObj = {
  render: () => (
    <Page title="A broken diagram">
      <Code>{`<Bonkei source={diagram} onError={e => console.warn(e.line, e.message)} />`}</Code>
      <Frame><Mock source={small} error={{ line: 4, message: "expected a node after '-->'" }} /></Frame>
      <p>The rest of the page still renders.</p>
    </Page>
  ),
}

/** An update that cannot be drawn (someone typing in an editor): the last good diagram stays, with a strip. */
export const UpdateError: StoryObj = {
  render: () => <Page title="While editing"><Frame><Mock source={small} staleError={{ line: 7, message: "unclosed subgraph 'CDN'" }} /></Frame></Page>,
}

/** Before layout finishes. */
export const Loading: StoryObj = {
  render: () => <Page title="Loading"><Frame><Mock source={small} loading /></Frame></Page>,
}

/** Two diagrams on one page: each has its own camera and toolbar; changing one leaves the other still. */
export const TwoOnOnePage: StoryObj = {
  render: () => (
    <Page title="Two diagrams">
      <p>A flowchart (sample.mmd) and a sequence (the made-up login flow), one under the other.</p>
      <Frame height={320}><Mock source={small} /></Frame>
      <Frame height={320}><Mock source={login} mode="flat" /></Frame>
    </Page>
  ),
}

/** Full window: the component in a container that is the whole viewport, as the playground uses it. */
export const FullWindow: StoryObj = {
  render: () => <div style={{ width: '100vw', height: '100vh' }}><Mock source={small} /></div>,
}

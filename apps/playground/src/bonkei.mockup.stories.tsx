import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Bonkei } from 'bonkei'
import { SAMPLES } from './samples'

// BON-51: <Bonkei /> inside someone else's page. Every diagram and page text below is sample data.

const Spy = ({ log }: { log: string[] }) => <pre style={{ font: '11px ui-monospace, monospace', color: '#555', margin: '4px 0 0' }}>{log.length ? log.join('\n') : 'onError: not called'}</pre>

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
${small}`

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
      <Frame><Bonkei source={small} /></Frame>
      <p>The rest of the page carries on below. With the pointer over the diagram the wheel zooms it, as dragging pans it.</p>
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
      <Frame><Bonkei source={small} mode="3d" /></Frame>
    </Page>
  ),
}

/** Options written in the diagram itself, under config.bonkei: flat, labels standing up, no toolbar. */
export const OptionsInFrontmatter: StoryObj = {
  render: () => (
    <Page title="Options in the diagram">
      <p>The author sets the view in the diagram's own frontmatter, so it looks the same everywhere it is pasted. Props on the component win over these.</p>
      <Code>{withFrontmatter.split('\n').slice(0, 8).join('\n') + '\n    …'}</Code>
      <Frame><Bonkei source={withFrontmatter} /></Frame>
    </Page>
  ),
}

/** The controls setting: on (the default), off, or on with some turned off. Scroll and drag over each. */
export const ControlsSetting: StoryObj = {
  render: () => (
    <Page title="Controls">
      <p><b>controls on</b> (default): wheel or pinch zooms, drag pans (orbits in 3d), nodes can be moved, a tray click flies in.</p>
      <Code>{`<Bonkei source={diagram} />`}</Code>
      <Frame height={260}><Bonkei source={small} /></Frame>
      <p><b>controls off</b>: a picture. Nothing moves; the wheel scrolls the page. The toolbar is its own setting and still works.</p>
      <Code>{`<Bonkei source={diagram} controls={false} />`}</Code>
      <Frame height={260}><Bonkei source={small} controls={false} /></Frame>
      <p><b>some off</b>: name the ones to turn off; the rest stay on. Here zoom is off, so the wheel scrolls the page but dragging still pans.</p>
      <Code>{`<Bonkei source={diagram} controls={{ zoom: false }} />
// also: pan, move, drillIn`}</Code>
      <Frame height={260}><Bonkei source={small} controls={{ zoom: false }} /></Frame>
      <p>The same in the diagram's frontmatter:</p>
      <Code>{`config:
  bonkei:
    controls: false        # or:
    controls:
      zoom: false`}</Code>
      <div style={{ height: 400 }} />
    </Page>
  ),
}

/** Toolbar off, by prop: a fixed picture with nothing on top of it. */
export const NoToolbar: StoryObj = {
  render: () => <Page title="Toolbar off"><Code>{`<Bonkei source={diagram} toolbar={false} />`}</Code><Frame><Bonkei source={small} toolbar={false} /></Frame></Page>,
}

/** A source that cannot be drawn: an inline message where the diagram would be, and onError is called. No throw. */
export const ParseError: StoryObj = {
  render: () => {
    const [log, setLog] = useState<string[]>([])
    return (
      <Page title="A broken diagram">
        <Code>{`<Bonkei source={diagram} onError={e => console.warn(e.line, e.message)} />`}</Code>
        <Frame><Bonkei source={'flowchart TD\n  this is not a diagram\n  ???'} onError={e => setLog(l => [...l, `${e.severity} line ${e.line}: ${e.message}`])} /></Frame>
        <Spy log={log} />
        <p>The rest of the page still renders.</p>
      </Page>
    )
  },
}

/** An update that cannot be drawn (someone typing in an editor): the last good diagram stays, with a strip. */
export const UpdateError: StoryObj = {
  render: () => {
    const [broken, setBroken] = useState(false)
    const [log, setLog] = useState<string[]>([])
    return (
      <Page title="While editing">
        <button onClick={() => setBroken(b => !b)}>{broken ? 'Fix the source' : 'Edit the source so it breaks'}</button>
        <Frame><Bonkei source={broken ? 'flowchart TD\n  ???' : small} onError={e => setLog(l => [...l, `${e.severity} line ${e.line}: ${e.message}`])} /></Frame>
        <Spy log={log} />
      </Page>
    )
  },
}

/** Before layout finishes: the big sample takes a moment. Reload the story to see it. */
export const Loading: StoryObj = {
  render: () => <Page title="Loading"><Frame><Bonkei source={SAMPLES[Object.keys(SAMPLES).find(k => k.includes('large')) ?? Object.keys(SAMPLES)[0]]} /></Frame></Page>,
}

/** Two diagrams on one page: each has its own camera and toolbar; changing one leaves the other still. */
export const TwoOnOnePage: StoryObj = {
  render: () => (
    <Page title="Two diagrams">
      <p>A flowchart (sample.mmd) and a sequence (the made-up login flow), one under the other.</p>
      <Frame height={320}><Bonkei source={small} /></Frame>
      <Frame height={320}><Bonkei source={login} mode="flat" /></Frame>
    </Page>
  ),
}

/** Full window: the component in a container that is the whole viewport, as the playground uses it */
export const FullWindow: StoryObj = {
  render: () => <div style={{ width: '100vw', height: '100vh' }}><Bonkei source={small} /></div>,
}

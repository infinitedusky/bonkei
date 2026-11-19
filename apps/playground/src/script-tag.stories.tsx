// The script-tag bundle (BON-52): a plain HTML page with no build step that loads only bonkei.global.js and calls
// Bonkei.render(). Each story frames that page as scripts/copy-embed.mjs writes it from packages/core/dist.
// The diagram on the page is MADE-UP SAMPLE DATA, labelled 'sample data: …' on the page.
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'Script tag' }
export default meta
type Story = StoryObj

function Framed({ src, note }: { src: string; note: string }) {
  return (
    <div style={{ background: '#0f1218', color: '#cfd8ea', font: '14px system-ui, sans-serif', padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 8px' }}>{note}</p>
      <iframe title="script-tag page" src={src} style={{ width: 760, height: 420, border: '1px solid #3a4560' }} />
    </div>
  )
}

/** bonkei.global.js with libavoid.wasm and fonts/ beside it: the default look on top, the Bonkei theme (labels in its bundled font) below;
 * the lines are routed by libavoid; the page says how long it took. */
export const ScriptTag: Story = {
  render: () => <Framed src="embed/index.html" note="A plain HTML page: one <script src=&quot;bonkei.global.js&quot;>, then Bonkei.render(el, source)." />,
}

/** The same page with libavoid.wasm missing: the diagram still draws with ELK's routes, and the page shows routingError. */
export const ScriptTagWasmMissing: Story = {
  render: () => <Framed src="embed/no-wasm/index.html" note="The same page with libavoid.wasm left out on purpose." />,
}

// ---- BON-53: examples/html, the <bonkei-diagram> element and Bonkei.run(). copy-embed.mjs puts it at embed/elements/.
// Each story below is the same page; `act` drives it once it has loaded (as a reader's clicks would), to show one state.
// The diagrams on the page are MADE-UP SAMPLE DATA, labelled as such at the top of the page.
type PageWindow = Window & { Bonkei?: { run(o?: { querySelector?: string }): number } }
function ElementsPage({ note, act }: { note: string; act?: (doc: Document, win: PageWindow) => void }) {
  return (
    <div style={{ background: '#0f1218', color: '#cfd8ea', font: '14px system-ui, sans-serif', padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 8px' }}>{note}</p>
      <iframe
        title="script-tag elements page"
        src="embed/elements/index.html"
        style={{ width: 820, height: 1900, border: '1px solid #3a4560', background: '#fff' }}
        onLoad={e => { const w = e.currentTarget.contentWindow as PageWindow | null; if (act && w) act(w.document, w) }}
      />
    </div>
  )
}
const click = (doc: Document, id: string) => (doc.getElementById(id) as HTMLButtonElement | null)?.click()

/** Two <bonkei-diagram> elements and nothing else: a flowchart at the default 420 px, a sequence diagram at height="600" in the
 * Bonkei theme. The two <pre class="mermaid"> blocks at the bottom stay text: the page has not asked for them. */
export const Elements: Story = {
  render: () => <ElementsPage note="examples/html: one <script>, two <bonkei-diagram> elements, no build step. The pre.mermaid blocks stay text." />,
}

/** After Bonkei.run(): the flowchart block is now a diagram; the pie chart is not a type Bonkei draws, so it stays text. */
export const ElementsAfterRun: Story = {
  render: () => <ElementsPage note="The same page after the Convert button (Bonkei.run()): the flowchart block draws, the pie stays text." act={doc => click(doc, 'run')} />,
}

/** Add twice, remove once: one added 300 px diagram draws under "Add and remove"; the removed one is gone with its canvas. */
export const ElementsAddedAndRemoved: Story = {
  render: () => <ElementsPage note="Add a diagram twice, then Remove the last one: one added diagram (Added 1) is left and draws." act={doc => { click(doc, 'add'); click(doc, 'add'); click(doc, 'remove') }} />,
}

/** An element whose text is not a diagram Bonkei can read: the element shows Bonkei's error card in its box and fires bonkei-error. */
export const ElementWithABadSource: Story = {
  render: () => (
    <ElementsPage
      note="An element added with a broken source (made up): its box shows the error card; the rest of the page is unaffected."
      act={doc => {
        const el = doc.createElement('bonkei-diagram')
        el.setAttribute('height', '200')
        el.textContent = 'flowchart TD\n  --> -->'
        doc.getElementById('slot')?.appendChild(el)
      }}
    />
  ),
}

/** BON-195: the flowchart element's theme attribute set to bonkei once it has drawn: the same view, redrawn in the new theme (the
 * element calls the handle's setTheme; it no longer draws afresh). Zoom in on the flowchart before the switch to see the view kept. */
export const ElementThemeChanged: Story = {
  render: () => (
    <ElementsPage
      note="The first <bonkei-diagram>'s theme attribute is set to bonkei 4 s after the page loads (made-up sample): zoom in first; the view stays."
      act={doc => { setTimeout(() => doc.querySelector('bonkei-diagram')?.setAttribute('theme', 'bonkei'), 4000) }}
    />
  ),
}

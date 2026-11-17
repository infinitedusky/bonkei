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

/** bonkei.global.js with libavoid.wasm beside it: the lines are routed by libavoid; the page says how long it took. */
export const ScriptTag: Story = {
  render: () => <Framed src="embed/index.html" note="A plain HTML page: one <script src=&quot;bonkei.global.js&quot;>, then Bonkei.render(el, source)." />,
}

/** The same page with libavoid.wasm missing: the diagram still draws with ELK's routes, and the page shows routingError. */
export const ScriptTagWasmMissing: Story = {
  render: () => <Framed src="embed/no-wasm/index.html" note="The same page with libavoid.wasm left out on purpose." />,
}

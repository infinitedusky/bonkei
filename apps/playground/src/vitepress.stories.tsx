// The VitePress plugin (BON-53): examples/vitepress, built by scripts/build-vitepress-embed.mjs into public/embed/vitepress/.
// The stories frame the real built site. Its diagrams are MADE-UP SAMPLE DATA, labelled as such on the page.
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'VitePress' }
export default meta
type Story = StoryObj

function Site({ page, note, scripts = true }: { page: string; note: string; scripts?: boolean }) {
  return (
    <div style={{ background: '#0f1218', color: '#cfd8ea', font: '14px system-ui, sans-serif', padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 8px' }}>{note}</p>
      <iframe
        title="vitepress example"
        src={`embed/vitepress/${page}`}
        // sandbox without allow-scripts: the page as the server sent it, before any JavaScript runs
        {...(scripts ? {} : { sandbox: 'allow-same-origin' })}
        style={{ width: 1100, height: 2200, border: '1px solid #3a4560', background: '#fff' }}
      />
    </div>
  )
}

/** The diagrams page: a flowchart and a sequence diagram at the site-wide 420 px, a flowchart with {height=600}, and a pie fence
 * left as VitePress's code block (not an error card). */
export const DiagramsPage: Story = {
  render: () => <Site page="diagrams.html" note="examples/vitepress, built: ```mermaid fences drawn by Bonkei; the pie fence stays a code block." />,
}

/** The same page with scripts off: the server HTML already holds a box of each diagram's height (420, 420, 600), so the
 * paragraph below sits where it will be once they draw. */
export const DiagramsPageBeforeScripts: Story = {
  render: () => <Site page="diagrams.html" scripts={false} note="The server-rendered HTML with no JavaScript: empty boxes of the set heights hold the space." />,
}

/** The home page has no diagram: in the network panel no bonkei, React, three, ELK, wasm or font file is fetched. */
export const PageWithoutADiagram: Story = {
  render: () => <Site page="index.html" note="The home page: no diagram, so Bonkei, React and three are not downloaded." />,
}

/** What Mintlify allows, and the likely route there (research, not tried). */
export const MintlifyNotes: Story = {
  render: () => <Site page="mintlify.html" note="examples/vitepress/mintlify.md: the Mintlify research page." />,
}

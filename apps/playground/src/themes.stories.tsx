// Themes: Classic, Bonkei and Bonkei · landscape, each in flat, iso and 3D, plus the three ways to pick one and the
// warning for a name nobody knows. The diagram is the one in sketches/brand-theme.html; MADE-UP SAMPLE DATA.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Bonkei, type BonkeiWarning, type Mode } from 'bonkei'
import { SAMPLES, bonkeiMockup } from './samples'

const meta: Meta<typeof Bonkei> = { title: 'Themes', component: Bonkei, parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj<typeof Bonkei>

const stage = (h = '100vh'): Decorator => Story => <div style={{ height: h, background: '#888' }}><Story /></div>
const draw = (theme: string, mode: Mode): Story => ({ args: { source: bonkeiMockup, theme, mode, toolbar: true }, decorators: [stage()] })

export const ClassicFlat = draw('classic', 'flat')
export const ClassicIso = draw('classic', 'iso')
export const Classic3D = draw('classic', '3d')
export const BonkeiFlat = draw('bonkei', 'flat')
export const BonkeiIso = draw('bonkei', 'iso')
export const Bonkei3D = draw('bonkei', '3d')
export const LandscapeFlat = draw('bonkei-landscape', 'flat')
export const LandscapeIso = draw('bonkei-landscape', 'iso')
export const Landscape3D = draw('bonkei-landscape', '3d')

// The sequence diagram in both Bonkei looks.
export const BonkeiSequence: Story = { args: { source: SAMPLES['seq: login flow'], theme: 'bonkei', mode: 'iso' }, decorators: [stage()] }
export const LandscapeSequence: Story = { args: { source: SAMPLES['seq: login flow'], theme: 'bonkei-landscape', mode: 'iso' }, decorators: [stage()] }

// The theme and one overridden token, chosen by the diagram's own frontmatter (config.theme, config.themeVariables).
export const FromFrontmatter: Story = {
  args: { source: `---\nconfig:\n  theme: bonkei\n  themeVariables:\n    node.form: landscape\n    edge.width: 3\n---\n${bonkeiMockup}`, mode: 'iso' },
  decorators: [stage()],
}

// Flat edges: lines lie on the surface under them and the arrowhead is a flat triangle (themeVariables: edge.flat).
export const FlatEdgesBonkei: Story = { args: { source: `---\nconfig:\n  theme: bonkei\n  themeVariables:\n    edge.flat: true\n---\n${bonkeiMockup}`, mode: 'iso' }, decorators: [stage()] }
export const FlatEdgesLandscape: Story = { args: { source: `---\nconfig:\n  theme: bonkei\n  themeVariables:\n    node.form: landscape\n    edge.flat: true\n---\n${bonkeiMockup}`, mode: '3d' }, decorators: [stage()] }
export const FlatEdgesClassic: Story = { args: { source: `---\nconfig:\n  themeVariables:\n    edge.flat: true\n---\n${bonkeiMockup}`, mode: 'iso' }, decorators: [stage()] }

// A name nobody knows: drawn in Classic, with a warning that onWarning receives (shown here).
export const UnknownThemeWarns: Story = {
  render: () => {
    const [w, setW] = useState<BonkeiWarning[]>([])
    return (
      <div style={{ height: '100vh', position: 'relative' }}>
        <Bonkei source={`---\nconfig:\n  theme: sumi-e\n---\n${bonkeiMockup}`} onWarning={x => setW(p => [...p, x])} />
        <div role="status" style={{ position: 'absolute', left: 12, bottom: 12, background: '#4a3a10', color: '#ffd479', padding: '6px 12px', borderRadius: 6, font: '12px monospace' }}>
          {w.length ? w.map(x => `${x.kind} warning, line ${x.line}: ${x.message}`).join('\n') : 'no warning yet'}
        </div>
      </div>
    )
  },
}

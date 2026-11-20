// Themes: Classic, Bonkei, Bonkei · landscape and Blueprint, each in flat, iso and 3D, plus the three ways to pick one and the
// warning for a name nobody knows. The diagram is the one in sketches/brand-theme.html; MADE-UP SAMPLE DATA.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Bonkei, type BonkeiWarning, type Mode } from 'bonkei'
import { SAMPLES, bonkeiMockup } from './samples'
import { TRENCH_THEMES, own, preset, trenchSource, type TrenchPreset, type TrenchState, type TrenchTheme } from '../../../docs/.vitepress/theme/trench'

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
export const BlueprintFlat = draw('blueprint', 'flat')
export const BlueprintIso = draw('blueprint', 'iso')
export const Blueprint3D = draw('blueprint', '3d')

// The sequence diagram in both Bonkei looks.
export const BonkeiSequence: Story = { args: { source: SAMPLES['seq: login flow'], theme: 'bonkei', mode: 'iso' }, decorators: [stage()] }
export const BlueprintSequence: Story = { args: { source: SAMPLES['seq: login flow'], theme: 'blueprint', mode: 'iso' }, decorators: [stage()] }
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

// The theme given to the component (the `theme` prop) wins over the frontmatter's config.theme.
export const ByProp: Story = { args: { source: `---\nconfig:\n  theme: classic\n---\n${bonkeiMockup}`, theme: 'bonkei-landscape', mode: 'iso' }, decorators: [stage()] }

// One setting overridden for one diagram only: the left diagram sets themeVariables edge.flat: true, the right one is the same theme untouched.
export const OverrideBesideDefault: Story = {
  render: () => (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: '#888' }}>
      <Bonkei source={`---\nconfig:\n  theme: bonkei\n  themeVariables:\n    edge.flat: true\n---\n${bonkeiMockup}`} mode="iso" toolbar={false} />
      <Bonkei source={`---\nconfig:\n  theme: bonkei\n---\n${bonkeiMockup}`} mode="iso" toolbar={false} />
    </div>
  ),
}

// The large sample in Bonkei · landscape, for the frame rate (the playground's readout shows fps).
export const LandscapeLarge: Story = { args: { source: SAMPLES['flow: large (~50 nodes)'], theme: 'bonkei-landscape', mode: 'iso' }, decorators: [stage()] }

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

// BON-181: a tunnel in each theme, iso and 3D. Classic lights its trench (a grey-white floor light and wall wash at 30%, no rim);
// Bonkei and Bonkei · landscape leave the light off and keep their dark rim, as before. The diagram is trench.ts's tunnel sample,
// the one on the docs' Edge styles page: MADE-UP SAMPLE DATA (a web app, an API, a CDN).
const tunnel = (theme: TrenchTheme, mode: Mode, vars: Record<string, string | number | null> = {}): Story => ({
  args: {
    source: trenchSource(theme, own(theme)).replace(/\n---\nflowchart/, (Object.keys(vars).length ? '\n  themeVariables:\n' + Object.entries(vars).map(([k, v]) => `    ${k}: ${v === null ? 'null' : JSON.stringify(v)}`).join('\n') : '') + '\n---\nflowchart'),
    mode, toolbar: true,
  },
  decorators: [stage()],
})
export const TunnelClassicIso = tunnel('classic', 'iso')
export const TunnelClassic3D = tunnel('classic', '3d')
export const TunnelBonkeiIso = tunnel('bonkei', 'iso')
export const TunnelBonkei3D = tunnel('bonkei', '3d')
export const TunnelLandscapeIso = tunnel('bonkei-landscape', 'iso')
export const TunnelLandscape3D = tunnel('bonkei-landscape', '3d')
// the light switched on in a Bonkei diagram through its own themeVariables
const warm = { 'edge.glow.core': '#ffc873', 'edge.glow.halo': '#ffc873', 'edge.glow.wash': '#ffc873' }
export const TunnelBonkeiLightOn = tunnel('bonkei', 'iso', warm)
export const TunnelLandscapeLightOn = tunnel('bonkei-landscape', '3d', warm)
// the diagram's own rim wins over the theme's: a thin teal rim (edge.rim, edge.rimWidth)
export const TunnelOwnRim = tunnel('bonkei', 'iso', { 'edge.rim': '#3fd0c0', 'edge.rimWidth': 1.5 })
// light only: the light out of the floor, no wall wash, no rim
export const TunnelClassicLightOnly = tunnel('classic', 'iso', { 'edge.glow.wash': null, 'edge.rim': 'none' })
// a value the trench light does not take: drawn with the theme's light, and a warning per bad variable (shown here)
export const TunnelBadLightWarns: Story = {
  render: () => {
    const [w, setW] = useState<BonkeiWarning[]>([])
    const src = trenchSource('classic', own('classic')).replace('\n---\nflowchart', '\n  themeVariables:\n    edge.glow: dim\n    edge.glow.coreWidth: -2\n    edge.rim: off\n---\nflowchart')
    return (
      <div style={{ height: '100vh', position: 'relative', background: '#888' }}>
        <Bonkei source={src} mode="iso" onWarning={x => setW(p => [...p, x])} />
        <div role="status" style={{ position: 'absolute', left: 12, bottom: 12, background: '#4a3a10', color: '#ffd479', padding: '6px 12px', borderRadius: 6, font: '12px monospace', whiteSpace: 'pre' }}>
          {w.length ? w.map(x => `${x.kind} warning, line ${x.line}: ${x.message}`).join('\n') : 'no warning yet'}
        </div>
      </div>
    )
  },
}

// The trench light controls on the docs' Edge styles page, with Storybook's controls: each one writes themeVariables into the diagram's
// frontmatter by the same rules (trench.ts), shown under the diagram. Starts at Classic's own look; preset applies Theme default, Light
// only (the floor light alone) or All off over the rest.
type Light = TrenchState & { theme: TrenchTheme; mode: Mode; preset: 'none' | TrenchPreset }
export const TunnelLightControls: StoryObj<Light> = {
  args: { theme: 'classic', mode: 'iso', preset: 'none', ...own('classic') },
  argTypes: {
    theme: { control: 'inline-radio', options: [...TRENCH_THEMES] }, mode: { control: 'inline-radio', options: ['iso', '3d'] },
    preset: { control: 'inline-radio', options: ['none', 'default', 'light-only', 'off'] },
    colour: { control: 'color' }, strength: { control: { type: 'range', min: 0, max: 100 } },
  },
  render: ({ theme, mode, preset: p, ...rest }) => {
    const s = p === 'none' ? rest : preset(theme, p, rest)
    const src = trenchSource(theme, s)
    return (
      <div style={{ height: '100vh', display: 'grid', gridTemplateRows: '1fr auto', background: '#888' }}>
        <Bonkei source={src} mode={mode} toolbar />
        <pre style={{ margin: 0, padding: 8, background: '#222', color: '#ddd', font: '12px monospace' }}>{src.split('---')[1].trim()}</pre>
      </div>
    )
  },
}

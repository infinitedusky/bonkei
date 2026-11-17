import type { Meta, StoryObj } from '@storybook/react-vite'
// MOCKUPS for the idea "Brand from traditional bonkei art". Made-up data: the site's sample
// flowchart (sample.mmd); the Bonkei theme stills are pictures of the sketch, not the engine.
import { BrandHome } from './BrandHome'
import { Themes } from './Themes'
import { Logo, SmallMark } from './Marks'
import './brand.css'

const meta: Meta<typeof BrandHome> = { title: 'Mockups/Brand', component: BrandHome }
export default meta
type Story = StoryObj<typeof BrandHome>

// The home page in the brand; the hero is the live scene in Classic.
export const Home: Story = { args: { live: true } }
export const HomePhone: Story = { args: { live: false }, globals: { viewport: { value: 'mobile2', isRotated: false } } }

// The new Themes section on its own, starting on each theme.
const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="site brand" style={{ minHeight: 'auto', padding: '32px 0' }}><div className="site-wrap">{children}</div></div>
)
export const ThemesSection: StoryObj<typeof Themes> = { render: () => <Page><h2>Use themes to see how far you can go</h2><Themes /></Page> }
export const ThemesSectionClassic: StoryObj<typeof Themes> = { render: () => <Page><Themes start="classic" /></Page> }

// The marks: Logo from 32 px up; SmallMark (favicon, tab) only below that.
const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--mute)' }}>{children}{label}</div>
)
export const Marks: StoryObj<typeof Logo> = {
  render: () => (
    <Page>
      <h2>Logo</h2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        {[160, 96, 64, 48, 32].map(n => <Cell key={n} label={`${n}`}><Logo size={n} /></Cell>)}
      </div>
      <h2 style={{ marginTop: 40 }}>Small mark (favicon, tab)</h2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        {[64, 32, 16].map(n => <Cell key={n} label={`${n}`}><SmallMark size={n} /></Cell>)}
      </div>
      <h2 style={{ marginTop: 40 }}>Lockups</h2>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div className="site-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Logo size={56} /><span style={{ font: "700 30px 'Zen Old Mincho', serif" }}>Bonkei</span></div>
        <div className="site-card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#14161c' }}><Logo size={56} /><span style={{ font: "700 30px 'Zen Old Mincho', serif", color: '#efe6d0' }}>Bonkei</span></div>
      </div>
    </Page>
  ),
}

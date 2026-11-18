import type { Meta, StoryObj } from '@storybook/react-vite'
// The home page in the brand drawn from the bonkei prints. MADE-UP SAMPLE DATA: the site's sample flowchart
// (sample.mmd) in the hero and "How it works", and the Themes section's diagram (themes-sample.ts).
import { Home } from './Home'
import { Themes } from './Themes'
import { Logo, SmallMark } from './Marks'
import './site.css'

const meta: Meta<typeof Home> = { title: 'Mockups/Brand', component: Home }
export default meta
type Story = StoryObj<typeof Home>
const at = (value: string) => ({ viewport: { value, isRotated: false } })

// The whole page: logo in nav and footer, every section, the hero in Classic, the Themes section live.
export const Home_: Story = { name: 'Home', args: { live: true, themesLive: true } }
// The same page at a phone's, a tablet's and a landscape tablet's width (the hero shows its poster on phones).
export const HomePhone390: Story = { name: 'Home 390', args: { live: false, themesLive: true }, globals: at('phone390') }
export const HomeTablet820: Story = { name: 'Home 820', args: { live: true, themesLive: true }, globals: at('tablet820') }
export const HomeTablet1024: Story = { name: 'Home 1024', args: { live: true, themesLive: true }, globals: at('tablet1024') }
// No WebGL: the hero shows its poster and the Themes section says why there is no diagram.
export const HomeNoWebGL: Story = { name: 'Home without WebGL', args: { live: false, themesLive: false } }

// The Themes section on its own, opening on each theme.
const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="site" style={{ minHeight: 'auto', padding: '32px 0' }}><div className="site-wrap">{children}</div></div>
)
type ThemesStory = StoryObj<typeof Themes>
export const ThemesSection: ThemesStory = { name: 'Themes section', render: () => <Page><h2>Use themes to see how far you can go</h2><Themes live /></Page> }
export const ThemesSectionBonkei: ThemesStory = { name: 'Themes section, Bonkei', render: () => <Page><Themes live start="bonkei" /></Page> }
export const ThemesSectionClassic: ThemesStory = { name: 'Themes section, Classic', render: () => <Page><Themes live start="classic" /></Page> }
export const ThemesSection390: ThemesStory = { name: 'Themes section 390', render: () => <Page><Themes live /></Page>, globals: at('phone390') }
export const ThemesSection820: ThemesStory = { name: 'Themes section 820', render: () => <Page><Themes live /></Page>, globals: at('tablet820') }

// The marks: Logo from 32 px up; SmallMark (favicon, tab) only below that.
const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--mute)' }}>{children}{label}</div>
)
export const Marks: StoryObj<typeof Logo> = {
  render: () => (
    <Page>
      <h2>Logo</h2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {[160, 96, 64, 48, 32].map(n => <Cell key={n} label={`${n}`}><Logo size={n} /></Cell>)}
      </div>
      <h2 style={{ marginTop: 40 }}>Small mark (favicon, tab)</h2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        {[64, 32, 16].map(n => <Cell key={n} label={`${n}`}><SmallMark size={n} /></Cell>)}
      </div>
      <h2 style={{ marginTop: 40 }}>Lockups</h2>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div className="site-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Logo size={56} /><span style={{ font: '700 30px var(--serif)' }}>Bonkei</span></div>
        <div className="site-card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#14161c' }}><Logo size={56} /><span style={{ font: '700 30px var(--serif)', color: '#efe6d0' }}>Bonkei</span></div>
      </div>
    </Page>
  ),
}

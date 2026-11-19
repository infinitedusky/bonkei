import type { Meta, StoryObj } from '@storybook/react-vite'
// Sample data: the repo's demo flowchart (sample.mmd) and the made-up 'seq: login flow' sample (login.ts).
import sample from './sample.mmd?raw'
import { login } from './login'
import { Home } from './Home'
import { Hero } from './Hero'
import './site.css'

const meta: Meta<typeof Home> = { title: 'Screens/Site', component: Home }
export default meta
type Story = StoryObj<typeof Home>

// The page's three states. `live` forces the gate so each story looks the same at any window size.
// No `name` arg: the screens show Home's default, the Bonkei brand, and its GitHub link.
export const Desktop: Story = { args: { live: true } }

export const Phone: Story = {
  args: { name: 'Bonkei', live: false },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

export const NoWebGL: Story = { args: { name: 'Bonkei', live: false } }

// The hero on its own, through the wrapper (an empty stage, then the lazily loaded live scene fading in; no picture first).
const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="site" style={{ padding: 24, minHeight: 'auto' }}>
    <div className="site-wrap"><div className="site-note" style={{ textAlign: 'left' }}>sample data: {label}</div>{children}</div>
  </div>
)

export const HeroAutoplay: StoryObj<typeof Hero> = {
  render: () => <Wrap label="small flowchart (sample.mmd)"><Hero live source={sample} /></Wrap>,
}
export const HeroPicked3D: StoryObj<typeof Hero> = {
  render: () => <Wrap label="small flowchart (sample.mmd)"><Hero live source={sample} start="3d" autoplay={false} /></Wrap>,
}
export const HeroSequence: StoryObj<typeof Hero> = {
  render: () => <Wrap label="login sequence (made up, login.ts 'seq: login flow')"><Hero live source={login} /></Wrap>,
}
export const HeroPosterOnly: StoryObj<typeof Hero> = {
  render: () => <Wrap label="device that can't draw live: the poster, caption and source button"><Hero live={false} source={sample} /></Wrap>,
}

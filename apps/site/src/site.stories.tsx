import type { Meta, StoryObj } from '@storybook/react-vite'
// Sample data: the repo's demo flowchart (sample.mmd) and the made-up 'seq: login flow' sample (login.ts).
import sample from './sample.mmd?raw'
import { login } from './login'
import { Home } from './Home'
import { Hero } from './Hero'
import { Themes } from './Themes'
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
export const HeroLoading: StoryObj<typeof Hero> = {
  render: () => <Wrap label="small flowchart (sample.mmd), the scene's chunk held back: the empty stage a desktop sees while it loads; no picture"><Hero live holdLoad source={sample} /></Wrap>,
}
export const HeroPosterOnly: StoryObj<typeof Hero> = {
  render: () => <Wrap label="small flowchart (sample.mmd) on a device that can't draw it live: the poster, caption and source button"><Hero live={false} source={sample} /></Wrap>,
}
export const HeroSceneFailedToLoad: StoryObj<typeof Hero> = {
  render: () => <Wrap label="small flowchart (sample.mmd), the scene's chunk failing to load: the poster instead, the page stays"><Hero live failLoad source={sample} /></Wrap>,
}
// The scene loads but reports an error before its first frame (as when it can't make its WebGL context after the gate's
// probe passed). Here a made-up source it can't read makes it report one: the poster takes the stage, never an empty one.
export const HeroSceneError: StoryObj<typeof Hero> = {
  render: () => <Wrap label="made up: a source the scene can't read ('not a diagram'), so it reports an error before drawing: the poster instead"><Hero live source="not a diagram" /></Wrap>,
}

// The Themes section on its own with Blueprint picked: its button pressed, its frontmatter shown, the made-up THEMES_DIAGRAM
// (themes-sample.ts) drawn live in Blueprint.
export const ThemesBlueprint: StoryObj<typeof Themes> = {
  render: () => <Wrap label="the Themes section's diagram (made up, themes-sample.ts), theme blueprint"><Themes live start="blueprint" /></Wrap>,
}
// The same with Cloud Cartography picked (where Map was): its button pressed, theme: cloud-cartography in the frontmatter, the
// same made-up diagram drawn live as a map: zone floors named on the ground, icons under cards, navy links with a mid arrow.
export const ThemesCloudCartography: StoryObj<typeof Themes> = {
  render: () => <Wrap label="the Themes section's diagram (made up, themes-sample.ts), theme cloud-cartography"><Themes live start="cloud-cartography" /></Wrap>,
}

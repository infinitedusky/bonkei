import type { Meta, StoryObj } from '@storybook/react-vite'
import App from './App'

// The whole screen as the user sees it (the page index.html gives it: full height, dark background).
const meta: Meta<typeof App> = {
  title: 'Merman/App',
  component: App,
  decorators: [(Story) => <div style={{ height: '100vh', background: '#0f1218', overflow: 'hidden', font: '13px system-ui' }}><Story /></div>],
}
export default meta

export const Default: StoryObj<typeof App> = {}

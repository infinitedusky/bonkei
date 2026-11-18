// The BUILT docs (BON-127), framed at the viewport's own width: the iframe is 100% wide, so the toolbar's Phone 390 / Tablet 820 /
// Tablet 1024 switch really changes the page's width (a fixed-width iframe would not). The site is docs/.vitepress/dist, served at /docs/
// by main.ts when it exists (`pnpm docs:build` first). Its diagrams are MADE-UP SAMPLE DATA.
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'Docs (built)', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj
const at = (value: string) => ({ viewport: { value, isRotated: false } })

function Docs({ page }: { page: string }) {
  return <iframe title={`docs ${page}`} src={`docs/${page}`} style={{ display: 'block', width: '100%', height: '100vh', border: 0, background: '#EFE6D0' }} />
}
const home = () => <Docs page="index.html" />
const feature = () => <Docs page="guide/edge-styles.html" />
const api = () => <Docs page="api/functions/render.html" />

export const Home390: Story = { name: 'Home 390', render: home, globals: at('phone390') }
export const Home820: Story = { name: 'Home 820', render: home, globals: at('tablet820') }
export const Home1024: Story = { name: 'Home 1024', render: home, globals: at('tablet1024') }
export const FeaturePage390: Story = { name: 'Feature page 390', render: feature, globals: at('phone390') }
export const FeaturePage820: Story = { name: 'Feature page 820', render: feature, globals: at('tablet820') }
export const FeaturePage1024: Story = { name: 'Feature page 1024', render: feature, globals: at('tablet1024') }
export const ApiPage390: Story = { name: 'API page 390', render: api, globals: at('phone390') }
export const ApiPage820: Story = { name: 'API page 820', render: api, globals: at('tablet820') }
export const ApiPage1024: Story = { name: 'API page 1024', render: api, globals: at('tablet1024') }

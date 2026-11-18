import type { Preview } from '@storybook/react-vite'
import { MINIMAL_VIEWPORTS } from 'storybook/viewport'
import './story-flow.css'

// The widths the site is checked at (phone, tablet portrait, tablet landscape), beside Storybook's own.
const px = (name: string, width: number, height: number, type: 'mobile' | 'tablet') => ({ name, styles: { width: `${width}px`, height: `${height}px` }, type })
const viewports = {
  ...MINIMAL_VIEWPORTS,
  phone390: px('Phone 390', 390, 844, 'mobile'),
  tablet820: px('Tablet 820', 820, 1180, 'tablet'),
  tablet1024: px('Tablet 1024', 1024, 768, 'tablet'),
}
const preview: Preview = { parameters: { layout: 'fullscreen', viewport: { options: viewports } } }
export default preview

// Demo pages for the prototype: the Mockups/Bonkei cases, served by Vite with no Storybook.
// /app/demos.html lists them; /app/demos.html?story=two-on-one-page shows one.
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import * as stories from './bonkei.mockup.stories'

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
const all = Object.entries(stories).filter(([k]) => k !== 'default').map(([k, v]) => ({ id: kebab(k), name: k, Story: (v as { render: ComponentType }).render }))
const id = new URLSearchParams(location.search).get('story')
const one = all.find(s => s.id === id)

createRoot(document.getElementById('root')!).render(
  one ? <one.Story /> : (
    <ul style={{ font: '15px/1.8 system-ui', padding: '32px 48px' }}>
      {all.map(s => <li key={s.id}><a href={`?story=${s.id}`}>{s.name}</a></li>)}
    </ul>
  ),
)

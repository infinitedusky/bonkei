// BON-78: how a reader moves a diagram, and how they find out, against the real component.
// Every diagram and page here is MADE-UP SAMPLE DATA, labelled where it is shown.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Bonkei } from 'bonkei'
import { GestureCard, Toolbar, UI, type Input, type Mode } from 'bonkei/internal'

// Made-up sample: a small shop backend, not a real system.
const FLOW = `flowchart LR
  subgraph Shop[Sample shop]
    Web[Web app] --> API(Orders API)
    API --> DB[(Orders DB)]
  end
  API -->|charge| Pay{Payments}
`

const meta: Meta = { title: 'Mockups/BON-78 Gestures', parameters: { layout: 'fullscreen' } }
export default meta

const inputArg = { control: 'inline-radio', options: ['trackpad', 'mouse', 'touch'] } as const
const modeArg = { control: 'inline-radio', options: ['flat', 'iso', '3d'] } as const

const Note = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'absolute', left: 10, bottom: 10, maxWidth: 560, padding: '6px 10px', background: '#000a', color: '#cfd8ea', font: '12px system-ui, sans-serif', borderRadius: 4, pointerEvents: 'none' }}>{children}</div>
)

/** The gesture card on its own: pick the input and the view in Controls. 3D's rows differ from flat and iso's. */
export const Card: StoryObj<{ input: Input; mode: Mode }> = {
  args: { input: 'trackpad', mode: 'iso' },
  argTypes: { input: inputArg, mode: modeArg },
  render: ({ input, mode }) => (
    <div style={{ minHeight: '100vh', background: '#0f1218', display: 'grid', placeItems: 'center' }}>
      <GestureCard input={input} mode={mode} />
    </div>
  ),
}

/** The toolbar with "?" beside Fit, its card open; the card follows the input picked in Controls and the view picked on the toolbar. */
export const ToolbarWithCard: StoryObj<{ input: Input }> = {
  args: { input: 'mouse' },
  argTypes: { input: inputArg },
  render: ({ input }) => {
    const [m, setM] = useState<Mode>('iso')
    const [open, setOpen] = useState(true)
    return (
      <div style={{ position: 'relative', height: '100vh', background: '#0f1218' }}>
        <Toolbar mode={m} onPick={setM} onFit={() => {}} input={input} helpOpen={open} onHelp={setOpen} />
      </div>
    )
  },
}

/**
 * A diagram that fills a page that does not scroll, so it always has the gestures: two-finger drag or the wheel moves,
 * pinch or ⌘/Ctrl + scroll zooms, a background drag moves (3D: turns), Shift + drag or right-drag turns (3D: moves),
 * flat and iso settle on a quarter turn, Fit puts it back square. "?" opens the card.
 */
export const FullPage: StoryObj<{ mode: Mode }> = {
  args: { mode: 'iso' },
  argTypes: { mode: modeArg },
  render: ({ mode }) => (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f1218' }}>
      <Bonkei source={FLOW} mode={mode} />
      <Note>Try: two-finger drag, pinch, drag, Shift + drag, right-drag, Shift + scroll in 3D, Fit, "?". sample data: a small shop backend.</Note>
    </div>
  ),
}

/**
 * A diagram in the middle of a page that scrolls, in a box with rounded corners (`radius`, px). Scrolling over it scrolls
 * the page and shows a hint; a click hands it the gestures (a ring that follows the box's corners, and "Esc to let go")
 * until Esc or a click outside. Pinch and ⌘/Ctrl + scroll zoom either way. Try radius 0 (square ring) and 40 (the chip moves in).
 */
export const InAPage: StoryObj<{ radius: number }> = {
  args: { radius: 8 },
  argTypes: { radius: { control: 'inline-radio', options: [0, 8, 12, 40] } },
  render: ({ radius }) => {
    const text: CSSProperties = { maxWidth: 680, margin: '0 auto', color: '#aab4c8', font: '16px/1.6 system-ui, sans-serif' }
    return (
      <div style={{ background: '#0b0e14', minHeight: '100vh', padding: '40px 20px' }}>
        <div style={text}>
          <h1 style={{ color: UI.text }}>Sample docs page</h1>
          <p>Made-up page text, so the page scrolls. Scroll down past the diagram: the page keeps scrolling when the pointer crosses it.</p>
          <div style={{ height: '50vh' }} />
        </div>
        <div style={{ maxWidth: 720, height: 420, margin: '0 auto', borderRadius: radius, overflow: 'hidden', border: `1px solid ${UI.border}` }}>
          <Bonkei source={FLOW} />
        </div>
        <div style={text}>
          <p>sample data: a small shop backend, in a box with {radius}px corners.</p>
          <div style={{ height: '100vh' }} />
        </div>
      </div>
    )
  },
}

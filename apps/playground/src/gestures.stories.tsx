// BON-78 mockups: how a reader moves a diagram, and how they find out. Design only: the diagram
// underneath still has today's gestures; the card, the "?" button and the page veil are drawn here.
// Every diagram and page here is MADE-UP SAMPLE DATA.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Bonkei } from 'bonkei'
import { UI } from 'bonkei/internal'

type Input = 'trackpad' | 'mouse' | 'touch'
type Mode = 'flat' | 'iso' | '3d'

// Made-up sample: a small shop backend, not a real system.
const FLOW = `flowchart LR
  subgraph Shop[Sample shop]
    Web[Web app] --> API(Orders API)
    API --> DB[(Orders DB)]
  end
  API -->|charge| Pay{Payments}
`

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

// What turning does in each view: flat and iso settle on the nearest quarter turn, 3D turns and tilts freely.
const TURN: Record<Mode, string> = {
  flat: 'Turn (settles square)',
  iso: 'Turn to another corner',
  '3d': 'Turn and tilt',
}

/** The gesture map, per input. The same in the viewer, the site and every story; only the turn row depends on the view. */
function rows(input: Input, mode: Mode): [string, string][] {
  if (input === 'trackpad') return [
    ['Two-finger drag', 'Move'],
    ['Pinch', 'Zoom'],
    ['Drag the background', 'Move'],
    ['⇧ Shift + drag', TURN[mode]],
  ]
  if (input === 'mouse') return [
    ['Drag the background', 'Move'],
    ['Scroll wheel', 'Move up and down (⇧ for sideways)'],
    [`${MOD} + scroll`, 'Zoom'],
    ['⇧ Shift + drag, or right-drag', TURN[mode]],
  ]
  return [
    ['One finger', 'Move'],
    ['Pinch', 'Zoom'],
    ['Two-finger twist', TURN[mode]],
    ...(mode === '3d' ? [['Two fingers up or down', 'Tilt'] as [string, string]] : []),
  ]
}

const panel: CSSProperties = { background: UI.panel, color: UI.text, border: `1px solid ${UI.border}`, borderRadius: 6, font: '13px system-ui, sans-serif' }
const btn = (on: boolean): CSSProperties => ({ padding: '4px 10px', border: 0, borderRadius: 4, cursor: 'pointer', font: '13px system-ui, sans-serif', background: on ? UI.on : 'transparent', color: UI.text })

/** The card behind the "?" button: what each gesture does, for the input the reader last used. */
function GestureCard({ input, mode, onClose }: { input: Input; mode: Mode; onClose?: () => void }) {
  return (
    <div role="dialog" aria-label="How to move the diagram" style={{ ...panel, width: 300, padding: '10px 12px', boxShadow: '0 8px 24px #0008' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
        <b style={{ flex: 1 }}>Move around</b>
        <span style={{ color: UI.muted, fontSize: 12 }}>{input}</span>
        {onClose && <button type="button" aria-label="Close" onClick={onClose} style={{ ...btn(false), padding: '0 0 0 10px', color: UI.muted }}>×</button>}
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {rows(input, mode).map(([g, a]) => (
            <tr key={g}>
              <td style={{ padding: '3px 10px 3px 0', color: UI.muted, whiteSpace: 'nowrap' }}>{g}</td>
              <td style={{ padding: '3px 0' }}>{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${UI.border}`, color: UI.muted, fontSize: 12 }}>
        Fit shows the whole diagram and puts it back square.
      </div>
    </div>
  )
}

/** Today's toolbar (View + Fit) with a "?" at the end that opens the card under it. */
function MockToolbar({ mode, onPick, open, onHelp }: { mode: Mode; onPick: (m: Mode) => void; open: boolean; onHelp: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div role="radiogroup" aria-label="View" style={{ ...panel, display: 'flex', padding: 2 }}>
        {(['flat', 'iso', '3d'] as Mode[]).map(m => (
          <button key={m} type="button" role="radio" aria-checked={m === mode} onClick={() => onPick(m)} style={btn(m === mode)}>{m === '3d' ? '3D' : m[0].toUpperCase() + m.slice(1)}</button>
        ))}
      </div>
      <button type="button" style={{ ...panel, ...btn(false), border: `1px solid ${UI.border}`, background: UI.panel }}>Fit</button>
      <button type="button" aria-label="How to move the diagram" aria-expanded={open} onClick={onHelp}
        style={{ ...panel, ...btn(open), border: `1px solid ${UI.border}`, background: open ? UI.on : UI.panel, width: 30, padding: '4px 0' }}>?</button>
    </div>
  )
}

const Note = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'absolute', left: 10, bottom: 10, maxWidth: 520, padding: '6px 10px', background: '#000a', color: '#cfd8ea', font: '12px system-ui, sans-serif', borderRadius: 4, pointerEvents: 'none' }}>{children}</div>
)

const meta: Meta = { title: 'Mockups/BON-78 Gestures', parameters: { layout: 'fullscreen' } }
export default meta

const inputArg = { control: 'inline-radio', options: ['trackpad', 'mouse', 'touch'] } as const
const modeArg = { control: 'inline-radio', options: ['flat', 'iso', '3d'] } as const

/** The gesture map on its own: pick the input and the view in Controls. */
export const Card: StoryObj<{ input: Input; mode: Mode }> = {
  args: { input: 'trackpad', mode: 'iso' },
  argTypes: { input: inputArg, mode: modeArg },
  render: ({ input, mode }) => (
    <div style={{ minHeight: '100vh', background: '#0f1218', display: 'grid', placeItems: 'center' }}>
      <GestureCard input={input} mode={mode} />
    </div>
  ),
}

/** The diagram with the "?" button beside Fit. The card shows the input the reader last used (here: Controls). Sample data. */
export const HelpButton: StoryObj<{ input: Input; open: boolean }> = {
  args: { input: 'trackpad', open: true },
  argTypes: { input: inputArg },
  render: ({ input, open: start }) => {
    const [mode, setMode] = useState<Mode>('iso')
    const [open, setOpen] = useState(start)
    useEffect(() => setOpen(start), [start])
    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f1218' }}>
        <Bonkei source={FLOW} mode={mode} toolbar={false} />
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <MockToolbar mode={mode} onPick={setMode} open={open} onHelp={() => setOpen(o => !o)} />
          {open && <GestureCard input={input} mode={mode} onClose={() => setOpen(false)} />}
        </div>
        <Note>Mockup: the toolbar and card are drawn over the diagram; the diagram still has today's gestures. sample data: a small shop backend.</Note>
      </div>
    )
  },
}

type Embed = 'resting' | 'hint' | 'active'

/**
 * A diagram in the middle of a page that scrolls. Scrolling over it scrolls the page; the first
 * scroll shows a hint for a moment. A click hands it the gestures (ring, "Esc to let go") until Esc
 * or a click outside. Pinch and ⌘/Ctrl + scroll always zoom. Try it, or step the states in Controls.
 */
export const InAPage: StoryObj<{ state: Embed; input: Input }> = {
  args: { state: 'resting', input: 'trackpad' },
  argTypes: { state: { control: 'inline-radio', options: ['resting', 'hint', 'active'] }, input: inputArg },
  render: ({ state: start, input }) => {
    const [state, setState] = useState<Embed>(start)
    useEffect(() => setState(start), [start])
    const box = useRef<HTMLDivElement>(null)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    useEffect(() => {
      const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setState('resting') }
      const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setState('resting') }
      window.addEventListener('pointerdown', down); window.addEventListener('keydown', key)
      return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key) }
    }, [])
    const wheel = (e: React.WheelEvent) => {
      if (state === 'active' || e.ctrlKey || e.metaKey) return
      setState('hint')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setState(s => (s === 'hint' ? 'resting' : s)), 1500)
    }
    const hint = input === 'touch' ? 'Use two fingers to move the diagram' : `Click to move the diagram · ${MOD} + scroll to zoom`
    const text: CSSProperties = { maxWidth: 680, margin: '0 auto', color: '#aab4c8', font: '16px/1.6 system-ui, sans-serif' }
    return (
      <div style={{ background: '#0b0e14', minHeight: '100vh', padding: '40px 20px' }}>
        <div style={text}>
          <h1 style={{ color: UI.text }}>Sample docs page</h1>
          <p>Made-up page text, so the page scrolls. Scroll down past the diagram: the page keeps scrolling when the pointer crosses it.</p>
          <div style={{ height: '50vh' }} />
        </div>
        <div ref={box} onWheel={wheel} onPointerDown={() => setState('active')}
          style={{ position: 'relative', maxWidth: 720, height: 420, margin: '0 auto', borderRadius: 8, overflow: 'hidden', background: '#0f1218',
            outline: state === 'active' ? `2px solid ${UI.on}` : `1px solid ${UI.border}`, outlineOffset: state === 'active' ? 0 : -1 }}>
          <Bonkei source={FLOW} controls={{ zoom: false }} />
          {state === 'hint' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0009', color: UI.text, font: '15px system-ui, sans-serif', pointerEvents: 'none' }}>{hint}</div>
          )}
          {state === 'active' && (
            <div style={{ ...panel, position: 'absolute', left: 10, top: 10, padding: '3px 8px', fontSize: 12, color: UI.muted, pointerEvents: 'none' }}>Esc to let go</div>
          )}
        </div>
        <div style={text}>
          <p>sample data: a small shop backend. State: <b style={{ color: UI.text }}>{state}</b>.</p>
          <div style={{ height: '100vh' }} />
        </div>
      </div>
    )
  },
}

/** What turning looks like in each view, as a heading chip while the turn is going on. Sample data. */
export const Turning: StoryObj<{ mode: Mode; heading: number }> = {
  args: { mode: 'iso', heading: 135 },
  argTypes: { mode: modeArg, heading: { control: { type: 'range', min: 0, max: 359, step: 1 } } },
  render: ({ mode, heading }) => {
    const settled = mode === '3d' ? heading : (Math.round((heading - (mode === 'iso' ? 45 : 0)) / 90) * 90 + (mode === 'iso' ? 45 : 0) + 360) % 360
    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0f1218' }}>
        <Bonkei source={FLOW} mode={mode} toolbar={false} />
        <div style={{ ...panel, position: 'absolute', top: 10, left: 10, padding: '4px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-block', transform: `rotate(${heading}deg)` }}>↑</span>
          <span>{heading}°</span>
          {mode !== '3d' && <span style={{ color: UI.muted }}>lets go at {settled}°</span>}
        </div>
        <Note>Mockup: while Shift + drag (or a twist) turns the diagram, a chip shows the heading; flat and iso settle on the nearest quarter turn when let go ({TURN[mode]}). Fit puts it back square. sample data: a small shop backend.</Note>
      </div>
    )
  },
}

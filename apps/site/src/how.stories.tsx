import { useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Bonkei, type BonkeiError, type BonkeiWarning, type Mode } from 'bonkei'
// Sample data: the repo's demo flowchart (sample.mmd), the same one the section shows today.
import sample from './sample.mmd?raw'
import './site.css'

// BON-189 mockup: the home page's "Keep the text. Get the scene." section, with the source editable and the live
// scene beside it. A mockup only: Home.tsx is not changed here, and the real one lazy-loads the scene like Hero does.

const css = `
.how-ed { display:flex; flex-direction:column; height:460px; background:#0b0e14; border:1px solid var(--scene-line); border-radius:10px; overflow:hidden }
.how-bar { display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--scene-line); font-size:12px; color:#8f9bb5 }
.how-bar b { color:#d6deee; font-weight:600 }
.how-bar button { margin-left:auto; font:inherit; font-size:12px; color:#e6ebf5; border:1px solid #5a6785; padding:2px 10px; border-radius:6px; background:none; cursor:pointer }
.how-bar button:disabled { opacity:.4; cursor:default }
.how-ed textarea { flex:1; resize:none; border:0; outline:0; background:none; padding:14px 18px; font:13px/1.6 ui-monospace, monospace; color:#cfd8ea; tab-size:4; white-space:pre; caret-color:#f2c14e }
.how-msg { padding:7px 12px; border-top:1px solid var(--scene-line); font:12px ui-monospace, monospace; color:#b4bfd6; min-height:31px }
.how-msg.warn { color:#f2c14e }
.how-msg.ok::before { content:"●"; color:#4fbf7f; margin-right:6px }
.how-scene { position:relative; height:460px; background:var(--scene); border:1px solid var(--scene-line); border-radius:10px; overflow:hidden }
.how-scene .site-stage-caption { bottom:12px }
.how-still { display:block; width:100%; height:auto; border:1px solid var(--scene-line); border-radius:10px }
@media (max-width:1000px) { .how-ed, .how-scene { height:400px } }
`

const START = sample.replace(/^%%.*\n/, '')
const ORDER: Mode[] = ['flat', 'iso', '3d']

function HowLive({ initial = START, then }: { initial?: string; then?: string }) {
  const [text, setText] = useState(initial)
  const [shown, setShown] = useState(initial) // what the scene was last given: the text, a moment after typing stops
  const [mode, setMode] = useState<Mode>('iso')
  const [error, setError] = useState<BonkeiError | null>(null)
  const [warnings, setWarnings] = useState<BonkeiWarning[]>([])
  const warned = useRef<BonkeiWarning[]>([])
  const scripted = useRef(false)

  useEffect(() => {
    if (text === shown) return
    const t = setTimeout(() => { warned.current = []; setShown(text) }, 300)
    return () => clearTimeout(t)
  }, [text, shown])

  const msg = error
    ? { cls: 'warn', text: `Not updated: ${error.line !== undefined ? `line ${error.line}: ` : ''}${error.message}. Showing the last diagram that worked.` }
    : warnings.length
      ? { cls: 'warn', text: `Skipped line ${warnings[0].line}: ${warnings[0].message}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}` }
      : { cls: 'ok', text: 'Live: edit the text, the scene follows' }

  return (
    <div className="site-split">
      <div className="how-ed">
        <div className="how-bar"><b>Mermaid</b><span>edit me</span>
          <button type="button" disabled={text === START} onClick={() => setText(START)}>Reset</button>
        </div>
        <textarea aria-label="Mermaid source of the diagram beside it" spellCheck={false} value={text} onChange={e => setText(e.target.value)} />
        <div className={'how-msg ' + msg.cls} role="status">{msg.text}</div>
      </div>
      <div className="how-scene">
        <Bonkei source={shown} mode={mode} labels="top" toolbar={false}
          onReady={() => {
            setError(null); setWarnings(warned.current)
            if (then && !scripted.current) { scripted.current = true; setTimeout(() => setText(then), 800) }
          }}
          onWarning={w => { warned.current = [...warned.current, w]; setWarnings(warned.current) }}
          onError={e => setError(e)} />
        <div className="site-modes" role="group" aria-label="View">
          {ORDER.map(m => <button key={m} className={m === mode ? 'on' : ''} aria-pressed={m === mode} onClick={() => setMode(m)}>{m}</button>)}
        </div>
        {!error && <div className="site-stage-caption">drag a node · click a tray to fly in</div>}
      </div>
    </div>
  )
}

// Phone, or no WebGL 2: the section as it is today, with a sharp still.
function HowFallback() {
  return (
    <div className="site-split">
      <div className="site-src"><pre>{START}</pre></div>
      <img className="how-still" src={import.meta.env.BASE_URL + 'still-iso.png'} width={800} height={500} alt="The flowchart from the source beside it, rendered isometrically" />
    </div>
  )
}

function Section({ live = true, initial, then }: { live?: boolean; initial?: string; then?: string }) {
  return (
    <div className="site">
      <style>{css}</style>
      <div className="site-wrap">
        <section id="how" style={{ borderTop: 0 }}>
          <h2>Keep the text. Get the scene.</h2>
          <p className="site-lead">Your diagrams already live in READMEs and docs as Mermaid. You don't have to move them into a drawing tool: the same text becomes a 3D scene.</p>
          {live ? <HowLive initial={initial} then={then} /> : <HowFallback />}
          <div className="site-note">{live ? 'Try it: rename a node, or add a line like  UI --> REST' : 'Edit the source, and the scene re-lays itself out as you type. Try it live on a desktop.'}</div>
        </section>
      </div>
    </div>
  )
}

const meta: Meta<typeof Section> = { title: 'Mockups/Site/How it works (BON-189)', component: Section }
export default meta
type Story = StoryObj<typeof Section>

/** Desktop: the sample in an editor, the live scene beside it. Type in it. */
export const Live: Story = { args: { live: true } }

/** A line the parser can't read: it is skipped, the rest still draws, and the note says which line. */
export const TypoSkipsALine: Story = {
  args: { live: true, initial: START.replace('Auth --> UI', 'Auth --> UI\n            !!!') },
}

/** Nothing readable (here the text was cleared and retyped): the last good diagram stays, the note says why. */
export const NothingReadable: Story = { args: { live: true, then: 'flowchart TD\n    ' } }

/** Phone, or a browser without WebGL 2: the source and a still, as today. */
export const PhoneFallback: Story = {
  args: { live: false },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

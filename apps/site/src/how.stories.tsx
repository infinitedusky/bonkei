import { useEffect, useRef, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
// Sample data: the repo's demo flowchart (sample.mmd), the one the section shows. The '!!!' line and the
// 'flowchart TD' text typed below are made up, to show the notes, as is the 200-link chain of LONG.
import sample from './sample.mmd?raw'
import { How } from './How'
import { startOf } from './howGate'
import './site.css'

const START = startOf(sample)
// Made up: a chain over the size the scene is given (150 links), to show the note.
const LONG = 'flowchart TD\n' + Array.from({ length: 200 }, (_, i) => `    N${i} --> N${i + 1}`).join('\n') + '\n'

// The front page's "Keep the text. Get the scene." section on its own (BON-189): the real How component,
// as Home renders it. `live` forces the gate so each story looks the same at any window size.
function Section({ live, fallback, initial, typeAfterDraw, loseAfterDraw, failLoad, holdLoad }: { live: boolean; fallback?: 'phone' | 'no-webgl2'; initial?: string; typeAfterDraw?: string; loseAfterDraw?: boolean; failLoad?: boolean; holdLoad?: boolean }) {
  const how = <How live={live} fallback={fallback} initial={initial} flash={false} failLoad={failLoad} holdLoad={holdLoad} />
  return (
    <div className="site">
      <div className="site-wrap">
        <div className="site-note" style={{ textAlign: 'left' }}>sample data: small flowchart (sample.mmd){typeAfterDraw !== undefined && `, then the text replaced by ${typeAfterDraw === LONG ? 'a made-up 200-link chain' : JSON.stringify(typeAfterDraw)}`}{loseAfterDraw && ', then the WebGL context lost'}{failLoad && ', the scene\'s chunk failing to load'}{holdLoad && ', the scene\'s chunk held back'}</div>
        <section id="how" style={{ borderTop: 0 }}>
          <h2>Keep the text. Get the scene.</h2>
          <p className="site-lead">Your diagrams already live in READMEs and docs as Mermaid. You don't have to move them into a drawing tool: the same text becomes a 3D scene.</p>
          {typeAfterDraw !== undefined ? <AfterDraw act={el => type(el, typeAfterDraw)}>{how}</AfterDraw>
            : loseAfterDraw ? <AfterDraw act={lose}>{how}</AfterDraw>
            : how}
        </section>
      </div>
    </div>
  )
}

// Story only: replaces the editor's text the way typing does (a native input event).
function type(el: HTMLElement, text: string) {
  const area = el.querySelector('textarea')!
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, text)
  area.dispatchEvent(new Event('input', { bubbles: true }))
}

// Story only: loses the scene's WebGL context, as a GPU reset or a browser reclaiming it does.
function lose(el: HTMLElement) {
  el.querySelector<HTMLCanvasElement>('.how-scene canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
}

// Story only: once the scene has drawn, does `act` to the section.
function AfterDraw({ act, children }: { act: (el: HTMLElement) => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef(act)
  latest.current = act
  useEffect(() => {
    let done = false
    const t = setInterval(() => {
      const el = root.current
      if (done || !el?.querySelector('textarea') || !el.querySelector('[data-bonkei="ready"]')) return
      done = true
      clearInterval(t)
      latest.current(el)
    }, 200)
    return () => clearInterval(t)
  }, [])
  return <div ref={root}>{children}</div>
}

const meta: Meta<typeof Section> = { title: 'Screens/Site/Keep The Text', component: Section }
export default meta
type Story = StoryObj<typeof Section>

/** Desktop: the sample in an editor, the live scene beside it. Type in it; the scene follows 300 ms after you stop. */
export const Live: Story = { args: { live: true } }

/** A line the scene can't read: it is skipped, the rest still draws, and the note under the source names the line. */
export const SkippedLine: Story = {
  args: { live: true, initial: START.replace('Auth --> UI', 'Auth --> UI\n    !!!') },
}

/** Nothing readable (the text replaced by a bare header after the first draw): the last good diagram stays, the note says why. */
export const NothingReadable: Story = { args: { live: true, typeAfterDraw: 'flowchart TD\n' } }

/** A text over the size the scene is given (150 links or 200 lines): it is not sent, the last diagram stays, the note says why. */
export const TooLong: Story = { args: { live: true, typeAfterDraw: LONG } }

/** The scene's WebGL context lost after the first draw: the section goes back to the source and the still. */
export const SceneLost: Story = { args: { live: true, loseAfterDraw: true } }

/** The scene's chunk fails to load (a dropped connection, a deploy mid-visit): the section shows the source and the still, the rest of the page stays. */
export const SceneFailedToLoad: Story = { args: { live: true, failLoad: true } }

/** Desktop while the scene's chunk is still on its way (held back here): the section's own frame (editor bar, the source read-only, an empty stage of the scene's size) and no picture. The scene fades into that stage when it draws, and nothing below moves. */
export const Loading: Story = { args: { live: true, holdLoad: true } }

/** Phone: the source (a few lines, Show all) and the sharp still, as before. */
export const PhoneFallback: Story = {
  args: { live: false },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

/** A desktop browser without WebGL 2: the same source and still, and a note that does not send the visitor to a desktop. */
export const NoWebGL: Story = { args: { live: false, fallback: 'no-webgl2' } }

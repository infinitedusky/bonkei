import { useEffect, useRef, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
// Sample data: the repo's demo flowchart (sample.mmd), the one the section shows. The '!!!' line and the
// 'flowchart TD' text typed below are made up, to show the notes.
import sample from './sample.mmd?raw'
import { How } from './How'
import { startOf } from './howGate'
import './site.css'

const START = startOf(sample)

// The front page's "Keep the text. Get the scene." section on its own (BON-189): the real How component,
// as Home renders it. `live` forces the gate so each story looks the same at any window size.
function Section({ live, initial, typeAfterDraw }: { live: boolean; initial?: string; typeAfterDraw?: string }) {
  return (
    <div className="site">
      <div className="site-wrap">
        <div className="site-note" style={{ textAlign: 'left' }}>sample data: small flowchart (sample.mmd){typeAfterDraw !== undefined && `, then the text replaced by ${JSON.stringify(typeAfterDraw)}`}</div>
        <section id="how" style={{ borderTop: 0 }}>
          <h2>Keep the text. Get the scene.</h2>
          <p className="site-lead">Your diagrams already live in READMEs and docs as Mermaid. You don't have to move them into a drawing tool: the same text becomes a 3D scene.</p>
          {typeAfterDraw === undefined
            ? <How live={live} initial={initial} flash={false} />
            : <TypeAfterDraw text={typeAfterDraw}><How live={live} initial={initial} flash={false} /></TypeAfterDraw>}
        </section>
      </div>
    </div>
  )
}

// Story only: once the scene has drawn, replaces the editor's text the way typing does (a native input event).
function TypeAfterDraw({ text, children }: { text: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let done = false
    const t = setInterval(() => {
      const el = root.current
      const area = el?.querySelector('textarea')
      if (done || !area || !el?.querySelector('[data-bonkei="ready"]')) return
      done = true
      clearInterval(t)
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, text)
      area.dispatchEvent(new Event('input', { bubbles: true }))
    }, 200)
    return () => clearInterval(t)
  }, [text])
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

/** Phone: the source (a few lines, Show all) and the sharp still, as before. */
export const PhoneFallback: Story = {
  args: { live: false },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

/** A desktop browser without WebGL 2: the same source and still. */
export const NoWebGL: Story = { args: { live: false } }

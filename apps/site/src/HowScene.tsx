import { useEffect, useRef, useState } from 'react'
import { Bonkei, type BonkeiError, type BonkeiViewHandle, type BonkeiWarning, type Mode } from 'bonkei'
import { DEBOUNCE_MS, INITIAL, fallsBack, howReducer, noteOf, outcomeOf, type HowEvent } from './howState'
import { track } from './track'

const ORDER: Mode[] = ['flat', 'iso', '3d']

// The "Keep the text. Get the scene." section's editor and live scene (How.tsx lazy-loads this file).
// The scene gets the text DEBOUNCE_MS after typing stops. Only the first draw frames the diagram: <Bonkei> keeps the
// camera (zoom, angle, the tray flown into) through every later source (BON-195); Fit and the view buttons frame it.
// A source that can't be drawn leaves the last diagram up; the note under the source says what happened, in words.
export default function HowScene({ start, initial = start, flash = false, onReady, onFailed }: {
  /** What Reset puts back. */
  start: string
  /** The text the editor opens with (default `start`). */
  initial?: string
  flash?: boolean
  /** The first draw. */
  onReady?: () => void
  /** The scene can't be shown (the first source never drew, or drawing broke): How.tsx shows the still instead. */
  onFailed?: (e: BonkeiError) => void
}) {
  const [text, setText] = useState(initial)
  const [shown, setShown] = useState(initial) // what the scene was last given
  const [mode, setMode] = useState<Mode>('iso')
  const view = useRef<BonkeiViewHandle>(null)

  // The status lives in a ref as well, so the scene's callbacks (called back to back) each see the one before.
  const status = useRef(INITIAL)
  const [note, setNote] = useState(() => noteOf(INITIAL))
  const send = (e: HowEvent) => { status.current = howReducer(status.current, e); setNote(noteOf(status.current)) }

  const sentAt = useRef(performance.now())
  const edits = useRef(0) // keystrokes since the last source sent, for telemetry
  const everEdited = useRef(false)

  useEffect(() => {
    if (text === shown) return
    const t = setTimeout(() => {
      send({ type: 'sent' })
      sentAt.current = performance.now()
      setShown(text)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [text, shown])

  const updated = () => {
    const s = status.current
    const attrs = { 'site.how.outcome': outcomeOf(s), 'site.how.skipped': s.warnings.length, 'site.how.ms': Math.round(performance.now() - sentAt.current), 'site.how.edits': edits.current }
    edits.current = 0
    track('site.how.update', s.error ? { ...attrs, 'site.how.error.kind': s.error.kind } : attrs)
  }

  const ready = () => {
    const first = !status.current.drawn
    send({ type: 'ready' })
    if (first) { track('site.how.live', { 'site.how.ms': Math.round(performance.now() - sentAt.current) }); onReady?.() }
    else updated()
  }

  const failed = (e: BonkeiError) => {
    if (fallsBack(status.current, e)) {
      track('site.how.fallback', { 'site.how.reason': 'scene-error', 'site.how.error.kind': e.kind }, e.message)
      onFailed?.(e)
      return
    }
    send({ type: 'error', error: e })
    updated()
  }

  const edit = (v: string) => {
    edits.current++
    if (!everEdited.current) { everEdited.current = true; track('site.how.first_edit') }
    setText(v)
  }

  return (
    <div className={'site-split' + (flash ? ' flash' : '')}>
      <div className="how-ed">
        <div className="how-bar"><b>Mermaid</b><span>edit me</span>
          <button type="button" disabled={text === start} onClick={() => { track('site.how.reset'); setText(start) }}>Reset</button>
        </div>
        <textarea aria-label="Mermaid source of the diagram beside it" spellCheck={false} autoCapitalize="off" autoCorrect="off"
          value={text} onChange={e => edit(e.target.value)} />
        <div className={'how-msg ' + note.tone} role="status">{note.text}</div>
      </div>
      <div className="how-scene">
        <Bonkei ref={view} source={shown} mode={mode} labels="top" toolbar={false}
          onReady={ready}
          onWarning={(w: BonkeiWarning) => send({ type: 'warning', warning: w })}
          onError={failed} />
        <div className="site-modes" role="group" aria-label="View">
          {ORDER.map(m => <button key={m} type="button" className={m === mode ? 'on' : ''} aria-pressed={m === mode} onClick={() => setMode(m)}>{m}</button>)}
          <button type="button" aria-label="Fit the whole diagram" onClick={() => view.current?.fit()}>fit</button>
        </div>
        {/* on a failed update <Bonkei> shows its own "Not updated" strip where the caption sits */}
        {!status.current.error && <div className="site-stage-caption">drag a node · click a tray to fly in</div>}
      </div>
    </div>
  )
}

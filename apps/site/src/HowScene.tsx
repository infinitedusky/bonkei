import { useEffect, useRef, useState } from 'react'
import { Bonkei, type BonkeiError, type BonkeiWarning, type Mode } from 'bonkei'
import { track } from './track'

const ORDER: Mode[] = ['flat', 'iso', '3d']

// The "Keep the text. Get the scene." section's editor and live scene (Home.tsx lazy-loads this file).
// The scene gets the text 300 ms after typing stops. `<Bonkei>` keeps the last diagram that worked and
// shows its own ErrorStrip on a failed update; the status line says what happened in words.
export default function HowScene({ start, onReady, onFailed }: { start: string; onReady?: () => void; onFailed?: () => void }) {
  const [text, setText] = useState(start)
  const [shown, setShown] = useState(start) // what the scene was last given
  const [mode, setMode] = useState<Mode>('iso')
  const [error, setError] = useState<BonkeiError | null>(null)
  const [warnings, setWarnings] = useState<BonkeiWarning[]>([])
  const warned = useRef<BonkeiWarning[]>([])
  const edits = useRef(0)

  useEffect(() => {
    if (text === shown) return
    const t = setTimeout(() => {
      warned.current = [] // only a new source resets the warnings, not every tick
      setShown(text)
    }, 300)
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
          <button type="button" disabled={text === start} onClick={() => { track('how.reset'); setText(start) }}>Reset</button>
        </div>
        <textarea aria-label="Mermaid source of the diagram beside it" spellCheck={false} value={text}
          onChange={e => { edits.current++; if (edits.current === 1 || edits.current % 10 === 0) track('how.edit', { edits: edits.current }); setText(e.target.value) }} />
        <div className={'how-msg ' + msg.cls} role="status">{msg.text}</div>
      </div>
      <div className="how-scene">
        <Bonkei source={shown} mode={mode} labels="top" toolbar={false} controls={{ zoom: false }}
          onReady={() => { setError(null); setWarnings(warned.current); onReady?.() }}
          onWarning={w => { warned.current = [...warned.current, w]; setWarnings(warned.current); track('how.warning', { kind: w.kind }) }}
          onError={e => { setError(e); track('how.error', { kind: e.kind }); if (shown === start) onFailed?.() }} />
        <div className="site-modes" role="group" aria-label="View">
          {ORDER.map(m => <button key={m} className={m === mode ? 'on' : ''} aria-pressed={m === mode} onClick={() => setMode(m)}>{m}</button>)}
        </div>
        {!error && <div className="site-stage-caption">drag a node · click a tray to fly in</div>}
      </div>
    </div>
  )
}

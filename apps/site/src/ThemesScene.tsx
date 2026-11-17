import { useRef, useState } from 'react'
import { Bonkei, type BonkeiViewHandle, type Mode } from 'bonkei'

// The Themes section's live scene (Themes.tsx lazy-loads this file). The theme is picked by the source's frontmatter,
// as a reader would write it (a new source, laid out again). On a phone it opens flat on the largest tray with labels
// at least 11 px, and Fit shows the whole diagram.
export default function ThemesScene({ source, narrow }: { source: string; narrow: boolean }) {
  const [mode, setMode] = useState<Mode>(() => (narrow ? 'flat' : 'iso'))
  const view = useRef<BonkeiViewHandle>(null)
  return (
    <>
      <Bonkei ref={view} source={source} mode={mode} toolbar={false} fit="tight" minLabelPx={narrow ? 11 : 0}
        onError={e => { if (import.meta.env.DEV) console.warn('[bonkei] error', e) }}
        onWarning={w => { if (import.meta.env.DEV) console.warn('[bonkei] warning', w) }} />
      <div className="site-tmodes" role="radiogroup" aria-label="View">
        {narrow && <button type="button" className="fit" aria-label="Fit the whole diagram" onClick={() => view.current?.fit()}>Fit</button>}
        {(['flat', 'iso', '3d'] as const).map(m => <button key={m} type="button" role="radio" aria-checked={m === mode} onClick={() => setMode(m)}>{m === '3d' ? '3D' : m[0].toUpperCase() + m.slice(1)}</button>)}
      </div>
    </>
  )
}

import { useState } from 'react'
import bonkeiStill from './mock/theme-bonkei.jpg'
import landscapeStill from './mock/theme-landscape.jpg'
import prints from './mock/ref-prints.jpg'

// MOCKUP: the home page's Themes section. One diagram, switched between themes from a list.
// The engine has no themes yet (BON-32), so the Bonkei looks are stills of the sketch
// (sketches/brand-theme.html), marked as such; Classic is today's real still.

type ThemeId = 'classic' | 'bonkei' | 'landscape'

const THEMES: { id: ThemeId | null; name: string; note: string; still?: string; mock?: boolean; config?: string }[] = [
  { id: 'classic', name: 'Classic', note: 'the default', still: import.meta.env.BASE_URL + 'still-iso.png', config: 'theme: classic' },
  { id: 'bonkei', name: 'Bonkei', note: 'ink and paper, patterned trays', still: bonkeiStill, mock: true, config: 'theme: bonkei' },
  { id: 'landscape', name: 'Bonkei · landscape', note: 'nodes become houses, bonsai, rocks', still: landscapeStill, mock: true, config: 'theme: bonkei\n  themeVariables:\n    node.form: landscape' },
  { id: null, name: 'Blueprint', note: 'coming with themes' },
  { id: null, name: 'Map', note: 'coming with themes' },
]

export function Themes({ start = 'landscape' }: { start?: ThemeId }) {
  const [on, setOn] = useState<ThemeId>(start)
  const t = THEMES.find(x => x.id === on)!
  return (
    <div className="brand-themes">
      <div>
        <div className="brand-tlist" role="group" aria-label="Theme">
          {THEMES.map(x => (
            <button key={x.name} disabled={!x.id} aria-pressed={x.id === on} onClick={() => x.id && setOn(x.id)}>
              <b>{x.name}</b><span>{x.note}</span>
            </button>
          ))}
        </div>
        <pre className="brand-tcode">{`---\nconfig:\n  ${t.config}\n---\nflowchart LR\n  ...`}</pre>
      </div>
      <div>
        <div className="brand-tview">
          <img src={t.still} alt={`A flowchart drawn in the ${t.name} theme`} />
          {t.mock && <span className="brand-tmock">mockup: a still of the sketch, the theme is not built yet</span>}
        </div>
        <div className="brand-origin">
          <img src={prints} alt="Three Edo woodblock prints of tray landscapes: mountains, pines and houses in blue-and-white patterned bowls" />
          <p>
            <b>Where the name comes from.</b> Bonkei (盆景) is the Japanese art of the tray landscape: mountains, a pine, a house or two, on a shallow patterned tray. This theme is drawn from these prints.
            <small>Utagawa Yoshishige, <i>53 Stations of the Tōkaidō as Potted Landscapes</i>, 1848. Public domain; courtesy of Special Collections, USDA National Agricultural Library.</small>
          </p>
        </div>
      </div>
    </div>
  )
}

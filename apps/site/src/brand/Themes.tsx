import { useState } from 'react'
import { Bonkei, type Mode } from 'bonkei'
import prints from './mock/ref-prints.jpg'
import { THEMES_DIAGRAM } from './themes-sample'

// The home page's Themes section. One diagram, drawn live in the theme picked from the list: the theme
// is chosen the way a reader would, by `config.theme` / `config.themeVariables` in the diagram's frontmatter.

type ThemeId = 'classic' | 'bonkei' | 'landscape'

const THEMES: { id: ThemeId | null; name: string; note: string; config?: string }[] = [
  { id: 'classic', name: 'Classic', note: 'the default', config: 'theme: classic' },
  { id: 'bonkei', name: 'Bonkei', note: 'ink and paper, patterned trays', config: 'theme: bonkei' },
  { id: 'landscape', name: 'Bonkei · landscape', note: 'nodes become houses, bonsai, rocks', config: 'theme: bonkei\n  themeVariables:\n    node.form: landscape' },
  { id: null, name: 'Blueprint', note: 'coming with themes' },
  { id: null, name: 'Map', note: 'coming with themes' },
]

export function Themes({ start = 'landscape', source = THEMES_DIAGRAM }: { start?: ThemeId; source?: string }) {
  const [on, setOn] = useState<ThemeId>(start)
  const [mode, setMode] = useState<Mode>('iso')
  const t = THEMES.find(x => x.id === on)!
  const text = `---\nconfig:\n  ${t.config}\n---\n${source}`
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
          <Bonkei source={text} mode={mode} toolbar={false} controls={{ zoom: false }} />
          <div className="brand-tmodes" role="radiogroup" aria-label="View">
            {(['flat', 'iso', '3d'] as const).map(m => <button key={m} role="radio" aria-checked={m === mode} onClick={() => setMode(m)}>{m === '3d' ? '3D' : m[0].toUpperCase() + m.slice(1)}</button>)}
          </div>
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

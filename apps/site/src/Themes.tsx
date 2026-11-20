import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import prints from './ref-prints.jpg'
import { THEMES_DIAGRAM } from './themes-sample'

// Like Hero.tsx, this file has no value import of the scene: the scene chunk is fetched when the section comes
// near the screen, so the page's first paint (and a phone) never waits for it.
const ThemesScene = lazy(() => import('./ThemesScene'))

export type ThemeId = 'classic' | 'bonkei' | 'bonkei-landscape' | 'blueprint'

// The built-in themes, chosen the way a reader would: by config.theme in the diagram's frontmatter.
// The last is a name only, for the theme still to come (BON-235).
export const THEMES: { id: ThemeId | null; name: string; note: string }[] = [
  { id: 'classic', name: 'Classic', note: 'the default' },
  { id: 'bonkei', name: 'Bonkei', note: 'ink and paper, patterned trays' },
  { id: 'bonkei-landscape', name: 'Bonkei · landscape', note: 'nodes become houses, bonsai, rocks' },
  { id: 'blueprint', name: 'Blueprint', note: 'white lines on blue paper, with a grid' },
  { id: null, name: 'Map', note: 'coming with themes' },
]

/** The diagram's source with the frontmatter that picks the theme. */
export const themed = (id: ThemeId, source: string) => `---\nconfig:\n  theme: ${id}\n---\n${source}`

const PHONE = '(max-width:760px)'
const matches = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches
function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

// The home page's Themes section: the list and the frontmatter that picks the theme, beside one live diagram.
// `live`: true mounts the scene at once (stories), false never (no WebGL), unset when the section comes near the screen.
export function Themes({ start = 'bonkei-landscape', source = THEMES_DIAGRAM, live }: { start?: ThemeId; source?: string; live?: boolean }) {
  const [on, setOn] = useState<ThemeId>(start)
  const [narrow, setNarrow] = useState(() => matches(PHONE))
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(PHONE), f = () => setNarrow(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  // below the phone breakpoint the frontmatter starts folded: the scene comes first
  const [codeOpen, setCodeOpen] = useState(() => !matches(PHONE))

  const frame = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState(live === true)
  const [gl, setGl] = useState(true)
  useEffect(() => {
    if (live === false) return
    if (!hasWebGL2()) { setGl(false); return }
    if (live === true) { setMount(true); return }
    const el = frame.current
    if (!el || typeof IntersectionObserver === 'undefined') { setMount(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setMount(true); io.disconnect() } }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [live])

  return (
    <div className="site-themes">
      <div className="site-tleft">
        <div className="site-tlist" role="group" aria-label="Theme">
          {THEMES.map(x => (
            <button key={x.name} type="button" disabled={!x.id} aria-pressed={x.id === on} onClick={() => x.id && setOn(x.id)}>
              <b>{x.name}</b><span>{x.note}</span>
            </button>
          ))}
        </div>
        <details className="site-tcodebox" open={codeOpen} onToggle={e => setCodeOpen((e.target as HTMLDetailsElement).open)}>
          <summary>The frontmatter that picks this theme</summary>
          <pre className="site-tcode">{`---\nconfig:\n  theme: ${on}\n---\nflowchart LR\n  ...`}</pre>
        </details>
      </div>
      <div className="site-tright">
        <div className="site-tview" ref={frame}>
          {mount && gl && <Suspense fallback={null}><ThemesScene source={themed(on, source)} narrow={narrow} /></Suspense>}
          {!gl && <div className="site-tnogl">The live diagram needs WebGL 2, which this browser does not have.</div>}
        </div>
        <div className="site-origin">
          <img src={prints} width={600} height={300} loading="lazy" alt="Three Edo woodblock prints of tray landscapes: mountains, pines and houses in blue-and-white patterned bowls" />
          <p>
            <b>Where the name comes from.</b> Bonkei (盆景) is the Japanese art of the tray landscape: mountains, a pine, a house or two, on a shallow patterned tray. The Bonkei themes are drawn from these prints.
            <small>Utagawa Yoshishige, <i>53 Stations of the Tōkaidō as Potted Landscapes</i>, 1848. Public domain; courtesy of Special Collections, USDA National Agricultural Library.</small>
          </p>
        </div>
      </div>
    </div>
  )
}

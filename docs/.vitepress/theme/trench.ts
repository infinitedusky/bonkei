// The trench light controls on Edge styles (TrenchLight.vue), as plain data: what each theme draws on its own, the presets, and the
// config.themeVariables a setting writes into the diagram's frontmatter. No Vue and no bonkei here, so it is tested on its own
// (trench.test.ts) and the Storybook controls story (apps/playground/src/themes.stories.tsx) draws from the same rules.
//
// Strength is a share of the standard light: 50% is the sizes Bonkei keeps for its (off) light, core 3.5, halo 11 at 0.28 opacity, wall
// wash 0.3. Classic's own light is 30%.

export const TRENCH_THEMES = ['classic', 'bonkei', 'bonkei-landscape', 'blueprint'] as const
export type TrenchTheme = (typeof TRENCH_THEMES)[number]
export interface TrenchState {
  floor: boolean // the light along the floor: edge.glow.core and edge.glow.halo
  wash: boolean // the wash of light on the walls: edge.glow.wash
  rim: boolean // the rim round the lip: edge.rim
  colour: string | null // null: the theme's own colour
  strength: number // 0..100, % of the standard light
}
export type TrenchPreset = 'default' | 'light-only' | 'off'

/** What a theme draws with no themeVariables: Classic lights floor and walls at 30% with no rim; the Bonkei looks have the light off and their dark rim; Blueprint lights both in pale blue at 50% and keeps a pale rim. */
export const own = (t: TrenchTheme): TrenchState =>
  t === 'classic' ? { floor: true, wash: true, rim: false, colour: null, strength: 30 }
    : t === 'blueprint' ? { floor: true, wash: true, rim: true, colour: null, strength: 50 }
      : { floor: false, wash: false, rim: true, colour: null, strength: 50 }

/** The colour the light takes when the reader has not picked one: Classic's grey-white, or a warm light in the Bonkei looks. */
export const themeColour = (t: TrenchTheme) => (t === 'classic' ? '#e0e0e0' : t === 'blueprint' ? '#bfe4ff' : '#ffc873')

/**
 * A preset applied to the current setting. Theme default: the theme's own look. Light only: the light out of the floor and nothing
 * else (no wall wash, no rim), in the colour and strength already chosen. All off: no light and no rim.
 */
export function preset(t: TrenchTheme, p: TrenchPreset, now: TrenchState): TrenchState {
  if (p === 'default') return own(t)
  if (p === 'light-only') return { ...now, floor: true, wash: false, rim: false, strength: now.strength || own('classic').strength }
  return { ...now, floor: false, wash: false, rim: false }
}

const n = (x: number, d: number) => +x.toFixed(d)

/** The themeVariables a setting needs over the theme's own look, in the order they are written. None when it is the theme's own look. */
export function trenchVariables(t: TrenchTheme, s: TrenchState): [string, string | number | null][] {
  const o = own(t)
  if (s.floor === o.floor && s.wash === o.wash && s.rim === o.rim && s.strength === o.strength && s.colour === null) return []
  const v: [string, string | number | null][] = [], c = s.colour ?? themeColour(t), k = s.strength / 50
  if (!s.floor && !s.wash) v.push(['edge.glow', 'off'])
  else {
    if (s.floor) v.push(['edge.glow.core', c], ['edge.glow.halo', c], ['edge.glow.coreWidth', n(3.5 * k, 1)], ['edge.glow.haloWidth', n(11 * k, 1)], ['edge.glow.haloOpacity', n(0.28 * k, 2)])
    else v.push(['edge.glow.core', null], ['edge.glow.halo', null])
    if (s.wash) v.push(['edge.glow.wash', c], ['edge.glow.washIntensity', n(0.3 * k, 2)])
    else v.push(['edge.glow.wash', null])
  }
  if (!s.rim) v.push(['edge.rim', 'none'])
  // a rim switched on: the Bonkei looks keep their own dark rim unless a colour is picked; Classic has none of its own, so it takes the light's colour
  else if (s.colour !== null || !o.rim) v.push(['edge.rim', c])
  return v
}

const yaml = (x: string | number | null) => (x === null ? 'null' : typeof x === 'number' || x === 'off' || x === 'none' ? String(x) : JSON.stringify(x))

/** The tunnel diagram drawn with a setting: its frontmatter carries the themeVariables (MADE-UP SAMPLE DATA: a web app, an API, a CDN). */
export function trenchSource(t: TrenchTheme, s: TrenchState): string {
  const v = trenchVariables(t, s)
  return `---
config:
  theme: ${t}
  bonkei:
    crossings: tunnel
    avoidCrossings: off
${v.length ? '  themeVariables:\n' + v.map(([key, x]) => `    ${key}: ${yaml(x)}`).join('\n') + '\n' : ''}---
flowchart LR
  Web[Web app] --> Api[API] --> Db[(Database)]
  Web --> Db
  Cdn[CDN] --> Api
  Cdn --> Cache[(Cache)]`
}

/** Which parts a setting draws, for telemetry: e.g. `floor,wash`, `floor` (light only) or `off`. */
export const parts = (s: TrenchState) => [s.floor && 'floor', s.wash && 'wash', s.rim && 'rim'].filter(Boolean).join(',') || 'off'

// Themes: a typed, JSON-serialisable token object. The scene reads tokens only; the built-in looks are presets
// of it. Decisions: LOG.md, "Themes: Classic, Bonkei, Bonkei · landscape (BON-117)". Plain .ts, no React.
import type { Shape } from './model.ts'

export type Pattern = 'plain' | 'hishi' | 'flower' | 'stone'
export interface Plate { style: 'plain' | 'cartouche'; text: string; plate: string; border: string }

export interface Theme {
  name: string
  ground: {
    bg: string
    grid: [string, string] | null // centre lines, other lines; null: no grid
    grain: number // 0..1 paper grain, 0 off
    lit: boolean // lit by the lights (Classic) or flat paper
  }
  light: { ambient: number; sky: string; floor: string; hemi: number; sun: number; shadows: boolean; shading: 'standard' | 'toon'; tones: number; toneMapping: boolean }
  node: {
    colors: Record<Shape, string>
    form: 'block' | 'landscape' // landscape: a form stands on the footprint
    outline: string | null // ink colour; null: no outline
    outlineWidth: number
    bevel: number // edge rounding of a block; 0 for crisp ink edges
    footprint: { height: number; color: string | null; darken: number } // landscape: the raised plinth a form stands on; color null: the surface it stands on, times darken
    labelGap: number // landscape: how far the form stands above its footprint, leaving room for the label in front
    hover: string
    hoverIntensity: number
  }
  tray: {
    thickness: number // the tray's height (one level)
    colors: [string, string, string] // top, by level
    sides: [Pattern, Pattern, Pattern] // side pattern, by level
    titles: 'fixed' | 'free' // fixed: the back-left corner; free: a corner nothing stands on (tested against the nodes and forms on the tray)
    patternInk: string
    patternPaper: string
    outline: string | null
    hover: string
    hoverIntensity: number
  }
  label: {
    font: string | null // a bundled font key, null: drei's default
    node: Plate
    tray: Plate
    toward: number // how far a billboarded label is pulled towards the camera, so it stands in front of a form
  }
  // Ink follows the drawing's on-screen scale: width in px = token width x (px per world unit / ref), kept between min (px, for an outline;
  // other lines get it in proportion to their own width) and the token width. ref null: fixed widths, as in Classic.
  ink: { ref: number | null; min: number }
  edge: { color: string; width: number; label: string; labelOutline: string; portal: string; rim: string | null; rimWidth: number; flat: boolean } // rim: the lip of a tunnel's trough; null: a dark shade of the surface. flat: lines lie on the surface under them and the arrowhead is a flat triangle
  seq: { lifeline: string; activation: string; note: string; noteText: string; blockText: string; blockSub: string; cross: string; crossLine: string }
}

// The presets are shared by every diagram on the page, so they are frozen: edit a copy (withVariables, or a spread).
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v) }
  return o
}

export const CLASSIC: Theme = deepFreeze({
  name: 'classic',
  ground: { bg: '#0f1218', grid: ['#1d2433', '#161c28'], grain: 0, lit: true },
  light: { ambient: 0.55, sky: '#bcd0ff', floor: '#202838', hemi: 0.5, sun: 1.6, shadows: true, shading: 'standard', tones: 3, toneMapping: true },
  node: {
    colors: { rect: '#5b8def', round: '#3fbf9b', cylinder: '#e0a458', diamond: '#d96c8a' },
    form: 'block', outline: null, outlineWidth: 2, bevel: 0.03, footprint: { height: 0.12, color: '#e9dfc8', darken: 0.9 }, labelGap: 0.3,
    hover: '#ffffff', hoverIntensity: 0.18,
  },
  tray: {
    thickness: 0.25,
    colors: ['#243044', '#2d3b52', '#374862'], sides: ['plain', 'plain', 'plain'], titles: 'fixed', patternInk: '#24508F', patternPaper: '#f4efe3',
    outline: null, hover: '#8fb0ff', hoverIntensity: 0.15,
  },
  label: {
    font: null,
    node: { style: 'plain', text: '#ffffff', plate: '#ffffff', border: '#000000' },
    tray: { style: 'plain', text: '#cfd8ea', plate: '#ffffff', border: '#000000' },
    toward: 0,
  },
  ink: { ref: null, min: 1 },
  edge: { color: '#e8edf7', width: 2, label: '#ffd479', labelOutline: '#000000', portal: '#3fa7ff', rim: null, rimWidth: 1.5, flat: false },
  seq: { lifeline: '#5c6b8a', activation: '#f2c14e', note: '#e9d98a', noteText: '#2a2a1a', blockText: '#e8edf7', blockSub: '#cfd8ea', cross: '#ff6b6b', crossLine: '#ff9b9b' },
})

export const BONKEI: Theme = deepFreeze({
  name: 'bonkei',
  ground: { bg: '#EFE6D0', grid: null, grain: 0.25, lit: false },
  light: { ambient: 1.2, sky: '#fff8e6', floor: '#d8cbaa', hemi: 0.4, sun: 1.5, shadows: false, shading: 'toon', tones: 3, toneMapping: false },
  node: {
    colors: { rect: '#9AAE8C', round: '#5E8F88', cylinder: '#C9A24A', diamond: '#7C93B8' },
    form: 'block', outline: '#2A2622', outlineWidth: 1.5, bevel: 0, footprint: { height: 0.22, color: null, darken: 0.93 }, labelGap: 0.34,
    hover: '#fff2c0', hoverIntensity: 0.15,
  },
  tray: {
    thickness: 0.42,
    colors: ['#E6DCC3', '#DACDAE', '#CDBF9C'], sides: ['hishi', 'flower', 'stone'], titles: 'free', patternInk: '#24508F', patternPaper: '#f4efe3',
    outline: '#2A2622', hover: '#fff2c0', hoverIntensity: 0.12,
  },
  label: {
    font: 'mincho',
    node: { style: 'cartouche', text: '#2A2622', plate: '#f6efdd', border: '#2A2622' },
    tray: { style: 'cartouche', text: '#f1e8d2', plate: '#23345A', border: '#2A2622' },
    toward: 0,
  },
  ink: { ref: 40, min: 1 },
  edge: { color: '#2A2622', width: 2, label: '#2A2622', labelOutline: '#EFE6D0', portal: '#2A2622', rim: '#2A2622', rimWidth: 2, flat: false },
  seq: { lifeline: '#8a7f6c', activation: '#C9A24A', note: '#f6efdd', noteText: '#2A2622', blockText: '#2A2622', blockSub: '#4a4238', cross: '#C8452C', crossLine: '#C8452C' },
})

// Bonkei with a landscape form standing on each node's footprint, and its label pulled in front of the form.
export const BONKEI_LANDSCAPE: Theme = deepFreeze({ ...BONKEI, name: 'bonkei-landscape', node: { ...BONKEI.node, form: 'landscape' }, label: { ...BONKEI.label, toward: 0.7 } })

/** The built-in themes by the name a diagram or the `theme` prop uses. */
export const PRESETS: Readonly<Record<string, Theme>> = Object.freeze({ classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': BONKEI_LANDSCAPE })
export const THEME_NAMES = Object.keys(PRESETS)

// Tokens that take one of a few words. A path segment `#` stands for any array index.
const CHOICES: Record<string, readonly string[]> = {
  'light.shading': ['standard', 'toon'],
  'node.form': ['block', 'landscape'],
  'tray.sides.#': ['plain', 'hishi', 'flower', 'stone'],
  'tray.titles': ['fixed', 'free'],
  'label.font': ['mincho'],
  'label.node.style': ['plain', 'cartouche'],
  'label.tray.style': ['plain', 'cartouche'],
}

export interface ThemeProblem { key: string; message: string }
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
// A token's own key: an array takes only an index (not `length`), an object only its own keys (not `toString`, `__proto__`).
const owns = (c: object, k: string) => (Array.isArray(c) ? /^\d+$/.test(k) && Number(k) < c.length : Object.hasOwn(c, k))
const at = (o: unknown, keys: string[]) => keys.reduce<any>((c, k) => (c !== null && typeof c === 'object' && owns(c, k) ? c[k] : undefined), o)

// Sets one dotted path (`node.form`, `tray.colors.0`) to a value of the type the token has. A token that can be null
// (an outline, a font) takes null or the type it has in the presets where it is set.
function setPath(t: Theme, path: string, v: unknown): string | null {
  const keys = path.split('.')
  if (keys[0] === 'name') return 'name is not a theme variable; pick the theme with config.theme'
  const parent = at(t, keys.slice(0, -1)), last = keys[keys.length - 1]
  if (parent === null || typeof parent !== 'object' || !owns(parent, last)) return `unknown theme variable ${path}`
  const old = parent[last]
  if (old !== null && typeof old === 'object') return `${path} is a group of tokens; set one of them (${Object.keys(old).map(k => `${path}.${k}`).join(', ')})`
  const types = new Set(Object.values(PRESETS).map(p => at(p, keys)).map(x => (x === null ? 'null' : typeof x)))
  const want = [...types].filter(x => x !== 'null')
  const got = v === null ? 'null' : typeof v
  if (!types.has(got)) return `${path} must be ${want.length ? 'a ' + want.join(' or a ') : 'null'}${types.has('null') ? ' or null' : ''}; got ${JSON.stringify(v)}`
  const choices = CHOICES[keys.map(k => (/^\d+$/.test(k) ? '#' : k)).join('.')]
  if (choices?.length && typeof v === 'string' && !choices.includes(v)) return `${path} must be one of ${choices.join(', ')}; got ${JSON.stringify(v)}`
  if (typeof v === 'number' && !Number.isFinite(v)) return `${path} must be a finite number; got ${JSON.stringify(v)}`
  parent[last] = v
  return null
}

/** The preset a name asks for (any case), or Classic and a problem for a name we do not know. */
export function themeByName(name: string | undefined): { theme: Theme; problem?: ThemeProblem } {
  if (name === undefined) return { theme: CLASSIC }
  const t = PRESETS[name.toLowerCase()]
  if (t) return { theme: t }
  return { theme: CLASSIC, problem: { key: 'theme', message: `unknown theme ${JSON.stringify(name)}; known: ${THEME_NAMES.join(', ')}. Drawn in classic` } }
}

/** A base theme with `themeVariables` laid over it (a copy; the preset is untouched). A bad variable is skipped and reported. */
export function withVariables(base: Theme, vars: Record<string, unknown> | undefined): { theme: Theme; problems: ThemeProblem[] } {
  if (!vars || !Object.keys(vars).length) return { theme: base, problems: [] }
  const t = clone(base), problems: ThemeProblem[] = []
  for (const [k, v] of Object.entries(vars)) {
    const p = setPath(t, k, v)
    if (p) problems.push({ key: k, message: p })
  }
  return { theme: t, problems }
}

/** Where the theme a diagram is drawn in came from. */
export type ThemeSource = 'prop' | 'frontmatter' | 'default'
export interface ResolvedTheme {
  theme: Theme
  source: ThemeSource
  /** The name asked for (prop or frontmatter), as written; undefined for a Theme object or no theme. */
  requested?: string
  /** A theme name in the `theme` prop that nobody knows (a frontmatter one is reported with its line when the source is read). */
  problem?: ThemeProblem
  /** How many themeVariables were laid over the theme. */
  variables: number
}

/**
 * The look one diagram is drawn in: the `theme` prop (a name or a whole Theme) over the frontmatter's `config.theme`, then the
 * frontmatter's `config.themeVariables` over that. An unknown name is Classic. Pure; the component calls it.
 */
export function resolveTheme(prop: string | Theme | undefined, fm: { name?: string; variables?: Record<string, unknown> } = {}): ResolvedTheme {
  const fromProp = prop !== undefined
  const named = typeof prop === 'object' ? { theme: prop } : themeByName(prop ?? fm.name)
  const vars = fm.variables ?? {}
  return {
    theme: withVariables(named.theme, vars).theme,
    source: fromProp ? 'prop' : fm.name !== undefined ? 'frontmatter' : 'default',
    requested: typeof prop === 'string' ? prop : prop === undefined ? fm.name : undefined,
    problem: fromProp ? named.problem : undefined,
    variables: Object.keys(vars).length,
  }
}

/**
 * The width in px an ink line of token width `w` gets when the view shows `ppu` px per world unit (theme.ink): it follows the
 * drawing's scale, never wider than the token and never thinner than `ink.min` (scaled for lines wider or thinner than an outline).
 */
export const inkPx = (th: Theme, w: number, ppu: number) => (th.ink.ref === null ? w : Math.min(w, Math.max(th.ink.min * (w / th.node.outlineWidth), (w * ppu) / th.ink.ref)))

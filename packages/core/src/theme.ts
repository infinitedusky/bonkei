// Themes: a typed, JSON-serialisable token object. The scene reads tokens only; the built-in looks are presets
// of it. Decisions: LOG.md, "Themes: Classic, Bonkei, Bonkei · landscape (BON-117)". Plain .ts, no React.
import { Color } from 'three'
import type { Shape } from './model.ts'

export type Pattern = 'plain' | 'hishi' | 'flower' | 'stone' | 'hatch' | 'dither'
export interface Plate { style: 'plain' | 'cartouche'; text: string; plate: string; border: string }

/**
 * The light in a tunnel's trench (theme.edge.glow): a track where the floor meets the walls (a bright core line and a wider, fainter
 * halo round it) and a wash of light on the walls. A null colour leaves that part out; `edge.glow: off` in themeVariables nulls all three.
 * It lights only the trench: no light is added to the scene, so the blocks and lines beside it are not brightened.
 */
export interface Glow { core: string | null; coreWidth: number; halo: string | null; haloWidth: number; haloOpacity: number; wash: string | null; washIntensity: number }

/** A look as data: every colour, material, label and line style the scene reads. JSON-serialisable. */
export interface Theme {
  name: string
  ground: {
    bg: string
    grid: [string, string] | null // centre lines, other lines; null: no grid
    gridStyle: 'lines' | 'dots' // dots: a dot on every crossing (in the first colour) in place of the lines
    haze: string | null // a soft wash of this colour at the left and right edges of the view, over the ground; null: none
    hazeWidth: number // 0..1: how far in from each edge it reaches, as a share of the view's width
    major: number // a heavier grid line every this many squares over the fine grid; 0: a single-weight grid
    majorColor: string // the heavier lines' colour
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
    titleStyle: 'plain' | 'section' // section: a small square, then `01 · NAME` in letter-spaced capitals, numbered in reading order
    mark: string | null // the section title's square, and the scattered pixels of a dither side; null: the title's colour
    titles: 'fixed' | 'free' | 'off' // fixed: the back-left corner; free: a corner nothing stands on (tested against the nodes and forms on the tray); off: a box on the surface in front of the tray, with room made for it in the layout
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
    shapeText: Record<Shape, string | null> // a label colour for the nodes of one shape (on a dark fill); null: node.text
    toward: number // how far a billboarded label is pulled towards the camera, so it stands in front of a form
  }
  // Ink follows the drawing's on-screen scale: width in px = token width x (px per world unit / ref), kept between min (px, for an outline;
  // other lines get it in proportion to their own width) and the token width. ref null: fixed widths, as in Classic.
  ink: { ref: number | null; min: number }
  edge: { color: string; width: number; head: 'cone' | 'chevron'; headColor: string | null; label: string; labelOutline: string; portal: string; rim: string | null; rimWidth: number; glow: Glow; flat: boolean } // rim: the lip of a tunnel's trough; null: a dark shade of the surface; 'none': no rim. glow: the trench light. flat: lines lie on the surface under them and the arrowhead is a flat triangle. head: a cone, or an open chevron lying in the plane of the line (in headColor; null: the line's). seq.partFill/partText: a sequence participant's fill and name colour; null: the node's. seq.block: one colour for every loop/alt/opt/par block; null: a colour for each kind
  seq: { block: string | null; partFill: string | null; partText: string | null; lifeline: string; activation: string; note: string; noteText: string; blockText: string; blockSub: string; cross: string; crossLine: string }
}

// The presets are shared by every diagram on the page, so they are frozen: edit a copy (withVariables, or a spread).
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v) }
  return o
}

/** Classic (today's look) and the two Bonkei looks, for passing as `theme` or as a base to copy and edit (they are frozen). */
export const CLASSIC: Theme = deepFreeze({
  name: 'classic',
  ground: { bg: '#0f1218', grid: ['#1d2433', '#161c28'], gridStyle: 'lines', haze: null, hazeWidth: 0.3, major: 0, majorColor: '#1d2433', grain: 0, lit: true },
  light: { ambient: 0.55, sky: '#bcd0ff', floor: '#202838', hemi: 0.5, sun: 1.6, shadows: true, shading: 'standard', tones: 3, toneMapping: true },
  node: {
    colors: { rect: '#5b8def', round: '#3fbf9b', cylinder: '#e0a458', diamond: '#d96c8a' },
    form: 'block', outline: null, outlineWidth: 2, bevel: 0.03, footprint: { height: 0.12, color: '#e9dfc8', darken: 0.9 }, labelGap: 0.3,
    hover: '#ffffff', hoverIntensity: 0.18,
  },
  tray: {
    thickness: 0.25,
    colors: ['#243044', '#2d3b52', '#374862'], sides: ['plain', 'plain', 'plain'], titleStyle: 'plain', mark: null, titles: 'fixed', patternInk: '#24508F', patternPaper: '#f4efe3',
    outline: null, hover: '#8fb0ff', hoverIntensity: 0.15,
  },
  label: {
    font: null,
    node: { style: 'plain', text: '#ffffff', plate: '#ffffff', border: '#000000' },
    tray: { style: 'plain', text: '#cfd8ea', plate: '#ffffff', border: '#000000' },
    shapeText: { rect: null, round: null, cylinder: null, diamond: null }, toward: 0,
  },
  ink: { ref: null, min: 1 },
  edge: { color: '#e8edf7', width: 2, head: 'cone', headColor: null, label: '#ffd479', labelOutline: '#000000', portal: '#3fa7ff', rim: 'none', rimWidth: 1.5, flat: false,
    // the trench lit in grey-white at 30% strength: 0.6 times the standard sizes (Bonkei's below, which are 50%), and no rim
    glow: { core: '#e0e0e0', coreWidth: 2.1, halo: '#e0e0e0', haloWidth: 6.6, haloOpacity: 0.17, wash: '#e0e0e0', washIntensity: 0.18 } },
  seq: { block: null, partFill: null, partText: null, lifeline: '#5c6b8a', activation: '#f2c14e', note: '#e9d98a', noteText: '#2a2a1a', blockText: '#e8edf7', blockSub: '#cfd8ea', cross: '#ff6b6b', crossLine: '#ff9b9b' },
})

/** Classic (today's look) and the two Bonkei looks, for passing as `theme` or as a base to copy and edit (they are frozen). */
export const BONKEI: Theme = deepFreeze({
  name: 'bonkei',
  ground: { bg: '#EFE6D0', grid: null, gridStyle: 'lines', haze: null, hazeWidth: 0.3, major: 0, majorColor: '#EFE6D0', grain: 0.25, lit: false },
  light: { ambient: 1.2, sky: '#fff8e6', floor: '#d8cbaa', hemi: 0.4, sun: 1.5, shadows: false, shading: 'toon', tones: 3, toneMapping: false },
  node: {
    colors: { rect: '#9AAE8C', round: '#5E8F88', cylinder: '#C9A24A', diamond: '#7C93B8' },
    form: 'block', outline: '#2A2622', outlineWidth: 1.5, bevel: 0, footprint: { height: 0.22, color: null, darken: 0.93 }, labelGap: 0.34,
    hover: '#fff2c0', hoverIntensity: 0.15,
  },
  tray: {
    thickness: 0.42,
    colors: ['#E6DCC3', '#DACDAE', '#CDBF9C'], sides: ['hishi', 'flower', 'stone'], titleStyle: 'plain', mark: null, titles: 'free', patternInk: '#24508F', patternPaper: '#f4efe3',
    outline: '#2A2622', hover: '#fff2c0', hoverIntensity: 0.12,
  },
  label: {
    font: 'mincho',
    node: { style: 'cartouche', text: '#2A2622', plate: '#f6efdd', border: '#2A2622' },
    tray: { style: 'cartouche', text: '#f1e8d2', plate: '#23345A', border: '#2A2622' },
    shapeText: { rect: null, round: null, cylinder: null, diamond: null }, toward: 0,
  },
  ink: { ref: 40, min: 1 },
  edge: { color: '#2A2622', width: 2, head: 'cone', headColor: null, label: '#2A2622', labelOutline: '#EFE6D0', portal: '#2A2622', rim: '#2A2622', rimWidth: 2, flat: false,
    // the light is off (the tunnel looks as it always did); the sizes are the standard light a diagram gets when it sets a colour
    glow: { core: null, coreWidth: 3.5, halo: null, haloWidth: 11, haloOpacity: 0.28, wash: null, washIntensity: 0.3 } },
  seq: { block: null, partFill: null, partText: null, lifeline: '#8a7f6c', activation: '#C9A24A', note: '#f6efdd', noteText: '#2A2622', blockText: '#2A2622', blockSub: '#4a4238', cross: '#C8452C', crossLine: '#C8452C' },
})

// Bonkei with a landscape form standing on each node's footprint, and its label pulled in front of the form.
/** Classic (today's look) and the two Bonkei looks, for passing as `theme` or as a base to copy and edit (they are frozen). */
export const BONKEI_LANDSCAPE: Theme = deepFreeze({ ...BONKEI, name: 'bonkei-landscape', node: { ...BONKEI.node, form: 'landscape' }, label: { ...BONKEI.label, toward: 0.7 } })

// Blueprint: an architect's drawing. White and pale-blue line work on blue paper with a fine grid (a heavier line every 5 squares), flat (toon)
// shading, nodes and trays a shade lighter than the paper with white outlines, hatched tray sides, hand lettering, and each tray's title in a
// box on the surface in front of it. Values from the Mockups/Blueprint stories (the shaded fill on the lighter blue).
const PAPER = '#1d4f8c', INK = '#eef6ff', LINE = '#a9d6ff', TRAY_INK = '#bcdcff'
/** Blueprint, an architect's drawing on blue paper, for passing as `theme` or as a base to copy and edit (it is frozen). */
export const BLUEPRINT: Theme = deepFreeze({
  name: 'blueprint',
  ground: { bg: PAPER, grid: ['#6f97c6', '#3c6aa2'], gridStyle: 'lines', haze: null, hazeWidth: 0.3, major: 5, majorColor: '#6f97c6', grain: 0.08, lit: false },
  light: { ...BONKEI.light, ambient: 1.4, sky: '#e6f2ff', floor: PAPER, tones: 2 },
  node: {
    ...BONKEI.node,
    colors: { rect: '#2a64a8', round: '#2e6db0', cylinder: '#2a5f9f', diamond: '#3170b4' },
    outline: INK, outlineWidth: 1.5, bevel: 0, form: 'block', hover: '#9fd3ff', hoverIntensity: 0.2,
  },
  tray: {
    ...BONKEI.tray,
    thickness: 0.35, colors: ['#22599a', '#265f9f', '#2a65a5'], sides: ['hatch', 'hatch', 'hatch'], titleStyle: 'plain', mark: null, titles: 'off',
    patternInk: '#7fb2e5', patternPaper: '#1f5290', outline: TRAY_INK, hover: '#9fd3ff', hoverIntensity: 0.15,
  },
  label: {
    font: 'architect',
    node: { style: 'plain', text: INK, plate: PAPER, border: INK },
    tray: { style: 'cartouche', text: INK, plate: PAPER, border: TRAY_INK },
    shapeText: { rect: null, round: null, cylinder: null, diamond: null }, toward: 0,
  },
  ink: { ref: 40, min: 1 },
  edge: {
    color: LINE, width: 2, head: 'cone', headColor: null, label: INK, labelOutline: PAPER, portal: LINE, rim: TRAY_INK, rimWidth: 1.5, flat: false,
    // the trench lit in pale blue at the standard 50%
    glow: { core: '#bfe4ff', coreWidth: 3.5, halo: '#bfe4ff', haloWidth: 11, haloOpacity: 0.28, wash: '#bfe4ff', washIntensity: 0.3 },
  },
  seq: { block: null, partFill: null, partText: null, lifeline: '#8fb6e0', activation: '#2e6db0', note: '#22599a', noteText: INK, blockText: INK, blockSub: TRAY_INK, cross: '#ffd479', crossLine: '#ffd479' },
})

// LTech: the look of lazertechnologies.com as it is today, a light site (BON-247). White ground with a faint dot grid and a pink haze at the
// edges, navy line work, hot pink only in small marks (chevrons, the section squares, activations, portals, the tunnel's lip), flat shading,
// the footer's pixel dither on the tray sides, rounded shapes as the site's black button with white lettering. Nothing glows. Values are the
// site's tokens (--color-*), from the Mockups/LTech stories.
const WHITE = '#ffffff', NAVY = '#020a3d', PINK = '#ff42e6', HAZE = '#fff4fd', GREY = '#676c8b', RULE = '#c9cbd8'
/** LTech, after lazertechnologies.com: white, navy and small marks of hot pink, for passing as `theme` or as a base to copy and edit (it is frozen). */
export const LTECH: Theme = deepFreeze({
  name: 'ltech',
  ground: { bg: WHITE, grid: ['#8e95bd', '#8e95bd'], gridStyle: 'dots', haze: '#f6c8f0', hazeWidth: 0.28, major: 0, majorColor: '#8e95bd', grain: 0, lit: false },
  light: { ...BONKEI.light, ambient: 1.35, sky: WHITE, floor: '#eeeef4', tones: 2 },
  node: {
    ...BONKEI.node,
    colors: { rect: WHITE, round: '#111111', cylinder: WHITE, diamond: HAZE },
    outline: NAVY, outlineWidth: 1.2, bevel: 0, form: 'block', hover: PINK, hoverIntensity: 0.12,
  },
  tray: {
    ...BONKEI.tray,
    thickness: 0.4, colors: [WHITE, '#f4f4f9', '#ececf4'], sides: ['dither', 'dither', 'dither'], titleStyle: 'section', mark: PINK, titles: 'free',
    patternInk: '#9a9db3', patternPaper: WHITE, outline: RULE, hover: PINK, hoverIntensity: 0.08,
  },
  label: {
    font: 'inter',
    node: { style: 'plain', text: NAVY, plate: WHITE, border: NAVY },
    tray: { style: 'plain', text: NAVY, plate: WHITE, border: RULE },
    shapeText: { rect: null, round: WHITE, cylinder: null, diamond: null },
    toward: 0,
  },
  ink: { ref: 40, min: 1 },
  edge: {
    color: NAVY, width: 1.5, head: 'chevron', headColor: PINK, label: GREY, labelOutline: WHITE, portal: PINK, rim: PINK, rimWidth: 1.5, flat: false,
    // no light in the trench: a pink lip is the only accent
    glow: { core: null, coreWidth: 3.5, halo: null, haloWidth: 11, haloOpacity: 0.28, wash: null, washIntensity: 0.3 },
  },
  seq: { block: '#8e95bd', partFill: '#111111', partText: WHITE, lifeline: RULE, activation: PINK, note: HAZE, noteText: NAVY, blockText: NAVY, blockSub: GREY, cross: PINK, crossLine: PINK },
})

/** The built-in themes by the name a diagram or the `theme` prop uses. */
export const PRESETS: Readonly<Record<string, Theme>> = Object.freeze({ classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': BONKEI_LANDSCAPE, blueprint: BLUEPRINT, ltech: LTECH })
/** The names config.theme and the `theme` prop accept: classic, bonkei, bonkei-landscape, blueprint, ltech. */
export const THEME_NAMES = Object.keys(PRESETS)

// Tokens that take one of a few words. A path segment `#` stands for any array index.
const CHOICES: Record<string, readonly string[]> = {
  'light.shading': ['standard', 'toon'],
  'node.form': ['block', 'landscape'],
  'tray.sides.#': ['plain', 'hishi', 'flower', 'stone', 'hatch', 'dither'],
  'tray.titles': ['fixed', 'free', 'off'],
  'tray.titleStyle': ['plain', 'section'],
  'ground.gridStyle': ['lines', 'dots'],
  'edge.head': ['cone', 'chevron'],
  'label.font': ['mincho', 'architect', 'inter'],
  'label.node.style': ['plain', 'cartouche'],
  'label.tray.style': ['plain', 'cartouche'],
}

export interface ThemeProblem { key: string; message: string }
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
// A token's own key: an array takes only an index (not `length`), an object only its own keys (not `toString`, `__proto__`).
const owns = (c: object, k: string) => (Array.isArray(c) ? /^\d+$/.test(k) && Number(k) < c.length : Object.hasOwn(c, k))
const at = (o: unknown, keys: string[]) => keys.reduce<any>((c, k) => (c !== null && typeof c === 'object' && owns(c, k) ? c[k] : undefined), o)

// Tokens that may be null in any theme though a preset sets them: null leaves that part of the trench light out.
// edge.rim: null is a dark shade of the surface, as it always was (Classic's rim is 'none' now, so no preset shows it).
const NULLABLE = new Set(['edge.rim', 'edge.glow.core', 'edge.glow.halo', 'edge.glow.wash', 'ground.haze', 'tray.mark', 'edge.headColor', 'seq.block', 'seq.partFill', 'seq.partText',
  'label.shapeText.rect', 'label.shapeText.round', 'label.shapeText.cylinder', 'label.shapeText.diamond'])
// Tokens whose string is drawn as a colour, with the words they take beside one: a word three.js does not know as a colour would draw
// in white (an `off` rim drew a light rim), so it is reported instead.
const COLOURS: Record<string, readonly string[]> = { 'edge.rim': ['none'], 'edge.glow.core': [], 'edge.glow.halo': [], 'edge.glow.wash': [], 'ground.haze': [], 'tray.mark': [], 'edge.headColor': [], 'seq.block': [], 'seq.partFill': [], 'seq.partText': [],
  'label.shapeText.rect': [], 'label.shapeText.round': [], 'label.shapeText.cylinder': [], 'label.shapeText.diamond': [] }
// A colour as three.js reads one (Color.setStyle): #rgb, #rrggbb, rgb()/rgba() in numbers or %, hsl()/hsla(), or a CSS colour name.
const isColour = (s: string) =>
  /^#([\da-f]{3}|[\da-f]{6})$/i.test(s)
  || /^rgba?\(\s*(\d+\s*,\s*\d+\s*,\s*\d+|\d+%\s*,\s*\d+%\s*,\s*\d+%)\s*(,\s*\d*\.?\d+\s*)?\)$/.test(s)
  || /^hsla?\(\s*\d*\.?\d+\s*,\s*\d*\.?\d+%\s*,\s*\d*\.?\d+%\s*(,\s*\d*\.?\d+\s*)?\)$/.test(s)
  || Object.hasOwn(Color.NAMES, s.toLowerCase())
// Groups that take one word for the whole group: `edge.glow: off` (or false) turns every part of the trench light off.
const GROUP_OFF: Partial<Record<string, (g: any) => void>> = { 'edge.glow': (g: Glow) => { g.core = g.halo = g.wash = null } }

// Sets one dotted path (`node.form`, `tray.colors.0`) to a value of the type the token has. A token that can be null
// (an outline, a font) takes null or the type it has in the presets where it is set.
function setPath(t: Theme, path: string, v: unknown): string | null {
  const keys = path.split('.')
  if (keys[0] === 'name') return 'name is not a theme variable; pick the theme with config.theme'
  const parent = at(t, keys.slice(0, -1)), last = keys[keys.length - 1]
  if (parent === null || typeof parent !== 'object' || !owns(parent, last)) return `unknown theme variable ${path}`
  const old = parent[last]
  const off = Object.hasOwn(GROUP_OFF, path) ? GROUP_OFF[path] : undefined
  if (off && (v === 'off' || v === false)) { off(old); return null }
  if (old !== null && typeof old === 'object') return `${path} is a group of tokens; ${off ? 'turn it off with off, or ' : ''}set one of them (${Object.keys(old).map(k => `${path}.${k}`).join(', ')})`
  const types = new Set(Object.values(PRESETS).map(p => at(p, keys)).map(x => (x === null ? 'null' : typeof x)))
  if (NULLABLE.has(path)) types.add('null')
  if (Object.hasOwn(COLOURS, path)) types.add('string') // a colour token that no preset sets (a label colour for a shape) is still a string
  const want = [...types].filter(x => x !== 'null')
  const got = v === null ? 'null' : typeof v
  if (!types.has(got)) return `${path} must be ${want.length ? 'a ' + want.join(' or a ') : 'null'}${types.has('null') ? ' or null' : ''}; got ${JSON.stringify(v)}`
  const choices = CHOICES[keys.map(k => (/^\d+$/.test(k) ? '#' : k)).join('.')]
  if (choices?.length && typeof v === 'string' && !choices.includes(v)) return `${path} must be one of ${choices.join(', ')}; got ${JSON.stringify(v)}`
  const words = Object.hasOwn(COLOURS, path) ? COLOURS[path] : undefined
  if (words && typeof v === 'string' && !words.includes(v) && !isColour(v)) return `${path} must be a colour${words.map(w => ', ' + w).join('')} or null; got ${JSON.stringify(v)}`
  if (typeof v === 'number' && !Number.isFinite(v)) return `${path} must be a finite number; got ${JSON.stringify(v)}`
  // every number in a theme is a size, a weight or a share (none negative in the presets); a negative one draws nothing
  if (typeof v === 'number' && v < 0) return `${path} must be 0 or more; got ${v}`
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

/** Which parts of a theme's trench light are drawn, for telemetry: e.g. `core,halo,wash,rim`, `wash`, or `off` when none is. */
export function trenchParts(th: Theme): string {
  const g: Partial<Glow> = th.edge.glow ?? {} // a hand-made theme from before the light has none
  const on = [g.core && 'core', g.halo && 'halo', g.wash && 'wash', th.edge.rim !== 'none' && 'rim'].filter(Boolean)
  return on.length ? on.join(',') : 'off'
}

/**
 * The width in px an ink line of token width `w` gets when the view shows `ppu` px per world unit (theme.ink): it follows the
 * drawing's scale, never wider than the token and never thinner than `ink.min` (scaled for lines wider or thinner than an outline).
 */
export const inkPx = (th: Theme, w: number, ppu: number) => (th.ink.ref === null ? w : Math.min(w, Math.max(th.ink.min * (w / th.node.outlineWidth), (w * ppu) / th.ink.ref)))

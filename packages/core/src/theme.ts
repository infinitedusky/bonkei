// Themes: a typed, JSON-serialisable token object. The scene reads tokens only; the built-in looks are presets
// of it. Decisions: BON-32 (Themes) and the Bonkei theme prototype notes in LOG.md. Plain .ts, no React.
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

export const CLASSIC: Theme = {
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
    colors: ['#243044', '#2d3b52', '#374862'], sides: ['plain', 'plain', 'plain'], patternInk: '#24508F', patternPaper: '#f4efe3',
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
}

export const BONKEI: Theme = {
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
    colors: ['#E6DCC3', '#DACDAE', '#CDBF9C'], sides: ['hishi', 'flower', 'stone'], patternInk: '#24508F', patternPaper: '#f4efe3',
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
}

// Bonkei plus one override: a landscape form stands on each node's footprint.
export const LANDSCAPE: Theme = { ...BONKEI, name: 'landscape', node: { ...BONKEI.node, form: 'landscape' }, label: { ...BONKEI.label, toward: 0.7 } }

export const PRESETS: Record<string, Theme> = { classic: CLASSIC, bonkei: BONKEI, 'bonkei-landscape': LANDSCAPE, landscape: LANDSCAPE }

export interface ThemeProblem { message: string }
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

// Sets one dotted path (`node.form`, `tray.colors.0`) to a value of the type already there.
function setPath(t: Theme, path: string, v: unknown): string | null {
  const keys = path.split('.')
  let cur: any = t
  for (const k of keys.slice(0, -1)) {
    if (cur === null || typeof cur !== 'object' || !(k in cur)) return `unknown theme variable ${path}`
    cur = cur[k]
  }
  const last = keys[keys.length - 1]
  if (cur === null || typeof cur !== 'object' || !(last in cur)) return `unknown theme variable ${path}`
  const old = cur[last]
  if (old !== null && typeof old === 'object') return `${path} is a group of tokens; set one of them (${Object.keys(old).map(k => `${path}.${k}`).join(', ')})`
  if (old !== null && typeof v !== typeof old) return `${path} must be a ${typeof old}; got ${JSON.stringify(v)}`
  cur[last] = v
  return null
}

/** The preset a name asks for, or Classic and a problem for a name we do not know. */
export function themeByName(name: string | undefined): { theme: Theme; problem?: ThemeProblem } {
  if (name === undefined) return { theme: CLASSIC }
  const t = PRESETS[name.toLowerCase()]
  if (t) return { theme: t }
  return { theme: CLASSIC, problem: { message: `unknown theme ${JSON.stringify(name)}; known: ${Object.keys(PRESETS).join(', ')}. Drawn in classic` } }
}

/** A base theme with `themeVariables` laid over it (a copy; the preset is untouched). */
export function withVariables(base: Theme, vars: Record<string, unknown> | undefined): { theme: Theme; problems: { key: string; message: string }[] } {
  if (!vars || !Object.keys(vars).length) return { theme: base, problems: [] }
  const t = clone(base), problems: { key: string; message: string }[] = []
  for (const [k, v] of Object.entries(vars)) {
    const p = setPath(t, k, v)
    if (p) problems.push({ key: k, message: p })
  }
  return { theme: t, problems }
}

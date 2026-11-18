// Diagram options: their types, the frontmatter reader and the props-over-frontmatter merge.
// Decisions: LOG.md, "Diagram options and errors (BON-51)".
import { load, CORE_SCHEMA, YAMLException } from 'js-yaml'
import type { Mode } from './camera.ts'
import type { LabelMode } from './model.ts'
import { themeByName, withVariables, type Theme } from './theme.ts'
import { CROSSING_STYLES, type CrossingStyle } from './edges3d.ts'
import { AVOID_CROSSINGS, type AvoidCrossings } from './avoid.ts'

export type ControlName = 'zoom' | 'pan' | 'move' | 'drillIn'
// One setting for the reader's controls: all on, all off, or per control (a key left out means on).
export type Controls = boolean | Partial<Record<ControlName, boolean>>
export type ResolvedControls = Record<ControlName, boolean>

// The options a diagram's frontmatter may set (under `config.bonkei`) and props may override.
export interface DiagramOptions {
  mode?: Mode
  labels?: LabelMode
  toolbar?: boolean
  controls?: Controls
  /** How two lines that cross are drawn: 'none' (default, they cross as lines), 'bridge', 'tunnel' or 'portal'. */
  crossings?: CrossingStyle
  /** How hard the router tries to keep lines from crossing: 'off', 'some' (default) or 'strong'. Costs routing time when the diagram is drawn. */
  avoidCrossings?: AvoidCrossings
  /** Show the crossing-style and avoid-crossings groups in the toolbar. Default false. */
  crossingControls?: boolean
}
export type ResolvedOptions = Required<DiagramOptions>

// A BonkeiError means nothing can be drawn. It goes to `onError`.
export interface BonkeiError {
  kind: 'parse' | 'layout' | 'graph' | 'render'
  message: string
  line?: number
  text?: string
}
// A BonkeiWarning is a problem the diagram is drawn despite. It goes to `onWarning`.
export interface BonkeiWarning {
  kind: 'dropped' | 'frontmatter' | 'theme'
  message: string
  line: number
  text?: string
}
// Reported to `onReady` on the first frame drawn with a diagram's data.
export interface ReadyInfo { layoutMs: number; nodes: number; edges: number; dropped: number }
/** @deprecated use ReadyInfo */
export type Ready = ReadyInfo

// What was clicked: a flowchart node or group, or a sequence participant.
export interface NodeClick { id: string; label: string; kind: 'node' | 'group' | 'participant' }
// Who moved the view: the built-in toolbar, the imperative handle, or a changed `mode` option.
export interface ModeChange { source: 'toolbar' | 'handle' | 'prop' }

// The theme a diagram's frontmatter asks for (config.theme, config.themeVariables), as written.
export interface ThemeRequest { name?: string; variables?: Record<string, unknown> }

export type BonkeiOptions = DiagramOptions & {
  /** How the camera frames the diagram: 'default' leaves generous margins; 'tight' fits its real extent with a small one. */
  fit?: 'default' | 'tight'
  /** Open zoomed in on the largest tray when the whole diagram would make node labels smaller than this many pixels (a phone). 0 = off. */
  minLabelPx?: number
  /** A preset by name ('classic', 'bonkei', 'bonkei-landscape') or a whole Theme object. Over the frontmatter's config.theme. */
  theme?: string | Theme
  onError?: (error: BonkeiError) => void
  onWarning?: (warning: BonkeiWarning) => void
  onModeChange?: (mode: Mode, change: ModeChange) => void
  onNodeClick?: (node: NodeClick) => void
  onReady?: (ready: ReadyInfo) => void
}

export const DEFAULTS: Readonly<ResolvedOptions> = Object.freeze({ mode: 'iso', labels: 'top', toolbar: true, controls: true, crossings: 'none', avoidCrossings: 'some', crossingControls: false })

const MODES: readonly Mode[] = ['flat', 'iso', '3d']
const LABELS: readonly LabelMode[] = ['top', 'billboard']
const CONTROLS: readonly ControlName[] = ['zoom', 'pan', 'move', 'drillIn']

// Mermaid's own frontmatter regex (mermaid/src/diagram-api/frontmatter.ts).
const FRONTMATTER_RE = /^-{3}\s*[\n\r](.*?)[\n\r]-{3}\s*[\n\r]+/s

export interface Frontmatter {
  body: string // the source with the frontmatter block removed
  lineOffset: number // source lines before `body`
  options: DiagramOptions
  theme: ThemeRequest
  warnings: BonkeiWarning[]
}

const isMap = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const show = (v: unknown) => JSON.stringify(v) ?? String(v)
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Reads `config.bonkei` from a Mermaid frontmatter block. Everything else in the block
// (title, config.theme, themeVariables, ...) is left alone for Mermaid and for themes.
export function readFrontmatter(src: string): Frontmatter {
  const m = src.match(FRONTMATTER_RE)
  if (!m) return { body: src, lineOffset: 0, options: {}, theme: {}, warnings: [] }
  const body = src.slice(m[0].length)
  const lineOffset = m[0].split('\n').length - 1
  const yamlLines = m[1].split('\n')
  const options: DiagramOptions = {}
  const warnings: BonkeiWarning[] = []
  // yaml line i is source line i + 2 (line 1 is the opening ---)
  const at = (i: number) => ({ line: i + 2, text: yamlLines[i]?.trim() })
  const warn = (message: string, i: number) => { warnings.push({ kind: 'frontmatter', message, ...at(i) }) }
  // The line a key path is written on: each key is looked for at or after its parent's line.
  const lineOf = (path: string[]) => {
    let i = 0
    for (const key of path) {
      const re = new RegExp(`(^|[\\s{,])${reEscape(key)}\\s*:`)
      const j = yamlLines.findIndex((l, k) => k >= i && re.test(l))
      if (j < 0) break
      i = j
    }
    return i
  }

  let doc: unknown
  try {
    doc = load(m[1], { schema: CORE_SCHEMA })
  } catch (e) {
    const mark = e instanceof YAMLException ? e.mark : undefined
    warn(`frontmatter is not valid YAML: ${e instanceof YAMLException ? e.reason : String(e)}`, Math.min(mark?.line ?? 0, yamlLines.length - 1))
    return { body, lineOffset, options, theme: {}, warnings }
  }
  const theme: ThemeRequest = {}
  if (isMap(doc) && isMap(doc.config)) {
    const cfg = doc.config
    if (cfg.theme !== undefined && cfg.theme !== null) {
      if (typeof cfg.theme !== 'string') warn(`config.theme must be a theme name; got ${show(cfg.theme)}`, lineOf(['config', 'theme']))
      else {
        theme.name = cfg.theme
        const p = themeByName(cfg.theme).problem
        if (p) warnings.push({ kind: 'theme', message: p.message, ...at(lineOf(['config', 'theme'])) })
      }
    }
    if (cfg.themeVariables !== undefined && cfg.themeVariables !== null) {
      if (!isMap(cfg.themeVariables)) warn(`config.themeVariables must be a mapping; got ${show(cfg.themeVariables)}`, lineOf(['config', 'themeVariables']))
      else {
        // `node.form: landscape` and a nested `node: { form: landscape }` both mean the dotted token path
        const flat: Record<string, unknown> = {}
        const walk = (o: Record<string, unknown>, prefix: string) => { for (const [k, v] of Object.entries(o)) isMap(v) ? walk(v, prefix + k + '.') : (flat[prefix + k] = v) }
        walk(cfg.themeVariables, '')
        const base = themeByName(theme.name).theme
        for (const pr of withVariables(base, flat).problems) warnings.push({ kind: 'theme', message: pr.message, ...at(Math.max(lineOf(['config', 'themeVariables', pr.key]), lineOf(['config', 'themeVariables', pr.key.split('.').pop()!]))) })
        theme.variables = flat
      }
    }
  }
  const bonkei = isMap(doc) && isMap(doc.config) ? doc.config.bonkei : undefined
  if (bonkei === undefined || bonkei === null) return { body, lineOffset, options, theme, warnings }
  if (!isMap(bonkei)) {
    warn(`config.bonkei must be a mapping, got ${show(bonkei)}`, lineOf(['config', 'bonkei']))
    return { body, lineOffset, options, theme, warnings }
  }

  const oneOf = <T extends string>(key: string, v: unknown, allowed: readonly T[]): T | undefined => {
    if (allowed.includes(v as T)) return v as T
    warn(`config.bonkei.${key} must be one of ${allowed.join(', ')}; got ${show(v)}`, lineOf(['config', 'bonkei', key]))
    return undefined
  }
  const bool = (path: string[], v: unknown): boolean | undefined => {
    if (typeof v === 'boolean') return v
    warn(`config.${path.join('.')} must be true or false; got ${show(v)}`, lineOf(['config', ...path]))
    return undefined
  }

  for (const [key, v] of Object.entries(bonkei)) {
    if (key === 'mode') options.mode = oneOf(key, v, MODES)
    else if (key === 'labels') options.labels = oneOf(key, v, LABELS)
    else if (key === 'crossings') options.crossings = oneOf(key, v, CROSSING_STYLES)
    else if (key === 'avoidCrossings') options.avoidCrossings = oneOf(key, v, AVOID_CROSSINGS)
    else if (key === 'toolbar') options.toolbar = bool(['bonkei', key], v)
    else if (key === 'crossingControls') options.crossingControls = bool(['bonkei', key], v)
    else if (key === 'controls') {
      if (typeof v === 'boolean') { options.controls = v; continue }
      if (!isMap(v)) { warn(`config.bonkei.controls must be true, false or a mapping of ${CONTROLS.join(', ')}; got ${show(v)}`, lineOf(['config', 'bonkei', key])); continue }
      const c: Partial<Record<ControlName, boolean>> = {}
      for (const [name, on] of Object.entries(v)) {
        if (!CONTROLS.includes(name as ControlName)) { warn(`unknown control config.bonkei.controls.${name}; known: ${CONTROLS.join(', ')}`, lineOf(['config', 'bonkei', key, name])); continue }
        const b = bool(['bonkei', key, name], on)
        if (b !== undefined) c[name as ControlName] = b
      }
      options.controls = c
    } else warn(`unknown option config.bonkei.${key}; known: mode, labels, toolbar, controls, crossings, avoidCrossings, crossingControls`, lineOf(['config', 'bonkei', key]))
  }
  for (const k of Object.keys(options) as (keyof DiagramOptions)[]) if (options[k] === undefined) delete options[k]
  return { body, lineOffset, options, theme, warnings }
}

// Props over frontmatter, key by key; a `controls` object replaces the frontmatter one whole.
// The result shares no objects with its inputs or with another result.
export function mergeOptions(props: DiagramOptions = {}, fm: DiagramOptions = {}): ResolvedOptions {
  const controls = props.controls ?? fm.controls ?? DEFAULTS.controls
  return {
    mode: props.mode ?? fm.mode ?? DEFAULTS.mode,
    labels: props.labels ?? fm.labels ?? DEFAULTS.labels,
    toolbar: props.toolbar ?? fm.toolbar ?? DEFAULTS.toolbar,
    crossings: props.crossings ?? fm.crossings ?? DEFAULTS.crossings,
    avoidCrossings: props.avoidCrossings ?? fm.avoidCrossings ?? DEFAULTS.avoidCrossings,
    crossingControls: props.crossingControls ?? fm.crossingControls ?? DEFAULTS.crossingControls,
    controls: typeof controls === 'boolean' ? controls : { ...controls },
  }
}

// `true`/`false` switch every control; in an object, a control left out is on.
export function resolveControls(c: Controls = DEFAULTS.controls): ResolvedControls {
  if (typeof c === 'boolean') return { zoom: c, pan: c, move: c, drillIn: c }
  return { zoom: c.zoom ?? true, pan: c.pan ?? true, move: c.move ?? true, drillIn: c.drillIn ?? true }
}

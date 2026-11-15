import yaml from 'js-yaml'
import type { Mode } from './camera.ts'
import type { LabelMode } from './shapes.ts'

export type Controls = boolean | { zoom?: boolean; pan?: boolean; move?: boolean; drillIn?: boolean }
export interface ResolvedControls { zoom: boolean; pan: boolean; move: boolean; drillIn: boolean }

/** A problem with a diagram. `error` means nothing could be drawn; `warning` means it was drawn anyway. */
export interface BonkeiError {
  severity: 'error' | 'warning'
  kind: 'parse' | 'layout' | 'frontmatter'
  message: string
  /** 1-based line in the source you passed (frontmatter included). */
  line?: number
  /** The text of that line. */
  text?: string
}

export interface BonkeiReady { layoutMs: number; nodes: number; edges: number; dropped: number }

/** Options that can be written in the diagram's frontmatter under `config.bonkei`. */
export interface DiagramOptions {
  /** Initial view. Default `iso`. */
  mode?: Mode
  /** Labels lie on the tray (`top`) or stand up facing the camera (`billboard`). Default `top`. */
  labels?: LabelMode
  /** The built-in flat/iso/3d + fit toolbar, top-right. Default true. Independent of `controls`. */
  toolbar?: boolean
  /** Reader controls. `true` (default) all on, `false` all off, or an object naming the ones to turn off. */
  controls?: Controls
}

export interface BonkeiOptions extends DiagramOptions {
  /** A diagram that could not be drawn (severity `error`), or was drawn with lines dropped (`warning`). */
  onError?: (e: BonkeiError) => void
  /** The view changed, by the toolbar, a handle call or the `mode` prop. */
  onModeChange?: (mode: Mode) => void
  /** A node or tray was clicked (not dragged). */
  onNodeClick?: (node: { id: string; label: string; kind: 'node' | 'group' }) => void
  /** The first frame of a layout is ready, with how long layout took. */
  onReady?: (info: BonkeiReady) => void
}

const MODES = ['flat', 'iso', '3d'], LABELS = ['top', 'billboard']
const CONTROL_KEYS = ['zoom', 'pan', 'move', 'drillIn']

// Mermaid's own frontmatter pattern (mermaid/src/diagram-api/frontmatter.ts), which it parses with js-yaml.
const FRONTMATTER = /^-{3}\s*[\n\r](.*?)[\n\r]-{3}\s*[\n\r]+/s

/** Splits Mermaid frontmatter off the source and reads `config.bonkei`. Bad values are dropped with a warning, never thrown. */
export function readFrontmatter(src: string): { body: string; options: DiagramOptions; lineOffset: number; warnings: BonkeiError[] } {
  const m = src.match(FRONTMATTER)
  if (!m) return { body: src, options: {}, lineOffset: 0, warnings: [] }
  const lineOffset = m[0].split(/\r?\n/).length - 1
  const warnings: BonkeiError[] = []
  const warn = (message: string) => warnings.push({ severity: 'warning', kind: 'frontmatter', message, line: 1 })
  const options: DiagramOptions = {}
  let doc: unknown
  try { doc = yaml.load(m[1], { schema: yaml.CORE_SCHEMA }) } catch (e) {
    warn(`frontmatter is not valid YAML: ${(e as Error).message.split('\n')[0]}`)
    return { body: src.slice(m[0].length), options, lineOffset, warnings }
  }
  const raw = (doc as { config?: { bonkei?: Record<string, unknown> } } | null)?.config?.bonkei
  if (raw === undefined || raw === null) return { body: src.slice(m[0].length), options, lineOffset, warnings }
  if (typeof raw !== 'object' || Array.isArray(raw)) { warn('config.bonkei must be a mapping'); return { body: src.slice(m[0].length), options, lineOffset, warnings } }
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'mode' && MODES.includes(v as string)) options.mode = v as Mode
    else if (k === 'labels' && LABELS.includes(v as string)) options.labels = v as LabelMode
    else if (k === 'toolbar' && typeof v === 'boolean') options.toolbar = v
    else if (k === 'controls' && typeof v === 'boolean') options.controls = v
    else if (k === 'controls' && v && typeof v === 'object' && !Array.isArray(v)) {
      const c: Record<string, boolean> = {}
      for (const [ck, cv] of Object.entries(v)) {
        if (CONTROL_KEYS.includes(ck) && typeof cv === 'boolean') c[ck] = cv
        else warn(`config.bonkei.controls.${ck}: unknown control or not true/false`)
      }
      options.controls = c
    } else warn(`config.bonkei.${k}: unknown option or invalid value`)
  }
  return { body: src.slice(m[0].length), options, lineOffset, warnings }
}

/** Props override frontmatter, key by key; an undefined prop leaves the frontmatter value alone. */
export function mergeOptions(fm: DiagramOptions, props: DiagramOptions): Required<Omit<DiagramOptions, 'controls'>> & { controls: ResolvedControls } {
  const pick = <T,>(k: keyof DiagramOptions, d: T) => (props[k] ?? fm[k] ?? d) as T
  return {
    mode: pick('mode', 'iso' as Mode),
    labels: pick('labels', 'top' as LabelMode),
    toolbar: pick('toolbar', true),
    controls: resolveControls(props.controls ?? fm.controls),
  }
}

export function resolveControls(c: Controls | undefined): ResolvedControls {
  if (c === undefined || c === true) return { zoom: true, pan: true, move: true, drillIn: true }
  if (c === false) return { zoom: false, pan: false, move: false, drillIn: false }
  return { zoom: c.zoom !== false, pan: c.pan !== false, move: c.move !== false, drillIn: c.drillIn !== false }
}

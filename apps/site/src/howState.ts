// The "Keep the text. Get the scene." section's live state, with no React and no scene (BON-189): what the last
// source came to and what the note under the source says. HowScene.tsx uses it (so it ships in the scene's lazy
// chunk); howState.test.ts tests it. The gate and the start text are in howGate.ts, which the page's entry carries.
import type { BonkeiError, BonkeiWarning } from 'bonkei'

/** The scene gets the text this long after typing stops. */
export const DEBOUNCE_MS = 300

/**
 * What the last source given to the scene came to. `<Bonkei>` reports a source as: its warnings, then onReady when it
 * is drawn; or onError, then its warnings. The note shows the warnings of the source on screen, not of one still
 * being laid out, so they are gathered in `pending` and shown when the scene draws.
 */
export interface HowStatus {
  /** The last source could not be drawn; the scene still shows the one before. */
  error: BonkeiError | null
  /** Lines skipped (and other warnings) in the source the scene shows. */
  warnings: BonkeiWarning[]
  pending: BonkeiWarning[]
  /** The scene has drawn at least once. */
  drawn: boolean
  /** The text in the editor is over the size the scene is given (it was not sent): its size, for the note. */
  over: Size | null
}

/** The most the scene is given: past a few hundred links its layout blocks the page for seconds. */
export const MAX = { lines: 200, links: 150 }

export interface Size { lines: number; links: number }

/** Lines, and links (a run of `-`, `=` or `.` as in -->, ---, ==>, -.->), roughly: enough to keep a pasted wall of edges out. */
export function sizeOf(text: string): Size {
  return { lines: text.split('\n').length, links: text.match(/[-=.]{2,}>?/g)?.length ?? 0 }
}

/** Whether a text is over what the scene is given. */
export const isOver = (z: Size) => z.lines > MAX.lines || z.links > MAX.links

/** The scene's WebGL context was lost after it drew (a GPU reset, the browser reclaiming it): treated as drawing broke. */
export const LOST: BonkeiError = { kind: 'render', message: 'WebGL context lost' }

export type HowEvent =
  | { type: 'sent' } // a new source was given to the scene
  | { type: 'warning'; warning: BonkeiWarning }
  | { type: 'ready' }
  | { type: 'error'; error: BonkeiError }
  | { type: 'over'; size: Size | null } // the editor's text went over the size (not sent), or came back to the one shown

export const INITIAL: HowStatus = { error: null, warnings: [], pending: [], drawn: false, over: null }

export function howReducer(s: HowStatus, e: HowEvent): HowStatus {
  switch (e.type) {
    case 'sent': return { ...s, pending: [], over: null }
    case 'warning': return { ...s, pending: [...s.pending, e.warning] }
    case 'ready': return { ...s, error: null, warnings: s.pending, pending: s.pending, drawn: true }
    case 'error': return { ...s, error: e.error }
    case 'over': return { ...s, over: e.size }
  }
}

/**
 * The section gives up on the live scene and shows the still when nothing was ever drawn (the sample itself failed),
 * or when drawing itself broke (WebGL lost or missing: kind `render`). A source that can't be read is not a reason:
 * the last diagram stays and the note says why.
 */
export const fallsBack = (s: HowStatus, error: BonkeiError) => !s.drawn || error.kind === 'render'

const clause = (m: string) => m.replace(/[.\s]+$/, '')

/** The note under the source. */
export function noteOf(s: HowStatus): { tone: 'ok' | 'warn'; text: string } {
  if (s.over) {
    const by = s.over.links > MAX.links ? `${s.over.links} links (up to ${MAX.links})` : `${s.over.lines} lines (up to ${MAX.lines})`
    return { tone: 'warn', text: `Not updated: too big for the live scene, ${by}. Showing the last diagram that worked.` }
  }
  if (s.error) {
    const at = s.error.line !== undefined ? `line ${s.error.line}: ` : ''
    return { tone: 'warn', text: `Not updated: ${at}${clause(s.error.message)}. Showing the last diagram that worked.` }
  }
  if (s.warnings.length) {
    const [w] = s.warnings
    const more = s.warnings.length > 1 ? ` (+${s.warnings.length - 1} more)` : ''
    const head = w.kind === 'dropped' ? `Skipped line ${w.line}: ` : w.line > 0 ? `Line ${w.line}: ` : ''
    return { tone: 'warn', text: `${head}${clause(w.message)}${more}` }
  }
  return { tone: 'ok', text: 'Live: edit the text, the scene follows' }
}

/** What an update came to, for telemetry: drawn, drawn with lines skipped, or not drawn (the last diagram kept). */
export const outcomeOf = (s: HowStatus): 'drawn' | 'skipped' | 'not-updated' => s.error || s.over ? 'not-updated' : s.warnings.length ? 'skipped' : 'drawn'

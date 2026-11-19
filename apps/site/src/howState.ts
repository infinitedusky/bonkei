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
}

export type HowEvent =
  | { type: 'sent' } // a new source was given to the scene
  | { type: 'warning'; warning: BonkeiWarning }
  | { type: 'ready' }
  | { type: 'error'; error: BonkeiError }

export const INITIAL: HowStatus = { error: null, warnings: [], pending: [], drawn: false }

export function howReducer(s: HowStatus, e: HowEvent): HowStatus {
  switch (e.type) {
    case 'sent': return { ...s, pending: [] }
    case 'warning': return { ...s, pending: [...s.pending, e.warning] }
    case 'ready': return { error: null, warnings: s.pending, pending: s.pending, drawn: true }
    case 'error': return { ...s, error: e.error }
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
export const outcomeOf = (s: HowStatus): 'drawn' | 'skipped' | 'not-updated' => s.error ? 'not-updated' : s.warnings.length ? 'skipped' : 'drawn'

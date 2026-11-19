// The "Keep the text. Get the scene." section's gate and start text (BON-189). How.tsx uses it, so it is in the page's
// entry chunk: keep it small and free of the scene. The live state is in howState.ts, in the scene's lazy chunk.

/** The sample as the section shows it: without a leading %% comment line. */
export const startOf = (sample: string) => sample.replace(/^%%.*\n/, '')

export type Gate = 'live' | 'phone' | 'no-webgl2'

/** The hero's gate: a narrow or touch-first screen gets the still, as does a browser without WebGL 2. */
export function gateOf(env: { narrow: boolean; coarse: boolean; webgl2: boolean }): Gate {
  if (env.narrow || env.coarse) return 'phone'
  return env.webgl2 ? 'live' : 'no-webgl2'
}

/** The gate for this browser. */
export function probeGate(): Gate {
  if (typeof matchMedia !== 'function' || typeof document === 'undefined') return 'no-webgl2'
  let webgl2 = false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl2 = !!gl
  } catch {
    webgl2 = false
  }
  return gateOf({ narrow: matchMedia('(max-width:760px)').matches, coarse: matchMedia('(pointer:coarse)').matches, webgl2 })
}

const CLAIM = 'Edit the source, and the scene re-lays itself out as you type.'

/**
 * The line under the section when it shows the still: `gate` null while it is not known yet; `failed` when the live
 * scene broke after starting (WebGL lost). Only a phone is sent to a desktop.
 */
export function stillNote(gate: Gate | null, failed: boolean): string {
  if (failed) return `${CLAIM} The live scene stopped in this browser; reload the page to try it again.`
  if (gate === 'phone') return `${CLAIM} Try it live on a desktop.`
  if (gate === 'no-webgl2') return `${CLAIM} Trying it live needs WebGL 2, which this browser has turned off or lacks.`
  return CLAIM
}

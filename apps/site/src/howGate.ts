// The "Keep the text. Get the scene." section's gate and start text (BON-189). How.tsx uses it, so it is in the page's
// entry chunk: keep it small and free of the scene. The live state is in howState.ts, in the scene's lazy chunk.

import type { BonkeiError } from 'bonkei' // a type only: erased at build, nothing of the scene in the entry chunk

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

/** The hero's path: `forced` is a page that asked for the poster (`live={false}`: the no-WebGL and phone screens in Storybook). */
export type HeroGate = Gate | 'forced'

/** The hero's gate: `live` forces it (true: the scene, false: the poster), unset asks this browser (`probe`, probeGate). */
export function heroGateOf(live: boolean | undefined, probe: () => Gate): HeroGate {
  return live === undefined ? probe() : live ? 'live' : 'forced'
}

/**
 * What the hero paints (BON-209): `live` is the live scene on an empty stage, faded in on its first frame, and never the
 * poster; `poster` is the picture, its caption and "see the source". Only a device that can't go live, or a scene whose
 * chunk failed, gets the poster.
 */
export function heroShows(gate: HeroGate, failed: boolean): 'live' | 'poster' {
  return gate === 'live' && !failed ? 'live' : 'poster'
}

/**
 * Whether an error from the hero's scene (<Bonkei> onError) sends it to the poster: any error before its first frame
 * (the probe passed but the scene could not make its own WebGL context, so nothing will draw), or drawing broke after it.
 * Otherwise the drawn diagram stays. The same rule as the "Keep the text" section's (howState.ts fallsBack).
 */
export const heroFallsBack = (drawn: boolean, error: BonkeiError) => !drawn || error.kind === 'render'

/** The `site.hero.path` span's attributes: the path, and for the poster why. */
export function heroPathAttrs(gate: HeroGate): Record<string, string> {
  return gate === 'live' ? { 'site.hero.path': 'live' } : { 'site.hero.path': 'poster', 'site.hero.reason': gate }
}

/**
 * What the "Keep the text" section paints (BON-209): `still` is the source and still-iso.png (phone, no WebGL 2, or the
 * scene failed); on a desktop that goes live it is never the still: `shell` (the section's frame with an empty stage of
 * the scene's size) until the section comes near the screen, then `scene` (the shell again while the chunk loads, then
 * the scene fading in on its first frame).
 */
export function howShows(gate: Gate, failed: boolean, near: boolean): 'still' | 'shell' | 'scene' {
  if (gate !== 'live' || failed) return 'still'
  return near ? 'scene' : 'shell'
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

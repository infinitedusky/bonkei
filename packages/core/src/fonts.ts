// Bundled fonts a theme can name (theme.label.font). Zen Old Mincho Bold, SIL OFL 1.1 (fonts/OFL-ZenOldMincho.txt), and Blueprint's
// Architects Daughter Regular, SIL OFL 1.1 (fonts/OFL-ArchitectsDaughter.txt), each
// subset to Latin (31 KB and 20 KB) because troika loads the whole file. drei's <Text> takes a url.
// Imported by node tests and scripts: explicit .ts extensions, no .tsx.
//
// Found like the wasm (BON-52, LOG.md): nothing is worked out on import. The URL is made when a theme first asks for the font.
// An ES module bundled by the host finds the file from `import.meta.url` (`dist/fonts/`, the pattern Vite, webpack and Rollup turn
// into an asset). The script-tag bundle has no `import.meta.url` and takes `fonts/` from beside the script, the base avoid.ts reads.
// The file is fetched once and checked to be a font. If it is missing (Vite 5's dev pre-bundling moves the module away from it),
// the labels get drei's default font instead of never drawing, and the failure is reported (`bonkei.font.fallback`, onWarning).
import { scriptSrc } from './avoid.ts'
import { withSpan } from './telemetry.ts'

/** The font names a theme may give as label.font. */
export const FONT_NAMES = ['mincho', 'architect'] as const
export type FontName = typeof FONT_NAMES[number]

// One literal `new URL(…, import.meta.url)` per file, so a host bundler sees each one.
function moduleUrl(name: FontName): string {
  switch (name) {
    case 'mincho': return new URL('./fonts/ZenOldMincho-Bold-latin.ttf', import.meta.url).href
    case 'architect': return new URL('./fonts/ArchitectsDaughter-Regular-latin.ttf', import.meta.url).href
  }
}
const FILES: Record<FontName, string> = { mincho: 'ZenOldMincho-Bold-latin.ttf', architect: 'ArchitectsDaughter-Regular-latin.ttf' }

/** Where the browser finds a bundled font: beside the module, or in `fonts/` beside the script tag. Undefined for an unknown name, or with neither. */
export function fontFileUrl(name: string): string | undefined {
  if (!(FONT_NAMES as readonly string[]).includes(name)) return undefined
  if (import.meta.url) return moduleUrl(name as FontName)
  return scriptSrc ? new URL('fonts/' + FILES[name as FontName], scriptSrc).href : undefined
}

/** A font as loaded: the URL for drei's <Text> (undefined: drei's default font) and, when the bundled file could not be used, why. */
export interface LoadedFont { url: string | undefined; problem?: string }

// TrueType, OpenType (CFF), the old Apple tag, WOFF: what troika reads. Anything else (an HTML 404 page served with 200) is not a font.
const MAGIC = [[0, 1, 0, 0], [0x4f, 0x54, 0x54, 0x4f], [0x74, 0x72, 0x75, 0x65], [0x77, 0x4f, 0x46, 0x46]]
/** True when the bytes start like a font file. */
export function isFont(b: Uint8Array): boolean { return MAGIC.some(m => m.every((x, i) => b[i] === x)) }

/** The order a font is found in, apart from the loading so it can be tested: the file at `url`, checked to be a font; else
 * undefined (drei's default) and the reason. Never rejects: a label must draw without it. */
export async function findFont(name: string, url: string | undefined, get: (url: string) => Promise<Uint8Array>): Promise<LoadedFont> {
  if (!url) return { url: undefined, problem: `font ${name}: no URL for it (unknown name, or no module or script URL to find it from)` }
  try {
    const bytes = await get(url)
    if (!isFont(bytes)) throw new Error(`not a font file (${bytes.length} bytes)`)
    return { url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'font/ttf' })) : url }
  } catch (e) {
    return { url: undefined, problem: `font ${name} could not be loaded from ${url} (${e instanceof Error ? e.message : String(e)}); labels use the default font` }
  }
}

const fetchBytes = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`.trim())
  return new Uint8Array(await r.arrayBuffer())
}
const loading = new Map<string, Promise<LoadedFont>>()
/** Loads a bundled font once, inside a `bonkei.font.load` span (name, URL, ms; a `bonkei.font.fallback` event when the default font is used).
 * drei gets the fetched bytes as a blob: URL, so the file is downloaded once. */
export function loadFont(name: string): Promise<LoadedFont> {
  let p = loading.get(name)
  if (!p) {
    const url = fontFileUrl(name)
    p = withSpan('bonkei.font.load', { 'bonkei.font': name, 'bonkei.font.url': url ?? '' }, async span => {
      const t = performance.now()
      const font = await findFont(name, url, fetchBytes)
      span.setAttributes({ 'bonkei.font.fallback': !!font.problem, 'bonkei.font_load_ms': performance.now() - t })
      if (font.problem) span.addEvent('bonkei.font.fallback', { 'bonkei.error': font.problem })
      return font
    })
    loading.set(name, p)
  }
  return p
}

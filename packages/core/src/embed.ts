// Pure helpers for the embeds (BON-53): which sources Bonkei draws, how an element's text becomes a source, and heights.
// No DOM and no React here, so node --test can import it. @bonkei/vitepress keeps its own copy of isSupported() (it runs in
// Node at build time and imports nothing from bonkei); both packages' tests run the same cases.

/** Height of a <bonkei-diagram> (and of a VitePress diagram) when nothing else sets one, in px. */
export const DEFAULT_HEIGHT = 420

const FRONTMATTER = /^\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/
const COMMENTS = /^(\s*%%[^\n]*\n)+/

/** True for a flowchart (`flowchart` / `graph`) a sequence diagram or an Ishikawa diagram, after optional frontmatter and %% comment lines. */
export function isSupported(source: string): boolean {
  const body = source.replace(FRONTMATTER, '').replace(COMMENTS, '')
  return /^\s*(flowchart|graph|sequenceDiagram|ishikawa(?:-beta)?)\b/.test(body)
}

/** The element's text with leading blank lines and trailing space dropped and the common indent removed,
 * so a diagram can be indented inside the page's HTML. */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n')
  const widths = lines.filter(l => l.trim()).map(l => /^[ \t]*/.exec(l)![0].length)
  const indent = widths.length ? Math.min(...widths) : 0
  return lines.map(l => l.slice(indent)).join('\n')
}

/** A height attribute as CSS: a bare number is px ("600" -> "600px"); a CSS length is kept; anything else is null. */
export function cssHeight(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`
  if (/^\d+(\.\d+)?(px|em|rem|vh|%)$/.test(v)) return v
  return null
}

import type MarkdownIt from 'markdown-it'

/** Height of a diagram in px when neither the site nor the fence sets one: 420. */
export const DEFAULT_HEIGHT: number
/** True for a flowchart or a sequence diagram (after optional frontmatter and %% comments): the fences the plugin claims. */
export function isSupported(source: string): boolean
/** The `{…}` after ```mermaid as key/value strings; null when the fence is not mermaid. */
export function parseInfo(info: string): Record<string, string> | null

export interface FenceEvent {
  /** True when the fence became a Bonkei diagram. */
  claimed: boolean
  /** 'supported', why it was passed on ('not mermaid', 'unsupported diagram type'), or what was corrected (a bad height or mode). */
  reason: string
  /** The page, relative to the docs root. */
  file?: string
}

export interface BonkeiMarkdownOptions {
  /** Height of every diagram in px unless the fence sets its own (```mermaid {height=600}). Default 420. */
  height?: number
  /** A theme name for every diagram (classic, bonkei, bonkei-landscape, blueprint); a fence's {theme=…} wins. */
  theme?: string
  /** The starting view for every diagram; a fence's {mode=…} wins. */
  mode?: 'flat' | 'iso' | '3d'
  /** Called for every fence at build time: claimed, or passed on, and why. */
  onFence?: (e: FenceEvent) => void
}

/** markdown-it plugin for VitePress's `markdown.config`: ```mermaid flowcharts and sequence diagrams become <BonkeiDiagram>. */
export function bonkeiMarkdown(md: MarkdownIt, options?: BonkeiMarkdownOptions): void

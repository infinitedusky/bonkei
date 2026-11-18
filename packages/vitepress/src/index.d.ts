import type MarkdownIt from 'markdown-it'
export const DEFAULT_HEIGHT: number
export function isSupported(source: string): boolean
export interface BonkeiMarkdownOptions {
  /** Height of every diagram in px unless the fence sets its own ({height=600}). Default 420. */
  height?: number
  theme?: string
  mode?: 'flat' | 'iso' | '3d'
  /** Called for every mermaid fence at build time: claimed, or passed on with the reason. */
  onFence?: (e: { claimed: boolean, reason: string, file?: string }) => void
}
export function bonkeiMarkdown(md: MarkdownIt, options?: BonkeiMarkdownOptions): void

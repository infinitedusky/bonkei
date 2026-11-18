import type { App, DefineComponent } from 'vue'

export const DEFAULT_HEIGHT: number
/** The box a ```mermaid fence becomes: server-rendered at its height, drawn by bonkei (loaded on mount) in the browser. */
export const BonkeiDiagram: DefineComponent<{ source: string; height?: number | string; mode?: 'flat' | 'iso' | '3d'; theme?: string }>
/** Registers <BonkeiDiagram> on the app: call it in the theme's enhanceApp. */
export function enhanceAppWithBonkei(app: App): void

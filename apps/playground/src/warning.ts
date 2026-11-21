// The warning the playground shows. A theme warning on line 0 came from the theme menu (the prop), so it outlives a new
// source; every other warning, a stage's among them (they are on line 0 too), belongs to the source it came from.
export type ShownWarning = { kind: 'theme' | 'stage'; message: string; line: number }

export const keptOnNewSource = (w: ShownWarning | null): ShownWarning | null => (w && w.kind === 'theme' && w.line === 0 ? w : null)

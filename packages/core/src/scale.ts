// Layout-to-world scale and the scene's fixed heights. Plain .ts so node (strip-types) can load
// it through camera.ts; shapes.tsx re-exports these for existing imports.
export const S = 1 / 40 // px -> world
export const TRAY = 0.25 // tray thickness (one level)
export const NODE_H = 0.7

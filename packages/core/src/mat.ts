// What Mat gives a lit surface when the caller names no roughness or metalness: three's own MeshStandardMaterial defaults,
// so a mesh that moved from <meshStandardMaterial> to <Mat> draws the same in Classic (mat.test.ts checks them against three).
export const MAT_DEFAULTS = { roughness: 1, metalness: 0 } as const

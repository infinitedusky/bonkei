// Where a tray's title plaque sits so that nothing stands on it. Plain TS (tested without React).
// Candidates are the four corners of the tray top, back-left first (where Classic always puts it). A candidate is free when no node or
// child tray on the tray, grown by `grow` (a form stands taller than its footprint, so it hides more than the footprint), overlaps it.
export type Corner = 'bl' | 'br' | 'fl' | 'fr' // back / front, left / right (back = -z)
export interface Rect { x0: number; x1: number; z0: number; z1: number }
export const CORNERS: Corner[] = ['bl', 'fl', 'fr', 'br'] // back-left first, then the front, which forms never stand over
const MARGIN = 0.25, EDGE = 0.5 // from the tray's edge: the title's anchor (matches the fixed placement)

/** The title's footprint on the tray top, in tray-local units, for a corner. */
export function titleRect(c: Corner, w: number, h: number, tw: number, th: number): Rect {
  const left = c === 'bl' || c === 'fl', back = c === 'bl' || c === 'br'
  const x0 = left ? -w / 2 + MARGIN : w / 2 - MARGIN - tw
  const zc = back ? -h / 2 + EDGE : h / 2 - EDGE
  return { x0, x1: x0 + tw, z0: zc - th / 2, z1: zc + th / 2 }
}
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))
/** How far each side of a footprint is grown: a form stands up the screen, which is the back (-z, and -x in iso), so it hides what lies behind it. */
export interface Grow { x0: number; x1: number; z0: number; z1: number }
const grown = (r: Rect, g: Grow): Rect => ({ x0: r.x0 - g.x0, x1: r.x1 + g.x1, z0: r.z0 - g.z0, z1: r.z1 + g.z1 })

/** Picks a corner: `prev` if it is still free (so the title does not jump about while a node is dragged), else the first free one, else the least covered. */
export function pickCorner(w: number, h: number, tw: number, th: number, kids: Rect[], grow: Grow, prev?: Corner): Corner {
  const cover = (c: Corner) => { const t = titleRect(c, w, h, tw, th); return kids.reduce((s, k) => s + overlap(t, grown(k, grow)), 0) }
  if (prev && cover(prev) === 0) return prev
  let best: Corner = 'fl', least = Infinity
  for (const c of CORNERS) { const v = cover(c); if (v === 0) return c; if (v < least) { least = v; best = c } }
  return best
}

/** About how wide a title is (world units) at font size `size`. */
export const titleWidth = (text: string, size: number) => text.length * size * 0.56 + size * 1.1

// Mermaid ishikawa-beta: parse + our own layout (no ELK). Layout plane: x along the spine toward the head (right), y across it.
import { REASON, type Dropped } from './model.ts'

export interface FItem { label: string; kids: FItem[]; ind: number }
export interface FishDoc { effect: string | null; cats: FItem[]; dropped: Dropped[] }

export const isFish = (src: string) => /^\s*ishikawa(-beta)?\s*$/m.test(src)

// The first line after the keyword is the effect; lines at its indent are categories; deeper lines are causes, at any depth.
// `lineOffset` is the number of source lines before `src` (a frontmatter block), as in `parse`.
export function parseFish(src: string, lineOffset = 0): FishDoc {
  const dropped: Dropped[] = [], root: FItem = { label: '', kids: [], ind: -1 }, stack: FItem[] = []
  let effect: string | null = null, base = -1, seenKey = false
  for (const [i, raw] of src.split('\n').entries()) {
    const l = raw.trim()
    if (!l || l.startsWith('%%')) continue
    const line = i + 1 + lineOffset
    if (!seenKey) { seenKey = true; continue } // the keyword
    if (/\t/.test(raw.match(/^\s*/)![0])) { dropped.push({ line, text: l, reason: REASON.tab }); continue }
    const ind = raw.length - raw.trimStart().length
    if (effect === null) { effect = l; base = ind; continue }
    if (ind < base) { dropped.push({ line, text: l, reason: REASON.indent }); continue }
    const it: FItem = { label: l, kids: [], ind }
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop()
    ;(stack.length ? stack[stack.length - 1] : root).kids.push(it)
    stack.push(it)
  }
  if (effect === null) dropped.push({ line: 1 + lineOffset, text: 'ishikawa-beta', reason: REASON.noEffect })
  return { effect, cats: root.kids, dropped }
}

export interface FishPiece { kind: 'cat' | 'cause'; depth: number; label: string; x: number; y: number; w: number; h: number } // x, y: centre
export interface FishRod { a: [number, number]; b: [number, number]; depth: number } // a -> b, the arrowhead at b
export interface FishLayout {
  kind: 'fish'; width: number; height: number
  head: { label: string; x: number; y: number; w: number; h: number }
  pieces: FishPiece[]; rods: FishRod[]
}

const pillW = (t: string) => t.length * 8.5 + 34
const count = (n: FItem): number => 1 + n.kids.reduce((m, k) => m + count(k), 0)
const ROW = 40

// kids that slant into a level line at y = pz, whose front end (the parent pill's front) is at xa. Each takes one row on the far side of
// the line (d), the first farthest; an item's own causes take the rows between it and the line, each on a level line into its diagonal.
function hangSlanted(kids: FItem[], pz: number, xa: number, d: number, depth: number, pieces: FishPiece[], rods: FishRod[]) {
  const fx = xa + 8
  let off = 0
  for (const kid of [...kids].reverse()) {
    const dz = (off + count(kid)) * ROW, sz = pz + d * dz, sw = pillW(kid.label) * Math.max(0.7, 1 - 0.12 * (depth - 2))
    rods.push({ a: [fx, sz], b: [fx + 0.62 * dz, pz], depth })
    pieces.push({ kind: 'cause', depth, label: kid.label, x: fx - sw / 2, y: sz, w: sw, h: 28 })
    let r = off
    for (const g of kid.kids) {
      r += 1
      const gz = pz + d * r * ROW, gx = fx + 0.62 * (dz - r * ROW), gw = pillW(g.label) * Math.max(0.7, 1 - 0.12 * (depth - 1)), gf = fx - 40
      rods.push({ a: [gf, gz], b: [gx, gz], depth: depth + 1 })
      pieces.push({ kind: 'cause', depth: depth + 1, label: g.label, x: gf - gw / 2, y: gz, w: gw, h: 26 })
      hangSlanted(g.kids, gz, gf, d, depth + 2, pieces, rods)
      r += count(g) - 1
    }
    off += count(kid)
  }
}

export function layoutFish(doc: FishDoc): FishLayout {
  const pieces: FishPiece[] = [], rods: FishRod[] = [], cats = doc.cats, cols = Math.max(1, Math.ceil(cats.length / 2))
  // a bone's length grows with what hangs on it; each side shares one length so the category blocks line up
  const need = (c: FItem) => 90 + c.kids.reduce((s, k) => s + 56 + (count(k) - 1) * ROW, 0)
  const side = [0, 1].map(sd => Math.max(300, ...cats.filter((_, k) => k % 2 === sd).map(need)))
  const colW = Math.max(460, ...cats.map(c => Math.max(0, ...c.kids.map(k => pillW(k.label))) + 260))
  const headX = 120 + colW * cols + 60
  rods.push({ a: [0, 0], b: [headX, 0], depth: 0 })
  const head = { label: doc.effect ?? '', x: headX + 150, y: 0, w: 300, h: 170 }
  cats.forEach((c, k) => {
    // Mermaid's order: the first categories nearest the head, alternating top and bottom
    const col = cols - 1 - Math.floor(k / 2), s = k % 2 === 0 ? -1 : 1, len = side[k % 2]
    const bx = 120 + colW * (col + 1), ex = bx - len * 0.62, ez = s * len
    rods.push({ a: [ex, ez - s * 30], b: [bx, 0], depth: 1 })
    pieces.push({ kind: 'cat', depth: 1, label: c.label, x: ex, y: ez, w: Math.max(150, pillW(c.label) + 20), h: 60 })
    let along = 80 // distance from the bone's tip, across the spine
    for (const cause of c.kids) {
      const rows = cause.kids.reduce((n, k) => n + count(k), 0)
      const pz = ez - s * (along + rows * ROW), z0 = ez - s * 30, t = (pz - z0) / -z0, px = ex + (bx - ex) * t, w = pillW(cause.label)
      const crx = px - (rows ? 70 + 25 * rows : 60)
      rods.push({ a: [crx, pz], b: [px, pz], depth: 2 })
      pieces.push({ kind: 'cause', depth: 2, label: cause.label, x: crx - w / 2, y: pz, w, h: 34 })
      hangSlanted(cause.kids, pz, crx, s, 3, pieces, rods)
      along += 56 + rows * ROW
    }
  })
  // move it into the positive quarter, with a margin
  const xs = [head.x - head.w / 2, head.x + head.w / 2, ...pieces.flatMap(p => [p.x - p.w / 2, p.x + p.w / 2]), ...rods.flatMap(r => [r.a[0], r.b[0]])]
  const ys = [head.y - head.h / 2, head.y + head.h / 2, ...pieces.flatMap(p => [p.y - p.h / 2, p.y + p.h / 2]), ...rods.flatMap(r => [r.a[1], r.b[1]])]
  const PAD = 40, dx = PAD - Math.min(...xs), dy = PAD - Math.min(...ys)
  head.x += dx; head.y += dy
  pieces.forEach(p => { p.x += dx; p.y += dy })
  rods.forEach(r => { r.a[0] += dx; r.a[1] += dy; r.b[0] += dx; r.b[1] += dy })
  return { kind: 'fish', width: Math.max(...xs) + dx + PAD, height: Math.max(...ys) + dy + PAD, head, pieces, rods }
}

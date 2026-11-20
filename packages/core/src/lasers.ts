// Lazers: where the mirrors go, how big each piece may be, and which colour each node fires. Pure functions on the drawn lines (world
// units: x, y up, z), so the pieces follow the plan whenever it is rebuilt (a drag frame). Decisions: LOG.md, "Lazers theme (BON-248)".
// Imported by node tests: .ts only.
export type V = [number, number, number]
export interface Line { pts: V[]; ci: number } // a drawn part of an edge, and the index of its colour
// size: the piece's scale, 1 = full; slim: no room even at the smallest scale, so only a thin plate line and the bounce spot are drawn
export interface Sized { size: number; slim: boolean; hidden?: boolean } // hidden: so near another piece that it is one corner seen twice; not drawn
export interface MirrorAt extends Sized { at: V; a: V; b: V; ci: number; double?: boolean } // a plate on a bend: beam in along a, out along b. double: silvered both sides (two beams turn in its plane from opposite sides)
export interface PeriscopeAt extends Sized { from: V; to: V; a: V; ci: number; glass?: boolean } // two bends of a jog in one box. glass: other beams pass through it (half-silvered)
/** t: one way in, two out (or the reverse), none straight; many: three or more parting, or turns no one plate serves. */
export type PrismKind = 't' | 'many'
export interface PrismAt extends Sized { at: V; ins: V[]; outs: V[]; ci: number; kind: PrismKind } // beams that part with no plate to serve them: a small glass prism
/**
 * mirrors: plain plates (one beam turns); halves: half-silvered plates where one beam turns and others pass through (a split or a join);
 * doubles: full plates silvered both sides; prisms: true Ts and three or more parting.
 */
export interface Bends { mirrors: MirrorAt[]; periscopes: PeriscopeAt[]; halves: MirrorAt[]; doubles: MirrorAt[]; prisms: PrismAt[]; merged: number } // merged: pieces left out because they sat on another's corner

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V) => Math.hypot(a[0], a[1], a[2])
const dist = (a: V, b: V) => len(sub(a, b))
const unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const same = (a: V, b: V) => dist(a, b) < 1e-6
const add = (a: V, b: V, t = 1): V => [a[0] + b[0] * t, a[1] + b[1] * t, a[2] + b[2] * t]

function onSeg(q: V, a: V, b: V) {
  const ab = sub(b, a), t = dot(sub(q, a), ab) / (dot(ab, ab) || 1)
  if (t < -1e-9 || t > 1 + 1e-9) return false
  return dist(add(a, ab, t), q) < 0.05 // a hair: lines nudged apart by the router still share the corner
}

const SHARE = 0.12 // bends this close are one corner
const SAME = 0.01 // directions this close are the same

interface Pass { a: V; b: V } // a beam through a point: in along a, out along b (a = b: straight on)
const samePass = (x: Pass, y: Pass) => dist(x.a, y.a) < SAME && dist(x.b, y.b) < SAME

/** The distinct ways beams go through `p`: beams that coincide (same way in, same way out) count once. A beam that starts or ends at p does not pass it. */
function passes(lines: { pts: V[] }[], p: V): Pass[] {
  const out: Pass[] = []
  for (const { pts } of lines) {
    for (let k = 0; k < pts.length - 1; k++) {
      if (!onSeg(p, pts[k], pts[k + 1])) continue
      const d = unit(sub(pts[k + 1], pts[k]))
      let pass: Pass | null
      if (dist(p, pts[k + 1]) < SHARE) pass = k + 2 < pts.length ? { a: d, b: unit(sub(pts[k + 2], pts[k + 1])) } : null // a bend (or its end)
      else if (dist(p, pts[k]) < SHARE) { if (k === 0) pass = null; else continue } // a start; a bend here was the previous segment's
      else pass = { a: d, b: d }
      if (pass && !out.some(o => samePass(o, pass!))) out.push(pass)
      break
    }
  }
  return out
}

const isTurn = (x: Pass) => dist(x.a, x.b) > SAME
const normal = (x: Pass) => unit(sub(x.b, x.a))
const parallel = (x: V, y: V) => Math.abs(dot(x, y)) > 0.999

// ---------- sizes: every piece is a sphere or a capsule (a bound on its box) that must clear its neighbours ----------
const RHO = { mirror: 0.26, periscope: 0.215, prism: 0.25 } // the bound's radius at full size (plate 0.4 x 0.32; box 0.34 x 0.26; prism r 0.2, 0.3 tall)
const SMALLEST = 0.3 // the smallest scale a piece is drawn at; below it, slim
const SLIM = 0.07 // the radius of the slim form
const MARGIN = 0.02 // clear air between a piece and what is next to it
const OWN = 0.06 // a beam this close to a piece goes through it: it is the piece's own

interface Piece { p: V; q: V; rho: number; cap: number; ref: Sized }
function segSegDist(p1: V, q1: V, p2: V, q2: V) {
  // closest points of two segments (Ericson, Real-Time Collision Detection 5.1.9)
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r)
  let s: number, t: number
  const cl = (x: number) => Math.min(1, Math.max(0, x))
  if (a < 1e-12 && e < 1e-12) return len(r)
  if (a < 1e-12) { s = 0; t = cl(f / e) } else {
    const c = dot(d1, r)
    if (e < 1e-12) { t = 0; s = cl(-c / a) } else {
      const b = dot(d1, d2), den = a * e - b * b
      s = den > 1e-12 ? cl((b * f - c * e) / den) : 0
      t = (b * s + f) / e
      if (t < 0) { t = 0; s = cl(-c / a) } else if (t > 1) { t = 1; s = cl((b - c) / a) }
    }
  }
  return dist(add(p1, d1, s), add(p2, d2, t))
}
/** The distance between two pieces' bounds' axes (a sphere's axis is a point). */
export const pieceGap = (x: Pick<Piece, 'p' | 'q'>, y: Pick<Piece, 'p' | 'q'>) => segSegDist(x.p, x.q, y.p, y.q)

/**
 * Sizes every piece to the room around it: the runs either side of a bend (plates), the nearest beam that is not its own, and the nearest
 * other piece. Pieces shrink together where they crowd, down to SMALLEST; where even that does not fit they are slim.
 */
function fit(pieces: Piece[], lines: { pts: V[] }[]): number {
  const segs: [V, V][] = lines.flatMap(l => l.pts.slice(1).map((q, k) => [l.pts[k], q] as [V, V]))
  const rho = (x: Piece, s: number) => (x.ref.slim ? SLIM : x.rho * s)
  for (const x of pieces) {
    let s = Math.min(1, x.cap)
    const near = new Set<number>()
    segs.forEach(([a, b], k) => { if (segSegDist(x.p, x.q, a, b) < OWN) near.add(k) })
    // beams that touch the piece (its own: one line is many segments, so its neighbours in the list are near too) are left out
    for (let k = 0; k < segs.length; k++) {
      if (near.has(k)) continue
      const g = segSegDist(x.p, x.q, segs[k][0], segs[k][1])
      s = Math.min(s, (g - MARGIN) / x.rho)
    }
    x.ref.size = Math.max(0, s)
  }
  for (let pass = 0; pass < 6; pass++) {
    let moved = false
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const A = pieces[i], B = pieces[j], g = pieceGap(A, B) - MARGIN, need = rho(A, A.ref.size) + rho(B, B.ref.size)
      if (need <= g) continue
      const f = Math.max(0, g) / need
      if (!A.ref.slim) A.ref.size *= f
      if (!B.ref.slim) B.ref.size *= f
      moved = true
    }
    for (const x of pieces) if (!x.ref.slim && x.ref.size < SMALLEST) x.ref.slim = true
    if (!moved) break
  }
  // two pieces so near that even their slim forms touch are one corner seen twice (beams nudged a hair apart): the second is left out
  const gone = new Set<Piece>()
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    if (gone.has(pieces[i]) || gone.has(pieces[j])) continue
    if (pieceGap(pieces[i], pieces[j]) < rho(pieces[i], pieces[i].ref.size) + rho(pieces[j], pieces[j].ref.size) + MARGIN / 2) { gone.add(pieces[j]); pieces[j].ref.hidden = true }
  }
  return gone.size
}

/**
 * Every bend of every line, as one piece: a plain mirror where one beam turns (scaled to the room either side, down to 40%); a periscope
 * where two bends are closer than `jog` and the beam leaves the second the way it came into the first (every tray step); and, where beams
 * share a corner, one piece that serves them all: a half-silvered plate when one beam turns and others go straight through (a split, or a
 * join, in either direction); a plate silvered both sides when beams turn in one plane from opposite sides; a glass prism only for a true T
 * or three or more parting that no plate can serve. Coincident beams (same way in, same way out) are one beam. Every piece is then sized to
 * the room around it (fit).
 */
export function findBends(input: Line[], jog = 0.4): Bends {
  const lines = input.map(l => ({ ci: l.ci, pts: l.pts.filter((p, i) => i === 0 || !same(p, l.pts[i - 1])) }))
  const out = { mirrors: [] as MirrorAt[], periscopes: [] as PeriscopeAt[], halves: [] as MirrorAt[], doubles: [] as MirrorAt[], prisms: [] as PrismAt[] }
  const pieces: Piece[] = []
  const placed = new Set<string>() // coincident beams make the same piece once
  const key = (...vs: V[]) => vs.map(v => v.map(x => Math.round(x * 100)).join(',')).join('|')
  const fresh = (): Sized => ({ size: 1, slim: false })
  const corners: { at: V; ci: number; S: Pass[] }[] = []
  lines.forEach(({ pts, ci }) => {
    const dir = (i: number) => unit(sub(pts[i + 1], pts[i]))
    const run = (i: number) => dist(pts[i + 1], pts[i])
    for (let i = 1; i < pts.length - 1; i++) {
      const a = dir(i - 1), b = dir(i)
      if (dist(a, b) < SAME) continue
      const S = passes(lines, pts[i])
      // a jog: this bend and the next are close and the beam leaves the second the way it came into the first
      if (i + 1 < pts.length - 1 && run(i) < jog && dist(dir(i + 1), a) < SAME) {
        const S2 = passes(lines, pts[i + 1])
        // one box, if no other beam turns at either bend (others going straight through make it a half-silvered box)
        if (S.filter(isTurn).length === 1 && S2.filter(isTurn).length === 1) {
          const kk = key(pts[i], pts[i + 1])
          if (!placed.has(kk)) {
            placed.add(kk)
            const ref = { ...fresh(), from: pts[i], to: pts[i + 1], a, ci, glass: S.length > 1 || S2.length > 1 }
            out.periscopes.push(ref); pieces.push({ p: pts[i], q: pts[i + 1], rho: RHO.periscope, cap: 1, ref })
          }
          i++ // the next bend is inside the box
          continue
        }
      }
      if (S.length > 1) {
        const c = corners.find(c => dist(c.at, pts[i]) < SHARE)
        if (!c) corners.push({ at: pts[i], ci, S })
        continue
      }
      const mk = key(pts[i], a, b)
      if (placed.has(mk)) continue
      placed.add(mk)
      const ref: MirrorAt = { ...fresh(), at: pts[i], a, b, ci }
      out.mirrors.push(ref); pieces.push({ p: pts[i], q: pts[i], rho: RHO.mirror, cap: Math.max(0.4, Math.min(run(i - 1), run(i)) / 0.8), ref })
    }
  })
  for (const c of corners) {
    const T = c.S.filter(isTurn), St = c.S.length - T.length
    const plate = T.every(t => parallel(normal(t), normal(T[0])))
    if (plate) {
      const ref: MirrorAt = { ...fresh(), at: c.at, a: T[0].a, b: T[0].b, ci: c.ci, ...(St === 0 && T.length > 1 ? { double: true } : {}) }
      ;(ref.double ? out.doubles : out.halves).push(ref)
      pieces.push({ p: c.at, q: c.at, rho: RHO.mirror, cap: 1, ref })
    } else {
      const ref: PrismAt = { ...fresh(), at: c.at, ins: uniq(c.S.map(x => x.a)), outs: uniq(c.S.map(x => x.b)), ci: c.ci, kind: T.length === 2 && c.S.length === 2 ? 't' : 'many' }
      out.prisms.push(ref); pieces.push({ p: c.at, q: c.at, rho: RHO.prism, cap: 1, ref })
    }
  }
  const hidden = fit(pieces, lines)
  const keep = <T extends Sized>(xs: T[]) => xs.filter(x => !x.hidden)
  const dropped = hidden
  return { mirrors: keep(out.mirrors), periscopes: keep(out.periscopes), halves: keep(out.halves), doubles: keep(out.doubles), prisms: keep(out.prisms), merged: dropped }
}
const uniq = (vs: V[]) => vs.filter((v, i) => vs.findIndex(w => dist(v, w) < SAME) === i)

export type Role = 'emitter' | 'detector' | 'relay' | 'idle'
/** A node's role from its edges: only outgoing fires, only incoming catches, both relays, none is idle. */
export function roles(ids: string[], edges: { from: string; to: string }[]): Map<string, Role> {
  const out = new Set(edges.map(e => e.from)), inn = new Set(edges.map(e => e.to))
  return new Map(ids.map(id => [id, out.has(id) && inn.has(id) ? 'relay' : out.has(id) ? 'emitter' : inn.has(id) ? 'detector' : 'idle']))
}

/**
 * The laser colour of every node that fires: the one the text gave it (`given`), else the first of the palette that no neighbour (a node
 * it shares an edge with) has, preferring one no neighbour's neighbour has and then the least used, so nearby nodes differ.
 */
export function laserColours(edges: { from: string; to: string }[], given: Record<string, string>, palette: string[]): { colours: Map<string, string>; auto: number } {
  const colours = new Map<string, string>(Object.entries(given))
  const nb = new Map<string, Set<string>>()
  const link = (a: string, b: string) => { (nb.get(a) ?? nb.set(a, new Set()).get(a)!).add(b) }
  for (const e of edges) { link(e.from, e.to); link(e.to, e.from) }
  const used = new Map<string, number>()
  for (const c of colours.values()) used.set(c, (used.get(c) ?? 0) + 1)
  let auto = 0
  const senders = [...new Set(edges.map(e => e.from))]
  for (const id of senders) {
    if (colours.has(id) || !palette.length) continue
    const near = new Set([...(nb.get(id) ?? [])].map(n => colours.get(n)))
    const far = new Set([...(nb.get(id) ?? [])].flatMap(n => [...(nb.get(n) ?? [])]).map(n => colours.get(n)))
    const rank = palette.map((c, i) => ({ c, i, bad: near.has(c) ? 2 : far.has(c) ? 1 : 0, n: used.get(c) ?? 0 }))
    rank.sort((x, y) => x.bad - y.bad || x.n - y.n || x.i - y.i)
    colours.set(id, rank[0].c)
    used.set(rank[0].c, (used.get(rank[0].c) ?? 0) + 1)
    auto++
  }
  return { colours, auto }
}

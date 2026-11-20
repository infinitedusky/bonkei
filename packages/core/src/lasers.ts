// Lazers: where the mirrors go, and which colour each node fires. Pure functions on the drawn lines (world units: x, y up, z), so the
// pieces follow the plan whenever it is rebuilt (a drag frame). Decisions: LOG.md, "Lazers theme (BON-248)". Imported by node tests: .ts only.
export type V = [number, number, number]
export interface Line { pts: V[]; ci: number } // a drawn part of an edge, and the index of its colour
export interface MirrorAt { at: V; a: V; b: V; size: number; ci: number } // a plate on a bend: beam in along a, out along b
export interface PeriscopeAt { from: V; to: V; a: V; ci: number } // two bends of a jog in one box
export interface PrismAt { at: V; ins: V[]; outs: V[]; ci: number } // beams that part at one point with no straight way on: a small glass prism
/** halves: half-silvered plates where one beam splits (or two join) with one going straight through; prisms: where a plate cannot do it. */
export interface Bends { mirrors: MirrorAt[]; periscopes: PeriscopeAt[]; halves: MirrorAt[]; prisms: PrismAt[] }

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V) => Math.hypot(a[0], a[1], a[2])
const dist = (a: V, b: V) => len(sub(a, b))
const unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const same = (a: V, b: V) => dist(a, b) < 1e-6

function onSeg(q: V, a: V, b: V) {
  const ab = sub(b, a), t = dot(sub(q, a), ab) / (dot(ab, ab) || 1)
  if (t < -1e-9 || t > 1 + 1e-9) return false
  return dist([a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t], q) < 0.05 // a hair: lines nudged apart by the router still share the corner
}

const SHARE = 0.12 // bends this close are one corner
const addDir = (set: V[], d: V) => { if (!set.some(x => dist(x, d) < 0.01)) set.push(d) }

/**
 * Every bend of every line: a mirror (scaled to the room either side, down to 40%); a periscope where two bends are closer than `jog` and
 * the beam leaves the second the way it came into the first (a jog: every tray step is one). Where beams share a corner (another line runs
 * through the bend, or turns at it too) there is one piece, never two plates through each other: a half-silvered plate when one way on is
 * straight (a beam splits in two, or two join: the turning one reflects, the straight one passes through); a glass prism when none is
 * (a T, or three or more parting).
 */
export function findBends(input: Line[], jog = 0.4): Bends {
  const lines = input.map(l => ({ ci: l.ci, pts: l.pts.filter((p, i) => i === 0 || !same(p, l.pts[i - 1])) }))
  const out: Bends = { mirrors: [], periscopes: [], halves: [], prisms: [] }
  const corners: { at: V; ci: number; lines: Set<number> }[] = []
  lines.forEach((l, li) => {
    const { pts } = l
    const dir = (i: number) => unit(sub(pts[i + 1], pts[i]))
    const run = (i: number) => dist(pts[i + 1], pts[i])
    for (let i = 1; i < pts.length - 1; i++) {
      const a = dir(i - 1), b = dir(i)
      if (dist(a, b) < 1e-6) continue
      const shared = lines.some((o, oi) => oi !== li && o.pts.some((q, k) => k > 0 && onSeg(pts[i], o.pts[k - 1], q)))
      if (shared) {
        const c = corners.find(c => dist(c.at, pts[i]) < SHARE)
        if (c) c.lines.add(li); else corners.push({ at: pts[i], ci: l.ci, lines: new Set([li]) })
        continue
      }
      if (i + 1 < pts.length - 1 && run(i) < jog && dist(dir(i + 1), a) < 1e-6) {
        out.periscopes.push({ from: pts[i], to: pts[i + 1], a, ci: l.ci })
        i++ // the next bend is inside the box
        continue
      }
      out.mirrors.push({ at: pts[i], a, b, size: Math.min(1, Math.max(0.4, Math.min(run(i - 1), run(i)) / 0.8)), ci: l.ci })
    }
  })
  // each shared corner: which ways the beams come in and go out of it
  for (const c of corners) {
    const ins: V[] = [], outs: V[] = []
    lines.forEach(({ pts }) => {
      for (let k = 0; k < pts.length - 1; k++) {
        if (!onSeg(c.at, pts[k], pts[k + 1])) continue
        const d = unit(sub(pts[k + 1], pts[k]))
        const atStart = dist(c.at, pts[k]) < SHARE, atEnd = dist(c.at, pts[k + 1]) < SHARE
        if (atEnd) { if (k + 2 < pts.length) { addDir(ins, d); addDir(outs, unit(sub(pts[k + 2], pts[k + 1]))) } else addDir(ins, d) } // arrives (and turns, or ends)
        else if (atStart) { if (k === 0) addDir(outs, d) } // a start; a bend here was counted as the previous segment's end
        else { addDir(ins, d); addDir(outs, d) } // passes straight through
      }
    })
    const straight = (a: V[], b: V[]) => a.find(d => b.some(e => dist(d, e) < 0.01))
    const d = ins.length === 1 && outs.length === 2 ? straight(ins, outs) : outs.length === 1 && ins.length === 2 ? straight(outs, ins) : undefined
    if (d && ins.length === 1) { const o = outs.find(x => dist(x, d) > 0.01)!; out.halves.push({ at: c.at, a: d, b: o, size: 1, ci: c.ci }) } // one beam splits: the turning one reflects
    else if (d) { const i = ins.find(x => dist(x, d) > 0.01)!; out.halves.push({ at: c.at, a: i, b: d, size: 1, ci: c.ci }) } // two join
    else out.prisms.push({ at: c.at, ins, outs, ci: c.ci })
  }
  return out
}

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

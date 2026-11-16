import ELK from 'elkjs/lib/elk.bundled.js'
import type { Graph, Box, Route, LayoutResult } from './model.ts'

// Swap-friendly interface: layout(graph) -> { boxes, routes }.
export type LayoutEngine = (g: Graph) => Promise<LayoutResult>

const elk = new ELK()

// Room inside a tray: the label sits in the top, and a step stands 20 px outside a tray's rim without landing on a node.
// The drag clamp in SceneView follows it.
export const PAD = { top: 60, side: 40 }

function sizeOf(n: { label: string; shape: string }) {
  const w = Math.min(220, Math.max(110, n.label.length * 9 + 36))
  if (n.shape === 'diamond') return { w: w + 30, h: 78 }
  if (n.shape === 'cylinder') return { w, h: 64 }
  return { w, h: 56 }
}

export const layout: LayoutEngine = async (g) => {
  const groupIds = new Set(g.groups.map(x => x.id))
  const parentOf = new Map<string, string | undefined>()
  g.groups.forEach(x => parentOf.set(x.id, x.parent))
  g.nodes.forEach(x => parentOf.set(x.id, x.parent))
  const chain = (id: string) => { const c: (string | undefined)[] = [undefined]; const l: string[] = []; for (let p: string | undefined = id; p; p = parentOf.get(p)) l.unshift(p); return c.concat(l) }

  const eNodes = new Map<string, any>()
  for (const grp of g.groups) eNodes.set(grp.id, { id: grp.id, children: [], edges: [], layoutOptions: { 'elk.padding': `[top=${PAD.top},left=${PAD.side},bottom=${PAD.side},right=${PAD.side}]` } })
  const TD = g.direction !== 'LR'
  for (const n of g.nodes) {
    const s = sizeOf(n)
    // two ports at side midpoints, fixed: the flow leaves one side and arrives at the opposite one
    const out = TD ? { x: s.w / 2, y: s.h, side: 'SOUTH' } : { x: s.w, y: s.h / 2, side: 'EAST' }
    const inn = TD ? { x: s.w / 2, y: 0, side: 'NORTH' } : { x: 0, y: s.h / 2, side: 'WEST' }
    const port = (id: string, p: { x: number; y: number; side: string }) => ({ id, x: p.x, y: p.y, width: 0, height: 0, layoutOptions: { 'elk.port.side': p.side } })
    eNodes.set(n.id, { id: n.id, width: s.w, height: s.h, ports: [port(n.id + '__out', out), port(n.id + '__in', inn)], layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } })
  }
  const root: any = {
    id: 'root', children: [], edges: [],
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': g.direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.json.edgeCoords': 'ROOT',
      'elk.spacing.nodeNode': '56',
      'elk.layered.spacing.nodeNodeBetweenLayers': '84',
      'elk.spacing.edgeNode': '32',
      'elk.layered.spacing.edgeNodeBetweenLayers': '32',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
    },
  }
  const place = (id: string, parent?: string) => ((parent ? eNodes.get(parent) : root).children as any[]).push(eNodes.get(id))
  g.groups.forEach(x => place(x.id, x.parent))
  g.nodes.forEach(x => place(x.id, x.parent))

  for (const e of g.edges) {
    const a = chain(e.from), b = chain(e.to)
    if (a.includes(e.to) || b.includes(e.from)) continue // edge to own ancestor
    let i = 0
    while (a[i + 1] !== undefined && a[i + 1] === b[i + 1]) i++
    const lca = a[i] // container of the edge
    const ee: any = { id: e.id, sources: [groupIds.has(e.from) ? e.from : e.from + '__out'], targets: [groupIds.has(e.to) ? e.to : e.to + '__in'] }
    if (e.label) ee.labels = [{ text: e.label, width: e.label.length * 7 + 8, height: 16 }]
    ;(lca ? eNodes.get(lca) : root).edges.push(ee)
  }

  const out: any = await elk.layout(root)
  const boxes: Box[] = []
  const walk = (n: any, ox: number, oy: number, level: number, parent?: string) => {
    for (const c of n.children ?? []) {
      const isGroup = groupIds.has(c.id)
      const src = isGroup ? g.groups.find(x => x.id === c.id)! : g.nodes.find(x => x.id === c.id)!
      boxes.push({
        id: c.id, label: src.label, kind: isGroup ? 'group' : 'node',
        shape: isGroup ? 'rect' : (src as any).shape,
        x: ox + c.x, y: oy + c.y, w: c.width, h: c.height, level, parent,
      })
      if (isGroup) walk(c, ox + c.x, oy + c.y, level + 1, c.id)
    }
  }
  walk(out, 0, 0, 0)
  const routes: Route[] = []
  const collect = (n: any, ox: number, oy: number) => {
    for (const e of n.edges ?? []) {
      const s = e.sections?.[0]
      if (!s) continue
      const pts: [number, number][] = [[ox + s.startPoint.x, oy + s.startPoint.y], ...(s.bendPoints ?? []).map((p: any) => [ox + p.x, oy + p.y] as [number, number]), [ox + s.endPoint.x, oy + s.endPoint.y]]
      const src = g.edges.find(x => x.id === e.id)!
      routes.push({ id: e.id, from: src.from, to: src.to, label: src.label, points: pts })
    }
    for (const c of n.children ?? []) collect(c, ox + c.x, oy + c.y)
  }
  collect(out, 0, 0)
  // Make sure every route meets its boxes at the side midpoints. ELK does for nodes (fixed ports); where it
  // did not (a tray, or a route it moved), dock the end by a dogleg and count it.
  const byId = new Map(boxes.map(b => [b.id, b]))
  const flowOut: Side = g.direction === 'LR' ? 'E' : 'S', flowIn: Side = g.direction === 'LR' ? 'W' : 'N'
  let portFallbacks = 0, trayDocks = 0
  for (const r of routes) {
    const a = byId.get(r.from)!, b = byId.get(r.to)!
    const p0 = r.points[0], p1 = r.points[r.points.length - 1]
    const ma = sideMid(a, flowOut), mb = sideMid(b, flowIn)
    if (Math.hypot(p0[0] - ma[0], p0[1] - ma[1]) > 0.5) { r.points = dock(r.points, a, flowOut, false); a.kind === 'group' ? trayDocks++ : portFallbacks++ }
    if (Math.hypot(p1[0] - mb[0], p1[1] - mb[1]) > 0.5) { r.points = dock(r.points, b, flowIn, true); b.kind === 'group' ? trayDocks++ : portFallbacks++ }
  }
  return { boxes, routes, width: out.width, height: out.height, stats: { portFallbacks, trayDocks } }
}

type Side = 'N' | 'S' | 'E' | 'W'
const NORMAL: Record<Side, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }
export function sideMid(b: Box, s: Side): [number, number] {
  return s === 'N' ? [b.x + b.w / 2, b.y] : s === 'S' ? [b.x + b.w / 2, b.y + b.h] : s === 'E' ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2]
}

const DOCK = 20
// Replace one end of a route with the side midpoint of its box: out `DOCK` px along the side's normal, then an
// orthogonal link to the rest of the route.
export function dock(pts: [number, number][], b: Box, side: Side, atEnd: boolean): [number, number][] {
  const rest = atEnd ? [...pts].reverse() : [...pts]
  const m = sideMid(b, side), n = NORMAL[side]
  const s: [number, number] = [m[0] + n[0] * DOCK, m[1] + n[1] * DOCK]
  const q = rest[1] ?? rest[0]
  const out: [number, number][] = [m, s]
  if (Math.abs(q[0] - s[0]) > 0.5 && Math.abs(q[1] - s[1]) > 0.5) out.push(n[0] === 0 ? [q[0], s[1]] : [s[0], q[1]])
  out.push(...rest.slice(1))
  const clean = out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 0.5)
  return atEnd ? clean.reverse() : clean
}

// Cheap Manhattan reroute between two boxes, used while dragging (no ELK round trip). It leaves one box and
// arrives at the other at side midpoints, on the sides that face each other.
export function reroute(a: Box, b: Box): [number, number][] {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2
  const vertical = Math.abs(bcy - acy) >= Math.abs(bcx - acx)
  if (vertical) {
    const down = bcy > acy
    const [, y1] = sideMid(a, down ? 'S' : 'N'), [, y2] = sideMid(b, down ? 'N' : 'S')
    if (Math.abs(acx - bcx) < 1e-6) return [[acx, y1], [bcx, y2]]
    const m = (y1 + y2) / 2
    return [[acx, y1], [acx, m], [bcx, m], [bcx, y2]]
  }
  const right = bcx > acx
  const [x1] = sideMid(a, right ? 'E' : 'W'), [x2] = sideMid(b, right ? 'W' : 'E')
  if (Math.abs(acy - bcy) < 1e-6) return [[x1, acy], [x2, bcy]]
  const m = (x1 + x2) / 2
  return [[x1, acy], [m, acy], [m, bcy], [x2, bcy]]
}

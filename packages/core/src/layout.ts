import type { Graph, GNode, Box, Route, LayoutResult } from './model.ts'
import { loadAvoid, wasmInfo, createRouter, keepRouter, sideMid, TUNE, type AvoidCrossings, type Side } from './avoid.ts'
import { straighten, unblock } from './monotone.ts'
import { withSpan } from './telemetry.ts'
import { offTitleBoxes, TITLE_ROOM } from './titles.ts'
import type { Span } from '@opentelemetry/api'
export { sideMid } from './avoid.ts'

// Swap-friendly interface: layout(graph, options) -> { boxes, routes }.
export interface LayoutOptions {
  /** How hard the router tries to keep lines from crossing (default 'some'). */
  avoidCrossings?: AvoidCrossings
  /** The span the routing span hangs under (bonkei.layout). */
  span?: Span
  /** Leave the dotted links (-.->) out of the placing and the routing and return them as `arcs`, for a theme that draws them overhead (theme.edge.dotted 'arc'). */
  arcs?: boolean
  /** Leave room in front of every tray for its title, off the tray (a theme whose tray.titles is 'off'). Without it the layout is what it always was. */
  titleRoom?: boolean
  /** Leave room at the bottom of every tray for its title lying on its floor, in front (a theme whose tray.titles is 'ground'). */
  groundRoom?: boolean
}
export type LayoutEngine = (g: Graph, o?: LayoutOptions) => Promise<LayoutResult>

// ELK is the biggest piece of the package, so it is fetched on the first layout, not with the module (BON-52): a host's bundler
// makes `elkjs/lib/elk.bundled.js` a chunk of its own. The fetch can fail (network), so it has a `bonkei.elk.load` span.
type ElkInstance = { layout(g: any): Promise<any> }
type ElkModule = { default?: unknown }
let elkLoad: Promise<ElkInstance> | null = null
/** Milliseconds the ELK chunk took to load on the first layout; 0 until it has. The wasm's is wasmInfo.ms. */
export const elkInfo = { ms: 0 }
/** Whether ELK has been fetched yet: false after import, true once a layout has run. */
export function elkLoaded(): boolean { return elkInfo.ms > 0 }
let importElk = (): Promise<ElkModule> => import('elkjs/lib/elk.bundled.js')
/** Tests only: swap how the ELK module is imported (to see a failed fetch). Returns the previous importer. */
export function setElkImport(f: () => Promise<ElkModule>) { const prev = importElk; importElk = f; elkLoad = null; return prev }
function getElk(parent?: Span): Promise<ElkInstance> {
  elkLoad ??= withSpan('bonkei.elk.load', {}, async span => {
    const t = performance.now()
    const m: any = await importElk()
    const ELK = m.default?.default ?? m.default ?? m
    const e = new ELK()
    elkInfo.ms = Math.max(performance.now() - t, Number.MIN_VALUE)
    span.setAttribute('bonkei.elk_load_ms', elkInfo.ms)
    return e
  }, parent).catch(e => { elkLoad = null; throw e })
  return elkLoad
}

// Room inside a tray: the label sits in the top, and a step stands 20 px outside a tray's rim without landing on a node.
// The drag clamp in SceneView follows it.
export const PAD = { top: 60, side: 40 }
// Room at the bottom of a tray for its title lying on the floor in front (groundRoom, theme.tray.titles 'ground'): px.
export const GROUND_ROOM = 44
// Spacing, shared by the root and every tray so they cannot drift: ELK applies these to the children of the node they are set on.
export const SPACING = {
  'elk.spacing.nodeNode': '56',
  'elk.layered.spacing.nodeNodeBetweenLayers': '84',
  'elk.spacing.edgeNode': '32',
  'elk.layered.spacing.edgeNodeBetweenLayers': '32',
}
const ELK_SIDE: Record<Side, string> = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }

function sizeOf(n: { label: string; shape: string }) {
  const w = Math.min(220, Math.max(110, n.label.length * 9 + 36))
  if (n.shape === 'diamond') return { w: w + 30, h: 78 }
  if (n.shape === 'cylinder') return { w, h: 64 }
  return { w, h: 56 }
}

// ELK places the boxes; libavoid routes the lines (BON-100). If the wasm cannot load or routing throws, ELK's own routes stay
// (with U-turns straightened where it can) and `stats.route.error` says why; the `bonkei.route` span records it too.
export const layout: LayoutEngine = async (g0, o = {}) => {
  // dotted links as arcs overhead take no part in the layout: nothing routes them, and they do not push the nodes about
  const arcs = o.arcs ? g0.edges.filter(e => e.dotted).map(e => ({ id: e.id, from: e.from, to: e.to, label: e.label })) : []
  const g = arcs.length ? { ...g0, edges: g0.edges.filter(e => !e.dotted) } : g0
  const r = await route(g, o)
  return o.arcs ? { ...r, arcs } : r
}
const route: LayoutEngine = async (g, o = {}) => {
  const placed = await place(g, o.span, o.titleRoom === true, o.groundRoom === true)
  const level = o.avoidCrossings ?? 'some'
  return withSpan('bonkei.route', { 'bonkei.avoid_crossings': level, 'bonkei.edges': placed.routes.length, 'bonkei.title_room': !!placed.titleRoom, 'bonkei.ground_room': !!placed.groundRoom }, async span => {
    const t0 = performance.now()
    try {
      const A = await loadAvoid(span)
      const r = createRouter(A, placed, level)
      const ms = performance.now() - t0
      span.setAttributes({ 'bonkei.route_ms': ms, 'bonkei.router_build_ms': r.stats.buildMs, 'bonkei.unroutable': r.stats.failed.length, 'bonkei.straightened': r.stats.straightened, 'bonkei.forced_turns': r.stats.forced, 'bonkei.refined': r.stats.refined, 'bonkei.elk_load_ms': elkInfo.ms, 'bonkei.wasm_load_ms': wasmInfo.ms, 'bonkei.wasm_source': wasmInfo.source ?? '' })
      const out: LayoutResult = { ...placed, routes: r.routes, stats: { ...placed.stats!, route: { ms, buildMs: r.stats.buildMs, failed: r.stats.failed, straightened: r.stats.straightened, forced: r.stats.forced, error: null, level } } }
      keepRouter(out, r) // the scene drags on the same router
      return out
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      span.addEvent('bonkei.route.fallback', { 'bonkei.error': error })
      // (ELK's routes do not know the off-tray titles; a line through one is moved off it where a direct route or a way round exists)
      const s = straighten(placed.titleRoom ? placed.boxes.concat(offTitleBoxes(placed.boxes)) : placed.boxes, placed.routes, 10)
      return { ...placed, routes: s.routes, stats: { ...placed.stats!, route: { ms: performance.now() - t0, buildMs: 0, failed: [], straightened: s.changed, forced: s.forced, error, level } } }
    }
  }, o.span)
}

async function place(g: Graph, parent?: Span, titleRoom = false, groundRoom = false): Promise<LayoutResult> {
  const groupIds = new Set(g.groups.map(x => x.id))
  const parentOf = new Map<string, string | undefined>()
  g.groups.forEach(x => parentOf.set(x.id, x.parent))
  g.nodes.forEach(x => parentOf.set(x.id, x.parent))
  const chain = (id: string) => { const c: (string | undefined)[] = [undefined]; const l: string[] = []; for (let p: string | undefined = id; p; p = parentOf.get(p)) l.unshift(p); return c.concat(l) }

  const eNodes = new Map<string, any>()
  // titleRoom: a tray's title lies on the surface in front of it (titles.ts), so TITLE_ROOM is left in front of every tray. The space
  // between what is stacked down the screen (the nodes of a layer in LR, the layers in TD) grows by it, the root keeps it below its
  // last tray, and a tray that holds a tray is that much deeper at the bottom (the sub-tray's title lies on its top). No title is on
  // the tray, so its top needs no room for one. (ELK's elk.margins would be the natural way; it ignores a margin at the bottom.)
  const spacing: Record<string, string> = { ...SPACING }
  const across = g.direction === 'LR' ? 'elk.spacing.nodeNode' : 'elk.layered.spacing.nodeNodeBetweenLayers'
  if (titleRoom) spacing[across] = String(Number(SPACING[across]) + TITLE_ROOM)
  const holdsTray = new Set(g.groups.map(x => x.parent).filter((p): p is string => !!p))
  for (const grp of g.groups) {
    const top = titleRoom || groundRoom ? PAD.side : PAD.top, bottom = PAD.side + (titleRoom && holdsTray.has(grp.id) ? TITLE_ROOM : 0) + (groundRoom ? GROUND_ROOM : 0)
    eNodes.set(grp.id, { id: grp.id, children: [], edges: [], layoutOptions: { ...spacing, 'elk.padding': `[top=${top},left=${PAD.side},bottom=${bottom},right=${PAD.side}]` } })
  }
  // ELK places the nodes with a port fixed at the middle of the side the flow leaves by and the side it arrives at,
  // so the room it leaves suits lines that meet nodes at side midpoints. libavoid then picks the side of each line itself.
  const out: Side = g.direction === 'LR' ? 'E' : 'S', inn: Side = g.direction === 'LR' ? 'W' : 'N'
  const used = new Map<string, Set<Side>>()
  const use = (n: string, sd: Side) => { if (!groupIds.has(n)) (used.get(n) ?? used.set(n, new Set()).get(n)!).add(sd) }
  for (const e of g.edges) { use(e.from, out); use(e.to, inn) }
  for (const n of g.nodes) {
    const s = sizeOf(n)
    const at = (sd: Side) => sd === 'N' ? { x: s.w / 2, y: 0 } : sd === 'S' ? { x: s.w / 2, y: s.h } : sd === 'E' ? { x: s.w, y: s.h / 2 } : { x: 0, y: s.h / 2 }
    const ports = [...(used.get(n.id) ?? [])].map(sd => ({ id: `${n.id}__${sd}`, ...at(sd), width: 0, height: 0, layoutOptions: { 'elk.port.side': ELK_SIDE[sd] } }))
    eNodes.set(n.id, { id: n.id, width: s.w, height: s.h, ports, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } })
  }
  const root: any = {
    id: 'root', children: [], edges: [],
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': g.direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.json.edgeCoords': 'ROOT',
      ...spacing,
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      // ELK's default (as on main): depth-first put the 50-node sample's Client below the Platform tray, under WAF's own tray (BON-102)
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.padding': `[top=40,left=40,bottom=${40 + (titleRoom ? TITLE_ROOM : 0)},right=40]`,
    },
  }
  const put = (id: string, parent?: string) => ((parent ? eNodes.get(parent) : root).children as any[]).push(eNodes.get(id))
  g.groups.forEach(x => put(x.id, x.parent))
  g.nodes.forEach(x => put(x.id, x.parent))

  for (const e of g.edges) {
    const a = chain(e.from), b = chain(e.to)
    if (a.includes(e.to) || b.includes(e.from)) continue // edge to own ancestor
    let i = 0
    while (a[i + 1] !== undefined && a[i + 1] === b[i + 1]) i++
    const lca = a[i] // container of the edge
    const ee: any = { id: e.id, sources: [groupIds.has(e.from) ? e.from : `${e.from}__${out}`], targets: [groupIds.has(e.to) ? e.to : `${e.to}__${inn}`] }
    if (e.label) ee.labels = [{ text: e.label, width: e.label.length * 7 + 8, height: 16 }]
    ;(lca ? eNodes.get(lca) : root).edges.push(ee)
  }

  const res: any = await (await getElk(parent)).layout(root)
  const boxes: Box[] = []
  const walk = (n: any, ox: number, oy: number, level: number, parent?: string) => {
    for (const c of n.children ?? []) {
      const isGroup = groupIds.has(c.id)
      const src = isGroup ? g.groups.find(x => x.id === c.id)! : g.nodes.find(x => x.id === c.id)!
      const node = isGroup ? undefined : src as GNode
      const two = node?.sub ? { title: node.title, sub: node.sub } : {} // a two-line label's lines, for a theme that draws them apart
      boxes.push({
        id: c.id, label: src.label, kind: isGroup ? 'group' : 'node', ...two,
        shape: isGroup ? 'rect' : (src as any).shape,
        x: ox + c.x, y: oy + c.y, w: c.width, h: c.height, level, parent,
      })
      if (isGroup) walk(c, ox + c.x, oy + c.y, level + 1, c.id)
    }
  }
  walk(res, 0, 0, 0)
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
  collect(res, 0, 0)
  // Edges ELK did not route take the direct route between the facing side midpoints, as when dragging.
  const have = new Set(routes.map(r => r.id))
  const byId = new Map(boxes.map(b => [b.id, b]))
  for (const e of g.edges) {
    if (have.has(e.id) || !byId.get(e.from) || !byId.get(e.to)) continue
    if (chain(e.from).includes(e.to) || chain(e.to).includes(e.from)) continue
    routes.push({ id: e.id, from: e.from, to: e.to, label: e.label, points: reroute(byId.get(e.from)!, byId.get(e.to)!) })
  }
  // ELK's routes meet nodes at the fixed ports; an end at a tray (which has no fixed size, so no ports) is docked at the
  // middle of the side ELK reached, so even the fallback (no libavoid) ends every line at a side midpoint.
  let trayDocks = 0
  for (const r of routes) {
    for (const atEnd of [false, true]) {
      const b = byId.get(atEnd ? r.to : r.from)!
      const p = atEnd ? r.points[r.points.length - 1] : r.points[0]
      if ((['N', 'S', 'E', 'W'] as Side[]).some(s => { const m = sideMid(b, s); return Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.5 })) continue
      r.points = dock(r.points, b, nearestSide(b, p), atEnd)
      trayDocks++
    }
  }
  // A line whose target ELK left behind a block or tray it must go round would have to turn back: its block slides across the
  // flow, inside its tray, until the line can go direct (monotone.ts unblock).
  // With titles off the tray, a block never slides onto one (they do not move: the trays do not).
  const room = titleRoom ? TITLE_ROOM : 0
  const u = unblock(boxes, routes, TUNE.buffer, g.direction === 'LR' ? 1 : 0, Number(SPACING['elk.spacing.edgeNode']), PAD.side, { x0: 40, y0: 40, x1: res.width - 40, y1: res.height - 40 - room }, titleRoom ? offTitleBoxes(boxes) : [])
  return { boxes: u.boxes, routes: u.routes, direction: g.direction, width: res.width, height: res.height, ...(titleRoom ? { titleRoom } : {}), ...(groundRoom ? { groundRoom } : {}), stats: { trayDocks, slid: u.moved } }
}

const NORMAL: Record<Side, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }
function nearestSide(b: Box, p: [number, number]): Side {
  const d: [Side, number][] = [['N', Math.abs(p[1] - b.y)], ['S', Math.abs(p[1] - b.y - b.h)], ['W', Math.abs(p[0] - b.x)], ['E', Math.abs(p[0] - b.x - b.w)]]
  return d.sort((a, c) => a[1] - c[1])[0][0]
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

// Cheap Manhattan route between two boxes, used while dragging when libavoid is not loaded. It leaves one box and
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

/**
 * Lines end at a node's box, which is larger than a Cloud Cartography icon: each end that meets a side midpoint is lengthened inwards,
 * along its own last segment, until it reaches the icon's footprint (`half`, px). A line a node's box leaves too short to reach keeps its end.
 */
export function trimToIcons(routes: Route[], boxes: Map<string, Box>, half: number): Route[] {
  return routes.map(r => {
    const pts = r.points.map(p => [...p] as [number, number])
    for (const atEnd of [false, true]) {
      const b = boxes.get(atEnd ? r.to : r.from)
      const i = atEnd ? pts.length - 1 : 0, q = pts[atEnd ? i - 1 : i + 1]
      if (!b || !q) continue
      const p = pts[i]
      const side = (['N', 'S', 'E', 'W'] as Side[]).find(sd => { const m = sideMid(b, sd); return Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.5 })
      if (!side) continue
      const [nx, ny] = NORMAL[side]
      if (Math.abs((q[0] - p[0]) * nx + (q[1] - p[1]) * ny) < 0.5) continue // the line does not leave the side straight out: leave it
      const inset = (nx !== 0 ? b.w : b.h) / 2 - half
      if (inset > 0) pts[i] = [p[0] - nx * inset, p[1] - ny * inset]
    }
    return { ...r, points: pts }
  })
}

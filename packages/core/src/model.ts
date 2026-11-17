export type Shape = 'rect' | 'round' | 'cylinder' | 'diamond'
export type LabelMode = 'top' | 'billboard'
export interface GNode { id: string; label: string; shape: Shape; parent?: string }
export interface GGroup { id: string; label: string; parent?: string }
export interface GEdge { id: string; from: string; to: string; label?: string }
// A source line the parser could not use. `line` is 1-based, counted in the source as given.
export interface Dropped { line: number; text: string; reason: string }
// Reasons a line is dropped, shared by the flowchart and sequence parsers.
export const REASON = {
  unsupported: 'not supported yet',
  statement: 'not a node or edge',
  strayEnd: 'stray end',
  unclosed: 'unclosed subgraph',
} as const
export interface Graph {
  direction: 'TD' | 'LR'
  nodes: GNode[]
  groups: GGroup[]
  edges: GEdge[]
  dropped?: Dropped[]
}
// What a hand-built source may be: `prepare` fills in direction, groups and dropped.
export type GraphInput = Omit<Graph, 'direction' | 'groups' | 'dropped'> & Partial<Pick<Graph, 'direction' | 'groups' | 'dropped'>>

// layout output (layout plane = x, y in px; scene maps y -> world z)
export interface Box {
  id: string; label: string; kind: 'node' | 'group'; shape: Shape
  x: number; y: number; w: number; h: number
  level: number // number of ancestor groups
  height?: number // a node's block height in world units (default NODE_H); set by a custom layout
  parent?: string
}
export interface Route { id: string; from: string; to: string; label?: string; points: [number, number][] }
// direction: the flow the layout was made in. stats.trayDocks: line ends ELK left off a side midpoint (ends at a tray, which has
// no ports) and that were docked at one. stats.slid: blocks slid across the flow so a line could go direct (BON-102).
// stats.route: how the lines were routed.
export interface LayoutResult { boxes: Box[]; routes: Route[]; direction?: 'TD' | 'LR'; width: number; height: number; stats?: { trayDocks: number; slid?: string[]; route?: RouteStats } }
// How the lines were routed (BON-100): total ms (wasm load included), router build ms, lines libavoid could not route, lines given
// the direct route because libavoid's turned back or crossed a foreign tray, lines that must turn back (no direct route exists), the crossing-avoidance level, and why it fell back to
// ELK's routes (null: it did not).
export interface RouteStats { ms: number; buildMs: number; failed: string[]; straightened: number; forced: number; error: string | null; level: 'off' | 'some' | 'strong' }

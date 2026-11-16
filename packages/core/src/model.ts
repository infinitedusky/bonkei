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
// stats: routes whose ends ELK did not put at a side midpoint (docked afterwards), and edges to a tray itself (always docked)
// elkRoutes: ELK's own routes, kept when the lines were routed by libavoid, so a viewer can switch back to basic routing
export interface LayoutResult { boxes: Box[]; routes: Route[]; elkRoutes?: Route[]; direction?: 'TD' | 'LR'; width: number; height: number; stats?: { portFallbacks: number; trayDocks: number; route?: RouteStats } }
// How the lines were routed: total ms (wasm load included), router build ms, lines libavoid could not route, and why it fell back to ELK's routes (null: it did not)
export interface RouteStats { ms: number; buildMs: number; failed: string[]; error: string | null; level: 'off' | 'some' | 'strong'; ends: 'midpoint' | 'spread' }

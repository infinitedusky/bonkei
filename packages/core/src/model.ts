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
  parent?: string
}
export interface Route { id: string; from: string; to: string; label?: string; points: [number, number][] }
export interface LayoutResult { boxes: Box[]; routes: Route[]; width: number; height: number }

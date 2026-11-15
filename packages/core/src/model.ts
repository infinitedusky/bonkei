import type { Texture } from 'three'
export type Shape = 'rect' | 'round' | 'cylinder' | 'diamond'
export interface GNode { id: string; label: string; shape: Shape; parent?: string }
export interface GGroup { id: string; label: string; parent?: string }
export interface GEdge { id: string; from: string; to: string; label?: string }
export interface Graph {
  direction: 'TD' | 'LR'
  nodes: GNode[]
  groups: GGroup[]
  edges: GEdge[]
  arch: Record<string, unknown>
}

// layout output (layout plane = x, y in px; scene maps y -> world z)
export interface Box {
  id: string; label: string; kind: 'node' | 'group'; shape: Shape
  x: number; y: number; w: number; h: number
  level: number // number of ancestor groups
  parent?: string
  /** Picture for the top face (a custom node rendered elsewhere). Falls back to the labelled box when absent. */
  top?: Texture
}
export interface Route { id: string; from: string; to: string; label?: string; points: [number, number][]
  /** Where the label sits (layout px); default is the middle of the longest segment. */
  labelAt?: [number, number] }
export interface LayoutResult { boxes: Box[]; routes: Route[]; width: number; height: number }

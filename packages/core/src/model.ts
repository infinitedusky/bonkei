/** The shape of a node. */
export type Shape = 'rect' | 'round' | 'cylinder' | 'diamond'
/** Where labels sit: on top of the shapes, or billboarded towards the camera. */
export type LabelMode = 'top' | 'billboard'
/** A node in a graph. */
// title/sub: a label written over two lines (`<br>`); `label` stays the one-line reading ("title sub") every theme but Cloud Cartography draws.
export interface GNode { id: string; label: string; shape: Shape; parent?: string; title?: string; sub?: string }
/** A group (subgraph) in a graph. */
export interface GGroup { id: string; label: string; parent?: string }
/** An edge in a graph. */
// dotted: written as Mermaid's dotted link (-.->, -.-); a theme may draw it differently (theme.edge.dotted), the others draw it as any link.
export interface GEdge { id: string; from: string; to: string; label?: string; dotted?: boolean }
// A source line the parser could not use. `line` is 1-based, counted in the source as given.
/** A source line the parser could not use, with its reason. */
export interface Dropped { line: number; text: string; reason: string }
// Reasons a line is dropped, shared by the flowchart and sequence parsers.
export const REASON = {
  unsupported: 'not supported yet',
  statement: 'not a node or edge',
  strayEnd: 'stray end',
  unclosed: 'unclosed subgraph',
} as const
/** A finished graph, as parsed from Mermaid. */
export interface Graph {
  direction: 'TD' | 'LR'
  nodes: GNode[]
  groups: GGroup[]
  edges: GEdge[]
  dropped?: Dropped[]
}
// What a hand-built source may be: `prepare` fills in direction, groups and dropped.
/** A graph you build by hand; direction and groups are optional. */
export type GraphInput = Omit<Graph, 'direction' | 'groups' | 'dropped'> & Partial<Pick<Graph, 'direction' | 'groups' | 'dropped'>>

// layout output (layout plane = x, y in px; scene maps y -> world z)
export interface Box {
  id: string; label: string; kind: 'node' | 'group'; shape: Shape
  x: number; y: number; w: number; h: number
  level: number // number of ancestor groups
  title?: string; sub?: string // a two-line label's lines (GNode)
  height?: number // a node's block height in world units (default NODE_H); set by a custom layout
  parent?: string
}
export interface Route { id: string; from: string; to: string; label?: string; points: [number, number][] }
// direction: the flow the layout was made in. stats.trayDocks: line ends ELK left off a side midpoint (ends at a tray, which has
// no ports) and that were docked at one. stats.slid: blocks slid across the flow so a line could go direct (BON-102).
// stats.route: how the lines were routed. titleRoom: room was left in front of every tray for its title, off the tray
// (theme.tray.titles 'off', titles.ts offTitleBoxes), and the lines are kept off the title boxes.
// arcs: the dotted links left out of the routing (layout option `arcs`), for a theme that draws them overhead.
export interface Arc { id: string; from: string; to: string; label?: string }
export interface LayoutResult { boxes: Box[]; routes: Route[]; arcs?: Arc[]; direction?: 'TD' | 'LR'; width: number; height: number; titleRoom?: boolean; stats?: { trayDocks: number; slid?: string[]; route?: RouteStats } }
// How the lines were routed (BON-100): total ms (wasm load included), router build ms, lines libavoid could not route, lines given
// the direct route because libavoid's turned back or crossed a foreign tray, lines that must turn back (no direct route exists), the crossing-avoidance level, and why it fell back to
// ELK's routes (null: it did not).
export interface RouteStats { ms: number; buildMs: number; failed: string[]; straightened: number; forced: number; error: string | null; level: 'off' | 'some' | 'strong' }

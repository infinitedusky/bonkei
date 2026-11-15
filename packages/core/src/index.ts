// The public surface of bonkei: parse Mermaid, lay it out, render it as a 3D scene.

// Model
export type { Shape, GNode, GGroup, GEdge, Graph, Box, Route, LayoutResult } from './model'

// Flowchart parser and layout (`layout` is a LayoutEngine; pass your own to swap it)
export { parse } from './parser'
export { layout, reroute, type LayoutEngine } from './layout'

// Sequence diagrams
export { isSeq, parseSeq, layoutSeq, type SPart, type SItem, type SeqDoc, type SeqLayout } from './seq'

// Renderer
export { SceneView, type EdgeHeight } from './SceneView'
export { SeqScene } from './SeqScene'
export { S, TRAY, NODE_H, trayColor, NodeBody, Label, Tray, baseOf, type LabelMode, type TrayLabel } from './shapes'

// Camera (one per diagram view)
export { createCamera, PRESET, type Camera, type Mode, type Pose } from './camera'

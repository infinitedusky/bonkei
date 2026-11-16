// The surface of bonkei: parse Mermaid, lay it out, render it as a 3D scene.

// ---- Public API (BON-51) ----
export { Bonkei, type BonkeiProps, type BonkeiViewHandle } from './Bonkei'
export { render, type BonkeiHandle } from './render'
export { isBonkeiError } from './diagram'
export type {
  BonkeiOptions, DiagramOptions, Controls, BonkeiError, BonkeiWarning, NodeClick, ReadyInfo,
} from './options'
export type { Mode } from './camera'
export type { LabelMode, Graph, GraphInput, GNode, GGroup, GEdge, Shape, Dropped } from './model'

// ---- Not yet curated ----
// Everything below stays exported until the apps move to the public API; the curation sub-task
// (`surface`) then removes it from here. New internal code should import from 'bonkei/internal'.

// Model
export type { Box, Route, LayoutResult } from './model'

// Flowchart parser and layout (`layout` is a LayoutEngine; pass your own to swap it)
export { parse } from './parser'
export { layout, reroute, type LayoutEngine } from './layout'

// Sequence diagrams
export { isSeq, parseSeq, layoutSeq, type SPart, type SItem, type SeqDoc, type SeqLayout } from './seq'

// Renderer
export { SceneView } from './SceneView'
export { SeqScene } from './SeqScene'
export { S, TRAY, NODE_H, trayColor, NodeBody, Label, Tray, baseOf } from './shapes'

// Camera (one per diagram view)
export { createCamera, PRESET, type Camera, type Pose } from './camera'

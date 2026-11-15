// The public surface of bonkei. Everything the apps and the docs need; nothing else.
// Renderer pieces, the camera and the scene constants live in 'bonkei/internal'.

export { Bonkei, type BonkeiProps, type BonkeiViewHandle } from './Bonkei'
export { render, type BonkeiHandle } from './render'
export type { BonkeiOptions, DiagramOptions, Controls, BonkeiError, BonkeiReady } from './options'
export type { Mode } from './camera'
export type { LabelMode } from './shapes'

// Advanced: use the parser and layout without the renderer, or swap the layout engine.
export { parse } from './parser'
export { layout, type LayoutEngine } from './layout'
export type { Graph, GNode, GGroup, GEdge, Dropped, LayoutResult, Box, Route, Shape } from './model'

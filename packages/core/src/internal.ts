// Internal and unstable: for this repo's stories and tools; may change in any release.
// bonkei/internal is not part of the public API (see index.ts and LOG.md, "Public surface (BON-51)").

// Renderer
export { SceneView, type SceneViewProps, type EdgeStats } from './SceneView'
export { stepRoute, findCrossings, applyCrossings, planEdges, endHeight, CROSSING_STYLES, type CrossingStyle, type Body, type P3 } from './edges3d.ts'
export { SeqScene } from './SeqScene'
export { trayColor, NodeBody, Label, Tray, baseOf } from './shapes'
export { SCENE, UI } from './palette'
export { ALL_ON, wheelAction, dragAction, cursorFor, gesture, type Gesture, type Pickable, type Cursor } from './controls'

// Camera and scale
export { createCamera, PRESET, type Camera, type Mode, type Pose } from './camera'
export { S, TRAY, NODE_H } from './scale'

// Parsing and layout
export { parse } from './parser'
export { layout, reroute, type LayoutEngine, type LayoutOptions, type Routing } from './layout'
export { isSeq, parseSeq, layoutSeq, type SPart, type SItem, type SeqDoc, type SeqLayout } from './seq'
export { prepare, type Prepared, type PrepareError } from './diagram'
export { readFrontmatter, mergeOptions, resolveControls, DEFAULTS, type ResolvedOptions, type ResolvedControls, type ControlName, type Frontmatter } from './options'

// Layout types
export type { Box, Route, LayoutResult, LabelMode } from './model'

// Lines routed by libavoid (BON-99)
export { createRouter, loadAvoid, setAvoidWasm, avoidLoaded, routerFor, TUNE as AVOID_TUNE, type EdgeRouter, type AvoidTune, AVOID_CROSSINGS, CROSSING_COST, ENDS, type AvoidCrossings, type Ends } from './avoid.ts'
export { measureRoutes, type RouteQuality } from './routeMetrics.ts'
export type { RouteStats } from './model'

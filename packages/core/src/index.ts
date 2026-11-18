// The public API of bonkei: draw a Mermaid diagram (or a hand-built graph) as a 3D scene.
// Everything else lives in 'bonkei/internal', which is internal and unstable.

// Components and mounting
/** The diagram as a React component; fills its container. */
export { Bonkei } from './Bonkei'
/** Mount a diagram into any DOM element without touching React; returns a handle. */
export { render } from './render'

// Props, options and handles
/** The props of `<Bonkei />`: a source plus BonkeiOptions. */
export type { BonkeiProps } from './Bonkei'
/** Methods on a `<Bonkei />` ref: setMode() and fit(). */
export type { BonkeiViewHandle } from './Bonkei'
/** The handle render() returns: update(source), setMode(), destroy(). */
export type { BonkeiHandle } from './render'
/** Everything you can pass to `<Bonkei />` or render(): diagram options plus callbacks. */
export type { BonkeiOptions } from './options'
/** The options that may also come from the diagram's frontmatter (config.bonkei). */
export type { DiagramOptions } from './options'
/** The reader's controls: true/false for all, or one switch per control. */
export type { Controls } from './options'

// Themes
/** A look as data: every colour, material, label and line style the scene reads. JSON-serialisable. */
export type { Theme } from './theme'
/** Classic (today's look) and the two Bonkei looks, for passing as `theme` or as a base to copy and edit (they are frozen). */
export { CLASSIC, BONKEI, BONKEI_LANDSCAPE } from './theme'
/** The names config.theme and the `theme` prop accept: classic, bonkei, bonkei-landscape. */
export { THEME_NAMES } from './theme'

// Events
/** What onError receives when nothing could be drawn (kind: parse, graph, layout or render). */
export type { BonkeiError } from './options'
/** What onWarning receives for a dropped line, a bad frontmatter key or an unknown theme or theme variable; the diagram still draws. */
export type { BonkeiWarning } from './options'
/** What onNodeClick receives for a node, a group or a sequence participant. */
export type { NodeClick } from './options'
/** What onReady receives once a new source's first frame is drawn. */
export type { ReadyInfo } from './options'
/** Tells a BonkeiError from any other thrown value. */
export { isBonkeiError } from './diagram'

// Modes and labels
/** The camera mode: flat, iso or 3d. */
export type { Mode } from './camera'
/** Where labels sit: on top of the shapes, or billboarded towards the camera. */
export type { LabelMode } from './model'

// Hand-built graphs
/** A finished graph, as parsed from Mermaid. */
export type { Graph } from './model'
/** A graph you build by hand; direction and groups are optional. */
export type { GraphInput } from './model'
/** A node in a graph. */
export type { GNode } from './model'
/** A group (subgraph) in a graph. */
export type { GGroup } from './model'
/** An edge in a graph. */
export type { GEdge } from './model'
/** The shape of a node. */
export type { Shape } from './model'
/** A source line the parser could not use, with its reason. */
export type { Dropped } from './model'

// Lines (BON-100)
/** How two crossing lines are drawn: none (they cross as lines), bridge, tunnel or portal. */
export type { CrossingStyle } from './edges3d'
/** How hard the router keeps lines from crossing: off, some or strong. */
export type { AvoidCrossings } from './avoid'

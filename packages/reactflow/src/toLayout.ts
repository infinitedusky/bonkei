import { ConnectionMode, getBezierPath, getSmoothStepPath, getStraightPath, type InternalNode, type Edge } from '@xyflow/react'
import { getEdgePosition } from '@xyflow/system'
import type { Box, LayoutResult, Route, Shape } from 'bonkei'
import type { Texture } from 'three'

type Lookup = Map<string, InternalNode>

const PLAIN = new Set([undefined, 'default', 'input', 'output', 'group'])
export const isCustom = (type: string | undefined) => !PLAIN.has(type)

function size(n: InternalNode) {
  return {
    w: n.measured?.width ?? n.width ?? n.initialWidth ?? 150,
    h: n.measured?.height ?? n.height ?? n.initialHeight ?? 40,
  }
}

function hiddenAnywhere(n: InternalNode, nodes: Lookup): boolean {
  for (let c: InternalNode | undefined = n; c; c = c.parentId ? nodes.get(c.parentId) : undefined) if (c.hidden) return true
  return false
}

function levelOf(n: InternalNode, nodes: Lookup) {
  let l = 0
  for (let p = n.parentId; p; p = nodes.get(p)?.parentId) l++
  return l
}

const nums = (s: string) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number)

function dedupe(pts: [number, number][]) {
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1])
}

function sampleBezier(d: string): [number, number][] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = nums(d)
  const out: [number, number][] = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, u = 1 - t
    out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
              u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3])
  }
  return out
}

function routeOf(e: Edge, nodes: Lookup, mode: ConnectionMode): { points: [number, number][]; label: [number, number] } | null {
  const sourceNode = nodes.get(e.source), targetNode = nodes.get(e.target)
  if (!sourceNode || !targetNode) return null
  const pos = getEdgePosition({ id: e.id, sourceNode, targetNode, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null, connectionMode: mode })
  if (!pos) return null
  const common = { sourceX: pos.sourceX, sourceY: pos.sourceY, sourcePosition: pos.sourcePosition, targetX: pos.targetX, targetY: pos.targetY, targetPosition: pos.targetPosition }
  switch (e.type) {
    case 'straight': {
      const [, lx, ly] = getStraightPath(common)
      return { points: [[pos.sourceX, pos.sourceY], [pos.targetX, pos.targetY]], label: [lx, ly] }
    }
    case undefined: case 'default': case 'bezier': case 'simplebezier': {
      const [d, lx, ly] = getBezierPath(common)
      return { points: sampleBezier(d), label: [lx, ly] }
    }
    default: { // step, smoothstep and any custom edge type
      const [d, lx, ly] = getSmoothStepPath({ ...common, borderRadius: 0 })
      const n = nums(d), pts: [number, number][] = []
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]])
      return { points: dedupe(pts), label: [lx, ly] }
    }
  }
}

export interface Frame { ox: number; oy: number; width: number; height: number }

/** React Flow's store -> a Bonkei LayoutResult. `frame` fixes the origin/extent after the first build so the 3D world doesn't shift as nodes move. */
export function toLayout(nodes: Lookup, edges: Edge[], mode: ConnectionMode, textures: Map<string, Texture>, frame: Frame | null): { layout: LayoutResult; frame: Frame; fallback: number } {
  const boxes: Box[] = []
  const ids = new Set<string>()
  let fallback = 0
  const parents = new Set<string>()
  for (const n of nodes.values()) if (n.parentId) parents.add(n.parentId)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const n of nodes.values()) {
    if (hiddenAnywhere(n, nodes)) continue
    const { w, h } = size(n)
    const { x, y } = n.internals.positionAbsolute
    const group = n.type === 'group' || parents.has(n.id)
    const d = n.data as { label?: unknown; shape?: Shape }
    const shape: Shape = d?.shape ?? (n.type === 'input' || n.type === 'output' ? 'round' : 'rect')
    const top = group ? undefined : textures.get(n.id)
    if (!group && isCustom(n.type) && !top) fallback++
    boxes.push({ id: n.id, label: typeof d?.label === 'string' ? d.label : n.id, kind: group ? 'group' : 'node', shape, x, y, w, h, level: levelOf(n, nodes), parent: n.parentId, top })
    ids.add(n.id)
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h)
  }
  const M = 60
  const f: Frame = frame ?? (boxes.length ? { ox: M - x0, oy: M - y0, width: x1 - x0 + 2 * M, height: y1 - y0 + 2 * M } : { ox: 0, oy: 0, width: 400, height: 300 })
  for (const b of boxes) { b.x += f.ox; b.y += f.oy }
  const routes: Route[] = []
  for (const e of edges) {
    if (e.hidden || !ids.has(e.source) || !ids.has(e.target)) continue
    const r = routeOf(e, nodes, mode)
    if (!r || r.points.length < 2) continue
    routes.push({
      id: e.id, from: e.source, to: e.target,
      label: typeof e.label === 'string' || typeof e.label === 'number' ? String(e.label) : undefined,
      points: r.points.map(([x, y]) => [x + f.ox, y + f.oy] as [number, number]),
      labelAt: [r.label[0] + f.ox, r.label[1] + f.oy],
    })
  }
  // parents before children so trays sit under their contents
  boxes.sort((a, b) => a.level - b.level)
  return { layout: { boxes, routes, width: f.width, height: f.height }, frame: f, fallback }
}

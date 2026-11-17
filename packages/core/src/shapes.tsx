import * as THREE from 'three'
import { useMemo } from 'react'
import { Billboard, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Box, LabelMode } from './model'

export type { LabelMode }

import { S, TRAY, NODE_H, TEXT_LAYER } from './scale.ts'
import { slotShape } from './EdgeScene'
import { Mat, Ink, PlateText, useTheme, fontUrl, patternTexture, useFormTexture, FORM_ASPECT } from './look'
import type { Plate } from './theme'
import { pickCorner, titleWidth, type Corner, type Rect } from './titles'
export { S, TRAY, NODE_H }


function rounded(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
  return s
}
function geometry(shape: Box['shape'], w: number, h: number, height: number, bevel: number) {
  let g: THREE.BufferGeometry
  if (shape === 'cylinder') {
    g = new THREE.CylinderGeometry(0.5, 0.5, 1, 48).translate(0, 0.5, 0).scale(w, height, h)
    return g
  }
  let sh: THREE.Shape
  if (shape === 'diamond') {
    sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(0, -h / 2); sh.lineTo(w / 2, 0); sh.lineTo(0, h / 2); sh.closePath()
  } else sh = rounded(w, h, shape === 'round' ? Math.min(w, h) / 2 * 0.95 : 0.12)
  g = new THREE.ExtrudeGeometry(sh, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 })
  g.rotateX(-Math.PI / 2)
  return g
}

// The footprint's outline in plan (x, z), for the shapes with a rounded side or corner (everything but the diamond, whose corners are creases).
function plan(shape: Box['shape'], w: number, h: number): [number, number][] {
  if (shape === 'cylinder') return Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * Math.PI * 2; return [Math.cos(a) * w / 2, Math.sin(a) * h / 2] as [number, number] })
  const raw = rounded(w, h, shape === 'round' ? Math.min(w, h) / 2 * 0.95 : 0.12).getPoints(16).map(p => [p.x, -p.y] as [number, number]) // shape y is world -z
  // a repeated point (where two segments join, or the loop's last point equal to its first) is a zero-length edge with no facing: it would fake a silhouette
  const out: [number, number][] = []
  for (const p of raw) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-6) out.push(p) }
  const f = out[0], l = out[out.length - 1]
  if (out.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) <= 1e-6) out.pop()
  return out
}

/**
 * Vertical ink lines on the two edge-on points of a rounded side. They are not creases, so the outline pass has none; they are where the
 * surface turns away from the camera, so they move round the curve as the view turns. Each frame: the vertices of the footprint where the
 * outward normal stops facing the camera, found from the camera's position in the node's frame; two unit Line2s are placed there and stretched to the height.
 */
function Silhouette({ shape, w, h, height, y, color, width }: { shape: Box['shape']; w: number; h: number; height: number; y: number; color: string; width: number }) {
  const pts = useMemo(() => plan(shape, w, h), [shape, w, h])
  const root = useRef<THREE.Group>(null!)
  const a = useRef<any>(null), b = useRef<any>(null)
  // a rect's rounded corners that face the camera have no crease either, so they get a line at the middle of the arc; one near the silhouette is left to the silhouette line
  const corners = useMemo(() => shape === 'rect' ? ([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).map(([sx, sz]) => ({ n: [sx * Math.SQRT1_2, sz * Math.SQRT1_2] as const, p: [sx * (w / 2 - 0.12 * (1 - Math.SQRT1_2)), sz * (h / 2 - 0.12 * (1 - Math.SQRT1_2))] as const })) : [], [shape, w, h])
  const cl = useRef<any[]>([])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const n = pts.length
  // orientation of the loop, so "outward" is the same side for any winding
  const sign = useMemo(() => pts.reduce((s, p, i) => { const q = pts[(i + 1) % n]; return s + (q[0] - p[0]) * (q[1] + p[1]) }, 0) > 0 ? 1 : -1, [pts, n])
  useFrame(({ camera }) => {
    root.current.getWorldPosition(pos)
    const cx = camera.position.x - pos.x, cz = camera.position.z - pos.z
    // looking (nearly) straight down, a vertical line is a dot: it would only shimmer, and which points are edge-on flips with the slightest move
    const steep = camera.position.y - pos.y > Math.hypot(cx, cz) * 3.7 // more than about 75 degrees above the horizon
    root.current.visible = !steep
    if (steep) return
    const facing = pts.map((p, i) => {
      const q = pts[(i + 1) % n], ex = q[0] - p[0], ez = q[1] - p[1]
      return sign * (ez * (cx - (p[0] + q[0]) / 2) - ex * (cz - (p[1] + q[1]) / 2)) > 0 // outward normal . (camera - edge midpoint) > 0
    })
    // the vertex where the edges stop facing the camera, and the one where they start again
    const found: number[] = []
    for (let i = 0; i < n; i++) if (facing[(i + n - 1) % n] && !facing[i]) { found[0] = i; break }
    for (let i = 0; i < n; i++) if (!facing[(i + n - 1) % n] && facing[i]) { found[1] = i; break }
    corners.forEach((c, i) => {
      const l = cl.current[i]
      if (!l) return
      const vx = cx - c.p[0], vz = cz - c.p[1], len = Math.hypot(vx, vz) || 1
      l.visible = (c.n[0] * vx + c.n[1] * vz) / len > 0.35
      l.position.set(c.p[0], y, c.p[1]); l.scale.set(1, height, 1)
    })
    for (const [ref, k] of [[a, 0], [b, 1]] as const) {
      const l = ref.current, i = found[k]
      if (!l) continue
      l.visible = i !== undefined
      if (i !== undefined) { l.position.set(pts[i][0], y, pts[i][1]); l.scale.set(1, height, 1) }
    }
  })
  const unit: [number, number, number][] = [[0, 0, 0], [0, 1, 0]]
  return (
    <group ref={root}>
      <Line ref={a} points={unit} color={color} lineWidth={width} />
      <Line ref={b} points={unit} color={color} lineWidth={width} />
      {corners.map((_, i) => <Line key={i} ref={(l: any) => { cl.current[i] = l }} points={unit} color={color} lineWidth={width} />)}
    </group>
  )
}

// A landscape form: a cut-out standing on the node's footprint, with the label in front of its foot. Both live in one billboard
// frame, so "above" and "in front" are screen directions in flat view too (where the camera looks straight down).
function Form({ shape, w, h, y, gap, label, plate, font, toward }: { shape: Box['shape']; w: number; h: number; y: number; gap: number; label: string; plate: Plate; font?: string; toward: number }) {
  const tex = useFormTexture(shape)
  const fw = Math.min(shape === 'diamond' ? 1.4 : 2.2, w * 0.8, h * 1.8), fh = fw * FORM_ASPECT[shape]
  return (
    <Billboard position={[0, y, 0]}>
      {tex && (
        <mesh position={[0, gap + fh / 2, 0]}>
          <planeGeometry args={[fw, fh]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.3} toneMapped={false} />
        </mesh>
      )}
      <group position={[0, 0.1, 0]}><PlateText text={label} plate={plate} font={font} fontSize={0.36} maxWidth={w - 0.3} toward={Math.max(toward, 0.7)} inFront /></group>
    </Billboard>
  )
}

/** The height a node's body stands (a landscape node: its plinth); the edge planner and the drag plane use the same. */
export const nodeHeight = (th: { node: { form: string; footprint: { height: number } } }, b: Box) => th.node.form === 'landscape' ? th.node.footprint.height : (b.height ?? NODE_H)

export function NodeBody({ b, hover = false, labelMode }: { b: Box; hover?: boolean; labelMode: LabelMode }) {
  const th = useTheme()
  const w = b.w * S, h = b.h * S
  const land = th.node.form === 'landscape'
  const height = nodeHeight(th, b)
  // a plinth is the surface the node stands on (its tray's top, or the ground), a step darker; level 2 stands on a darker tray, so on a darker plinth
  const plinth = useMemo(() => {
    const fp = th.node.footprint
    if (fp.color) return fp.color
    const under = b.level > 0 ? th.tray.colors[Math.min(b.level - 1, 2)] : th.ground.bg
    return '#' + new THREE.Color(under).multiplyScalar(fp.darken).getHexString()
  }, [th.node.footprint, th.tray.colors, th.ground.bg, b.level])
  const geo = useMemo(() => geometry(b.shape, land ? w * 0.9 : w, land ? h * 0.9 : h, height, th.node.bevel), [b.shape, w, h, height, land, th.node.bevel])
  return (
    <>
      {/* an inked node stands a hair above its surface so its bottom outline is not lost to the depth test against the tray top */}
      <mesh geometry={geo} position={[0, th.node.outline ? 0.012 : 0, 0]} castShadow={th.light.shadows} receiveShadow={th.light.shadows}>
        <Mat color={land ? plinth : th.node.colors[b.shape]} roughness={0.5} metalness={0.05} emissive={hover ? th.node.hover : '#000000'} emissiveIntensity={hover ? th.node.hoverIntensity : 0} />
        <Ink color={th.node.outline} width={th.node.outlineWidth} />
      </mesh>
      {th.node.outline && b.shape !== 'diamond' && (
        <Silhouette shape={b.shape} w={land ? w * 0.9 : w} h={land ? h * 0.9 : h} height={height} y={0.012} color={th.node.outline} width={th.node.outlineWidth} />
      )}
      {land
        ? <Form shape={b.shape} w={w} h={h} y={height} gap={th.node.labelGap} label={b.label} plate={th.label.node} font={fontUrl(th)} toward={th.label.toward} />
        : <Label text={b.label} mode={labelMode} y={height + 0.08} size={0.36} maxWidth={w - 0.3} role="node" />}
    </>
  )
}

export function Label({ text, mode, y, size, maxWidth, left = false, right = false, role }: { text: string; mode: LabelMode; y: number; size: number; maxWidth: number; left?: boolean; right?: boolean; role: 'node' | 'tray' }) {
  const th = useTheme()
  const plate = th.label[role], font = fontUrl(th)
  const body = <PlateText text={text} plate={plate} font={font} fontSize={size} maxWidth={maxWidth} left={left} right={right} outline={mode !== 'top' && plate.style === 'plain'} toward={mode !== 'top' && role === 'node' ? th.label.toward : 0} />
  if (mode === 'top') return <group rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>{body}</group>
  return <Billboard position={[0, y + 0.45, 0]}>{body}</Billboard>
}

export function Tray({ b, labelMode, hover = false, slots = [], kids = [] }: { b: Box; labelMode: LabelMode; hover?: boolean; slots?: { x0: number; x1: number; z0: number; z1: number }[]; kids?: Rect[] }) {
  const th = useTheme()
  const w = b.w * S, h = b.h * S
  const lv = Math.min(b.level, 2)
  const T = th.tray.thickness
  // the title's corner: fixed back-left, or the first corner nothing stands on (a form stands taller than its footprint, so it is grown more)
  const last = useRef<Corner>('bl')
  const corner: Corner = useMemo(() => {
    if (th.tray.titles === 'fixed') return 'bl'
    const c = pickCorner(w, h, titleWidth(b.label, 0.4), 0.75, kids, th.node.form === 'landscape' ? { x0: 1.0, x1: 0.3, z0: 1.9, z1: 0.3 } : { x0: 0.4, x1: 0.3, z0: 0.8, z1: 0.3 }, last.current)
    last.current = c
    return c
  }, [th.tray.titles, th.node.form, w, h, b.label, JSON.stringify(kids)])
  const pat = th.tray.sides[lv]
  const side = useMemo(() => {
    const t = patternTexture(pat, th.tray.patternInk, th.tray.patternPaper, th.tray.outline ?? th.tray.patternInk)
    if (!t) return null
    const c = t.clone(); c.needsUpdate = true
    c.repeat.set(1 / T, 1 / T) // extruded side walls have world-unit UVs (v runs 1-T..1): one square tile is exactly the band's height
    c.offset.set(0, ((-(1 - T) / T) % 1 + 1) % 1)
    return c
  }, [pat, th.tray.patternInk, th.tray.patternPaper, T])
  // with tunnel slots (in tray-local x, z) the top is cut open, and a patterned side needs the extruded walls; otherwise a plain box
  const cut = useMemo(() => {
    if (!slots.length && !side) return null
    return new THREE.ExtrudeGeometry(slotShape(-w / 2, -h / 2, w / 2, h / 2, slots), { depth: T, bevelEnabled: false }).rotateX(-Math.PI / 2)
  }, [w, h, JSON.stringify(slots), !!side, T])
  const mat = (map: THREE.Texture | null | undefined, attach?: string) => <Mat attach={attach} color={map ? '#ffffff' : th.tray.colors[lv]} map={map} roughness={0.9} emissive={hover ? th.tray.hover : '#000'} emissiveIntensity={hover ? th.tray.hoverIntensity : 0} />
  return (
    <>
      <mesh key={cut ? 'cut' : 'box'} position={[0, cut ? 0 : T / 2, 0]} receiveShadow={th.light.shadows} geometry={cut ?? undefined}>
        {!cut && <boxGeometry args={[w, T, h]} />}
        {cut ? <>{mat(null, 'material-0')}{mat(side, 'material-1')}</> : mat(null)}
        <Ink color={th.tray.outline} width={th.node.outlineWidth} />
      </mesh>
      <group position={[corner === 'bl' || corner === 'fl' ? -w / 2 + 0.25 : w / 2 - 0.25, 0, corner === 'bl' || corner === 'br' ? -h / 2 + 0.5 : h / 2 - 0.5]}>
        <Label text={b.label} mode={labelMode} y={T + 0.01} size={0.4} maxWidth={w - 0.5} left={corner === 'bl' || corner === 'fl'} right={corner === 'br' || corner === 'fr'} role="tray" />
      </group>
    </>
  )
}

// y of the surface a box sits on
export const baseOf = (b: Box, thickness = TRAY) => b.level * thickness

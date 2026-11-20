import * as THREE from 'three'
import { useMemo, useRef, useState } from 'react'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Box, LabelMode } from './model'

export type { LabelMode }

import { S, TRAY, NODE_H, TEXT_LAYER } from './scale.ts'
import { slotShape } from './EdgeScene'
import { Mat, Ink, PlateText, handBox, useTheme, fontUrl, patternTexture, useFormTexture, FORM_ASPECT } from './look'
import type { Plate } from './theme'
import { pickCorner, titleWidth, offTitleWidth, OFF_TITLE, type Corner, type Rect } from './titles'
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
          {/* no depth written: forms paint back to front among themselves, and the labels (drawn after them) stay readable over a nearer form */}
          <meshBasicMaterial map={tex} transparent alphaTest={0.3} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <group position={[0, 0.1, 0]}><PlateText text={label} plate={plate} font={font} fontSize={0.36} maxWidth={w - 0.3} toward={Math.max(toward, 0.7)} inFront /></group>
    </Billboard>
  )
}

/** The height a node's body stands (a landscape node: its plinth); the edge planner and the drag plane use the same. */
export const nodeHeight = (th: { node: { form: string; footprint: { height: number } } }, b: Box) => th.node.form === 'landscape' ? th.node.footprint.height : (b.height ?? NODE_H)

/** What a device-form node shows of its edges: its role, the colour of the beam it catches (its status light) and of the one it fires. */
export interface Device { role: 'emitter' | 'detector' | 'relay' | 'idle'; caught: string | null; fires: string | null }

export function NodeBody({ b, hover = false, labelMode, device }: { b: Box; hover?: boolean; labelMode: LabelMode; device?: Device }) {
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
  const idle = device?.role === 'idle'
  const dim = useMemo(() => '#' + new THREE.Color(th.node.colors[b.shape]).multiplyScalar(0.55).getHexString(), [th.node.colors, b.shape])
  const geo = useMemo(() => geometry(b.shape, land ? w * 0.9 : w, land ? h * 0.9 : h, height, th.node.bevel), [b.shape, w, h, height, land, th.node.bevel])
  return (
    <>
      {/* an inked node stands a hair above its surface so its bottom outline is not lost to the depth test against the tray top */}
      <mesh geometry={geo} position={[0, th.node.outline ? 0.012 : 0, 0]} castShadow={th.light.shadows} receiveShadow={th.light.shadows}>
        <Mat color={land ? plinth : idle ? dim : th.node.colors[b.shape]} roughness={0.5} metalness={device ? 0.3 : 0.05} emissive={hover ? th.node.hover : '#000000'} emissiveIntensity={hover ? th.node.hoverIntensity : 0} />
        <Ink color={th.node.outline} width={th.node.outlineWidth} />
      </mesh>
      {th.node.outline && b.shape !== 'diamond' && (
        <Silhouette shape={b.shape} w={land ? w * 0.9 : w} h={land ? h * 0.9 : h} height={height} y={0.012} color={th.node.outline} width={th.node.outlineWidth} />
      )}
      {device?.fires && <FireBand shape={b.shape} w={w} h={h} y={height + 0.03} color={device.fires} />}
      {device && <StatusLight w={w} h={h} y={height} role={device.role} color={device.caught ?? device.fires} />}
      {land
        ? <Form shape={b.shape} w={w} h={h} y={height} gap={th.node.labelGap} label={b.label} plate={th.label.node} font={fontUrl(th)} toward={th.label.toward} />
        : <Label text={b.label} mode={labelMode} y={height + 0.08} size={0.36} maxWidth={w - 0.3} role="node" />}
    </>
  )
}

// A device that fires beams wears their colour: a lit band round the top edge (a core line in the laser colour with a faint wider glow),
// which reads from straight above (flat) as well as in iso, and says which node a beam colour belongs to.
function FireBand({ shape, w, h, y, color }: { shape: Box['shape']; w: number; h: number; y: number; color: string }) {
  const pts = useMemo(() => {
    const p = shape === 'diamond' ? [[-w / 2, 0], [0, -h / 2], [w / 2, 0], [0, h / 2]] as [number, number][] : plan(shape, w, h)
    const inset = (q: [number, number]): [number, number, number] => [q[0] * 0.96, y, q[1] * 0.96]
    return [...p, p[0]].map(inset)
  }, [shape, w, h, y])
  const hi = useMemo(() => '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5).getHexString(), [color])
  return (
    <>
      <Line points={pts} color={color} lineWidth={7} transparent opacity={0.3} depthWrite={false} />
      <Line points={pts} color={color} lineWidth={3} />
      <Line points={pts} color={hi} lineWidth={1} />
    </>
  )
}

// A device's status light on its top corner: lit in the colour of the beam it catches (an emitter: its own), dark when it has no edges.
function StatusLight({ w, h, y, role, color }: { w: number; h: number; y: number; role: Device['role']; color: string | null }) {
  const lit = role !== 'idle' && color
  return (
    <mesh position={[w / 2 - 0.25, y + 0.035, -h / 2 + 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.08, 16]} /><meshBasicMaterial color={lit ? '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.7).getHexString() : '#2a3245'} />
    </mesh>
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
    if (th.tray.titles !== 'free') return 'bl'
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
      {th.tray.titles === 'off'
        ? <OffTitle text={b.label} w={w} h={h} />
        : <group position={[corner === 'bl' || corner === 'fl' ? -w / 2 + 0.25 : w / 2 - 0.25, 0, corner === 'bl' || corner === 'br' ? -h / 2 + 0.5 : h / 2 - 0.5]}>
          <Label text={b.label} mode={labelMode} y={T + 0.01} size={0.4} maxWidth={w - 0.5} left={corner === 'bl' || corner === 'fl'} right={corner === 'br' || corner === 'fr'} role="tray" />
        </group>}
    </>
  )
}

// A tray's title off the tray (theme.tray.titles 'off'): a coloured-in, hand-drawn box lying on the surface the tray stands on (the
// tray's origin: the paper, or its parent tray's top), just in front of its front edge. The box is the one the layout made room for and
// the router keeps lines off (titles.ts offTitleBoxes); a title too long for it is drawn smaller to fit inside.
function OffTitle({ text, w, h }: { text: string; w: number; h: number }) {
  const th = useTheme()
  const font = fontUrl(th)
  const plate = th.label.tray
  const bw = offTitleWidth(text, w), bd = OFF_TITLE.depth
  const [tw, setTw] = useState(0) // the text's width as drawn at OFF_TITLE.size
  const tex = useMemo(() => handBox(plate.border, plate.text, text, bw / bd), [plate.border, plate.text, text, bw, bd])
  if (bw <= 0) return null
  const inner = bw - 2 * Math.min(OFF_TITLE.pad, bw * 0.1)
  const k = tw > inner ? inner / tw : 1
  return (
    <group position={[-w / 2 + OFF_TITLE.inset, 0.015, h / 2 + OFF_TITLE.gap]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[bw / 2, -bd / 2, 0]} layers={TEXT_LAYER as any} renderOrder={1}>
        <planeGeometry args={[bw, bd]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} toneMapped={false} />
      </mesh>
      <Text layers={TEXT_LAYER as any} renderOrder={3} position={[bw / 2, -bd / 2, 0.01]} scale={k} depthOffset={-12} font={font} fontSize={OFF_TITLE.size} color={plate.text}
        anchorX="center" anchorY="middle" whiteSpace="nowrap"
        onSync={(t: any) => { const r = t.textRenderInfo?.blockBounds; if (r) setTw(p => (Math.abs(p - (r[2] - r[0])) < 1e-3 ? p : r[2] - r[0])) }}>{text}</Text>
    </group>
  )
}

// y of the surface a box sits on
export const baseOf = (b: Box, thickness = TRAY) => b.level * thickness

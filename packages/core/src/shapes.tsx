import * as THREE from 'three'
import { useMemo, useRef, useState } from 'react'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Box, LabelMode } from './model'

export type { LabelMode }

import { S, TRAY, NODE_H, TEXT_LAYER, ICON_TOP } from './scale.ts'
import { Icon, Card } from './icons'
import { slotShape } from './EdgeScene'
import { Mat, Ink, PlateText, handBox, useTheme, fontUrl, fontOf, patternTexture, useFormTexture, FORM_ASPECT } from './look'
import type { Plate } from './theme'
import { pickCorner, titleWidth, offTitleWidth, groundTitle, groundWidth, GROUND, OFF_TITLE, type Corner, type GroundFit, type Rect } from './titles'
export { S, TRAY, NODE_H }


export function rounded(w: number, h: number, r: number) {
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
export const nodeHeight = (th: { node: { form: string; footprint: { height: number }; icon: { size: number } } }, b: Box) => th.node.form === 'landscape' ? th.node.footprint.height : th.node.form === 'icon' ? ICON_TOP[b.shape] * (th.node.icon.size / 1.2) : (b.height ?? NODE_H)

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
  if (th.node.form === 'icon') return <><Icon shape={b.shape} hover={hover} /><Card title={b.title ?? b.label} sub={b.sub} shape={b.shape} w={w} /></>
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

export const mixc = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

export function Tray({ b, labelMode, hover = false, slots = [], kids = [], zone }: { b: Box; labelMode: LabelMode; hover?: boolean; slots?: { x0: number; x1: number; z0: number; z1: number }[]; kids?: Rect[]; zone?: { color: string; nested: boolean } }) {
  const th = useTheme()
  const w = b.w * S, h = b.h * S
  const lv = Math.min(b.level, 2)
  const T = th.tray.thickness
  const ground = th.tray.titles === 'ground'
  // the title's corner: fixed back-left, or the first corner nothing stands on (a form stands taller than its footprint, so it is grown more)
  const last = useRef<Corner>(ground ? 'fl' : 'bl')
  const gfit = useMemo(() => groundTitle(w, h, b.label, b.level), [w, h, b.label, b.level])
  const corner: Corner = useMemo(() => {
    if (ground) {
      const c = pickCorner(w, h, Math.max(...gfit.lines.map(l => groundWidth(l, gfit.size))), gfit.size * GROUND.line * gfit.lines.length, kids, GROUND_GROW, last.current, GROUND_ORDER)
      last.current = c
      return c
    }
    if (th.tray.titles !== 'free') return 'bl'
    const c = pickCorner(w, h, titleWidth(b.label, 0.4), 0.75, kids, th.node.form === 'landscape' ? { x0: 1.0, x1: 0.3, z0: 1.9, z1: 0.3 } : { x0: 0.4, x1: 0.3, z0: 0.8, z1: 0.3 }, last.current)
    last.current = c
    return c
  }, [ground, th.tray.titles, th.node.form, w, h, b.label, gfit, JSON.stringify(kids)])
  const pat = th.tray.sides[lv]
  const side = useMemo(() => {
    const t = patternTexture(pat, th.tray.patternInk, th.tray.patternPaper, th.tray.outline ?? th.tray.patternInk)
    if (!t) return null
    const c = t.clone(); c.needsUpdate = true
    c.repeat.set(1 / T, 1 / T) // extruded side walls have world-unit UVs (v runs 1-T..1): one square tile is exactly the band's height
    c.offset.set(0, ((-(1 - T) / T) % 1 + 1) % 1)
    return c
  }, [pat, th.tray.patternInk, th.tray.patternPaper, T])
  // a zone's floor: its colour mixed with white (a nested one less, so it reads as a stronger tint of its parent's), a lighter side, a rim line in the zone colour
  const top = zone ? mixc(zone.color, '#ffffff', th.tray.zoneMix[zone.nested ? 1 : 0]) : th.tray.colors[lv]
  const sideColor = zone ? mixc(zone.color, '#ffffff', 0.35) : th.tray.colors[lv]
  const rounded0 = th.tray.radius > 0
  const rim = useMemo(() => (zone && rounded0 ? rounded(w, h, Math.min(th.tray.radius, w / 2, h / 2)).getPoints(8).map(p => [p.x, T + 0.002, -p.y] as [number, number, number]) : null), [zone, rounded0, w, h, th.tray.radius, T])
  // with tunnel slots (in tray-local x, z) the top is cut open, and a patterned side needs the extruded walls; otherwise a plain box
  const cut = useMemo(() => {
    if (!slots.length && !side && !rounded0) return null
    const sh = slots.length || !rounded0 ? slotShape(-w / 2, -h / 2, w / 2, h / 2, slots) : rounded(w, h, Math.min(th.tray.radius, w / 2, h / 2))
    return new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2)
  }, [w, h, JSON.stringify(slots), !!side, T, rounded0, th.tray.radius])
  const mat = (map: THREE.Texture | null | undefined, attach?: string, color = top) => <Mat attach={attach} color={map ? '#ffffff' : color} map={map} roughness={0.9} emissive={hover ? th.tray.hover : '#000'} emissiveIntensity={hover ? th.tray.hoverIntensity : 0} />
  const left = corner === 'bl' || corner === 'fl', back = corner === 'bl' || corner === 'br'
  return (
    <>
      <mesh key={cut ? 'cut' : 'box'} position={[0, cut ? 0 : T / 2, 0]} receiveShadow={th.light.shadows} geometry={cut ?? undefined}>
        {!cut && <boxGeometry args={[w, T, h]} />}
        {cut ? <>{mat(null, 'material-0')}{mat(side, 'material-1', sideColor)}</> : mat(null)}
        <Ink color={th.tray.outline} width={th.node.outlineWidth} />
      </mesh>
      {rim && <Line points={[...rim, rim[0]]} color={zone!.color} lineWidth={1.5} />}
      {th.tray.titles === 'off'
        ? <OffTitle text={b.label} w={w} h={h} />
        : ground
          ? <GroundTitle fit={gfit} w={w} h={h} T={T} left={left} back={back} color={mixc(zone?.color ?? th.tray.colors[lv], '#000000', th.tray.groundInk)} />
          : (
            <group position={[left ? -w / 2 + 0.25 : w / 2 - 0.25, 0, back ? -h / 2 + 0.5 : h / 2 - 0.5]}>
              <Label text={b.label} mode={labelMode} y={T + 0.01} size={0.4} maxWidth={w - 0.5} left={left} right={!left} role="tray" />
            </group>
          )}
    </>
  )
}

// A zone's name in big capitals lying on its floor, at a corner nothing stands on (front-left first), wrapped and sized to fit it
// (titles.ts groundTitle). The font's real width can differ from that estimate, so the text as drawn is shrunk to the floor if it is wider.
const GROUND_ORDER: Corner[] = ['fl', 'fr', 'bl', 'br']
const GROUND_GROW = { x0: 0.5, x1: 0.2, z0: 0.6, z1: 0.3 } // an icon (its box is larger than the icon) stands over the floor it is on; the card is drawn over everything, so only the footprint counts
function GroundTitle({ fit, w, h, T, left, back, color }: { fit: GroundFit; w: number; h: number; T: number; left: boolean; back: boolean; color: string }) {
  const th = useTheme()
  const font = fontOf(th.tray.groundFont)
  const { lines, size } = fit
  const [k, setK] = useState(1)
  const roomW = w - 2 * GROUND.inset, roomH = h - 2 * GROUND.inset
  return (
    <Text position={[left ? -w / 2 + GROUND.inset : w / 2 - GROUND.inset, T + 0.004, back ? -h / 2 + GROUND.inset + size + (lines.length - 1) * size * GROUND.line : h / 2 - GROUND.inset]}
      rotation={[-Math.PI / 2, 0, 0]} scale={k} font={font} fontSize={size} letterSpacing={0.04} lineHeight={lines.length > 1 ? GROUND.line : undefined}
      textAlign={left ? 'left' : 'right'} anchorX={left ? 'left' : 'right'} anchorY="bottom" color={color} fillOpacity={0.8} layers={TEXT_LAYER as any}
      onSync={(t: any) => {
        const r = t.textRenderInfo?.blockBounds
        if (!r) return
        const scale = Math.min(1, roomW / (r[2] - r[0]), roomH / (r[3] - r[1]))
        setK(p => (Math.abs(p - scale) < 1e-3 ? p : scale))
      }}>{lines.join('\n').toUpperCase()}</Text>
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

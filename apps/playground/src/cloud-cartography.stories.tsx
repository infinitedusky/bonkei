// MOCKUP (BON-235): the Cloud Cartography theme, drawn in three.js the way the build should draw it, after the agreed sketch
// (sketches/cloud-cartography.html). The layout and the reading of the source are the mockup's own (hand-placed), not the build's:
// the build lays the diagram out and routes its lines with Bonkei's own layout. MADE-UP SAMPLE DATA.
//
// What it shows: each top-level subgraph is a thin coloured floor (a nested one a stronger tint of its parent) with its name in big
// letters lying on it; each node is a modelled icon by shape, inked, that turns with the view; each label is a white callout card on a
// dotted leader, with a second line when the label has a <br>; links are navy lines on the floor with one arrow partway along; dotted
// links (-.->) arc overhead, dashed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Billboard, Edges, Line, OrbitControls, Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { PRESET, type Mode } from 'bonkei/internal'

// ---- the look: the sketch's values (from the approved BON-32 Map preset)
const BG = '#f5f6f9', GRID = '#e1e4ea', INK = '#2a2f3a', NAVY = '#1d36a6', FAR = '#c8743a', SIDE = '#dfe3ec', TOP = '#f6f7fa'
const SHAPE = { rect: '#6fae45', round: '#4f7cff', cylinder: '#f0a43c', diamond: '#d9534f' } as const
type Shape = keyof typeof SHAPE
const mix = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()
const FLOOR = 0.08

// ---- the made-up diagrams, as written and as placed (world units; x right, z toward the viewer)
type Zone = { label: string; color: string; x0: number; z0: number; x1: number; z1: number; level: number }
type Node = { id: string; label: string; sub?: string; shape: Shape; x: number; z: number; level: number }
type Link = { pts: [number, number][]; label?: string; dashed?: boolean; color?: string }
type Arc = { from: string; to: string; label?: string }
type Diagram = { source: string; zones: Zone[]; nodes: Node[]; links: Link[]; arcs: Arc[] }

const FLOW: Diagram = {
  source: `---
config:
  theme: cloud-cartography
---
flowchart LR
  subgraph edge[Edge]
    browser(["Browser<br>Web · mobile"]) --> gw["API Gateway<br>Envoy · TLS"]
  end
  subgraph orders[Orders]
    oapi["Order API<br>Go · 3 pods"] --> valid{Valid?}
    valid -->|yes| osvc["Order Svc<br>Go · 2 pods"]
    subgraph data[Data]
      queue[("Order Queue<br>Kafka")]
    end
    osvc --> queue
  end
  subgraph payments[Payments]
    papi["Payment API<br>Node · 3 pods"] --> fraud{Fraud?}
    fraud -->|ok| charge(["Charge Card<br>Stripe adapter"])
    charge --> ledger[("Ledger<br>Postgres · HA")]
  end
  gw --> oapi
  gw --> papi
  queue -.->|pay| papi
  ledger -.->|receipt| browser`,
  zones: [
    { label: 'Edge', color: '#9aa3b2', x0: 0, z0: 3.5, x1: 6, z1: 9, level: 0 },
    { label: 'Orders', color: '#6fae45', x0: 8, z0: 0, x1: 22, z1: 7, level: 0 },
    { label: 'Data', color: '#6fae45', x0: 15, z0: 3.6, x1: 21.4, z1: 6.5, level: 1 },
    { label: 'Payments', color: '#f0a43c', x0: 8, z0: 8.6, x1: 22, z1: 14, level: 0 },
  ],
  nodes: [
    { id: 'browser', label: 'Browser', sub: 'Web · mobile', shape: 'round', x: 1.6, z: 5.6, level: 1 },
    { id: 'gw', label: 'API Gateway', sub: 'Envoy · TLS', shape: 'rect', x: 4.4, z: 5.6, level: 1 },
    { id: 'oapi', label: 'Order API', sub: 'Go · 3 pods', shape: 'rect', x: 10, z: 2, level: 1 },
    { id: 'valid', label: 'Valid?', shape: 'diamond', x: 13.6, z: 2, level: 1 },
    { id: 'osvc', label: 'Order Svc', sub: 'Go · 2 pods', shape: 'rect', x: 17.4, z: 2, level: 1 },
    { id: 'queue', label: 'Order Queue', sub: 'Kafka', shape: 'cylinder', x: 19.6, z: 5, level: 2 },
    { id: 'papi', label: 'Payment API', sub: 'Node · 3 pods', shape: 'rect', x: 10, z: 11, level: 1 },
    { id: 'fraud', label: 'Fraud?', shape: 'diamond', x: 13.6, z: 11, level: 1 },
    { id: 'charge', label: 'Charge Card', sub: 'Stripe adapter', shape: 'round', x: 17, z: 11, level: 1 },
    { id: 'ledger', label: 'Ledger', sub: 'Postgres · HA', shape: 'cylinder', x: 20.2, z: 11, level: 1 },
  ],
  links: [
    { pts: [[1.6, 5.6], [4.4, 5.6]] },
    { pts: [[4.4, 5.6], [7, 5.6], [7, 2], [10, 2]] },
    { pts: [[4.4, 5.6], [7, 5.6], [7, 11], [10, 11]] },
    { pts: [[10, 2], [13.6, 2]] },
    { pts: [[13.6, 2], [17.4, 2]], label: 'yes' },
    { pts: [[17.4, 2], [17.4, 5], [19.6, 5]] },
    { pts: [[10, 11], [13.6, 11]] },
    { pts: [[13.6, 11], [17, 11]], label: 'ok' },
    { pts: [[17, 11], [20.2, 11]] },
  ],
  arcs: [{ from: 'queue', to: 'papi', label: 'pay' }, { from: 'ledger', to: 'browser', label: 'receipt' }],
}

const SEQ: Diagram = {
  source: `---
config:
  theme: cloud-cartography
---
sequenceDiagram
  participant u as Browser
  participant g as Gateway
  participant a as Auth
  participant d as Users DB
  u->>g: POST /login
  g->>a: check(user, pw)
  a->>d: find user
  d-->>a: row
  a-->>g: token
  g-->>u: 200 + cookie`,
  zones: [{ label: 'Login', color: '#4f7cff', x0: -1, z0: -1.4, x1: 15, z1: 13.5, level: 0 }],
  nodes: [
    { id: 'u', label: 'Browser', shape: 'round', x: 1, z: 0, level: 1 }, { id: 'g', label: 'Gateway', shape: 'rect', x: 5, z: 0, level: 1 },
    { id: 'a', label: 'Auth', shape: 'diamond', x: 9, z: 0, level: 1 }, { id: 'd', label: 'Users DB', shape: 'cylinder', x: 13, z: 0, level: 1 },
  ],
  links: (() => {
    const X: Record<string, number> = { u: 1, g: 5, a: 9, d: 13 }
    const msgs: [string, string, string, boolean?][] = [['u', 'g', 'POST /login'], ['g', 'a', 'check(user, pw)'], ['a', 'd', 'find user'], ['d', 'a', 'row', true], ['a', 'g', 'token', true], ['g', 'u', '200 + cookie', true]]
    const lifelines: Link[] = Object.values(X).map(x => ({ pts: [[x, 0.9], [x, 12.6]], dashed: true, color: '#7a86a8' }))
    return [...lifelines, ...msgs.map(([f, t, l, ret], i): Link => ({ pts: [[X[f], 2.2 + i * 1.7], [X[t], 2.2 + i * 1.7]], label: l, dashed: ret, color: ret ? '#5566b8' : NAVY }))]
  })(),
  arcs: [],
}

// ---- floors: a thin rounded slab, the name in big letters lying on it
function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -d / 2
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + d - r)
  s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d); s.lineTo(x0 + r, y0 + d); s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r)
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return s
}
function Floor({ z }: { z: Zone }) {
  const w = z.x1 - z.x0, d = z.z1 - z.z0, y0 = z.level * FLOOR
  const shape = useMemo(() => roundedRect(w, d, 0.5), [w, d])
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: FLOOR, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2), [shape])
  const rim = useMemo(() => shape.getPoints(8).map(p => [p.x, y0 + FLOOR + 0.002, -p.y] as [number, number, number]), [shape, y0])
  const top = z.level ? mix(z.color, '#ffffff', 0.55) : mix(z.color, '#ffffff', 0.72)
  const size = z.level ? 0.75 : 1.15
  return (
    <group position={[(z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2]}>
      <mesh geometry={geo} position={[0, y0, 0]}>
        <meshBasicMaterial attach="material-0" color={top} />
        <meshBasicMaterial attach="material-1" color={mix(z.color, '#ffffff', 0.35)} />
      </mesh>
      <Line points={[...rim, rim[0]]} color={z.color} lineWidth={1.5} />
      <Text position={[-w / 2 + 0.45, y0 + FLOOR + 0.004, d / 2 - 0.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={size} letterSpacing={0.06}
        anchorX="left" anchorY="bottom" color={mix(z.color, '#000000', 0.35)} fillOpacity={0.8} fontWeight={800}>{z.label.toUpperCase()}</Text>
    </group>
  )
}

// ---- icons, one per shape; each knows the height of its top
const ICON_TOP: Record<Shape, number> = { rect: 1.13, round: 0.62, cylinder: 0.84, diamond: 0.95 }
function Lit({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
}
function Inked({ geo, color, at, rot }: { geo: React.ReactNode; color: string; at: [number, number, number]; rot?: [number, number, number] }) {
  return <mesh position={at} rotation={rot}>{geo}<Lit color={color} /><Edges color={INK} threshold={20} lineWidth={1.4} /></mesh>
}
function Icon({ n }: { n: Node }) {
  const c = SHAPE[n.shape]
  let body: React.ReactNode
  if (n.shape === 'rect') { // server: a cube with two drive bands, status dots, a coloured stripe on top
    body = <>
      <Inked geo={<boxGeometry args={[1, 1.1, 1]} />} color={SIDE} at={[0, 0.55, 0]} />
      {[0.37, 0.73].map(h => <Line key={h} points={[[-0.501, h, 0.501], [0.501, h, 0.501], [0.501, h, -0.501]]} color={INK} lineWidth={1.2} />)}
      {[0.18, 0.55, 0.92].map(h => <mesh key={h} position={[-0.3, h, 0.505]}><circleGeometry args={[0.055, 16]} /><meshBasicMaterial color={c} /></mesh>)}
      <Inked geo={<boxGeometry args={[0.7, 0.03, 0.14]} />} color={c} at={[0, 1.115, 0]} />
    </>
  } else if (n.shape === 'round') { // service: a hex puck in the shape's colour with a light cap
    body = <>
      <Inked geo={<cylinderGeometry args={[0.62, 0.62, 0.42, 6]} />} color={c} at={[0, 0.21, 0]} />
      <Inked geo={<cylinderGeometry args={[0.3, 0.3, 0.2, 6]} />} color={SIDE} at={[0, 0.52, 0]} />
    </>
  } else if (n.shape === 'cylinder') { // storage: three stacked discs, the top one tinted
    body = <>{[0, 1, 2].map(k => <Inked key={k} geo={<cylinderGeometry args={[0.55, 0.55, 0.24, 32]} />} color={k === 2 ? mix(c, '#ffffff', 0.2) : SIDE} at={[0, k * 0.3 + 0.12, 0]} />)}</>
  } else { // decision: a low plinth and a pyramid
    body = <>
      <Inked geo={<boxGeometry args={[0.99, 0.16, 0.99]} />} color={SIDE} at={[0, 0.08, 0]} rot={[0, Math.PI / 4, 0]} />
      <Inked geo={<coneGeometry args={[0.5, 0.79, 4]} />} color={c} at={[0, 0.555, 0]} />
    </>
  }
  return <group position={[n.x, n.level * FLOOR, n.z]}>{body}</group>
}

// ---- the callout card, on a dotted leader from the icon's top
function Card({ n, mode }: { n: Node; mode: Mode }) {
  const top = n.level * FLOOR + ICON_TOP[n.shape] + 0.03
  const flat = mode === 'flat'
  const at: [number, number, number] = flat ? [n.x, top + 0.1, n.z - 1.3] : [n.x, top + 1.1, n.z]
  const w = Math.max(n.label.length * 0.2, (n.sub ?? '').length * 0.17) + 0.5, h = n.sub ? 0.95 : 0.6
  return (
    <>
      <Line points={[[n.x, top, n.z], flat ? [n.x, top + 0.1, n.z - 1.3 + h / 2] : [n.x, top + 1.1, n.z]]} color="#333333" lineWidth={1.4} dashed dashSize={0.06} gapSize={0.1} />
      <mesh position={[n.x, top, n.z]}><sphereGeometry args={[0.05, 12, 8]} /><meshBasicMaterial color="#333333" /></mesh>
      <Billboard position={at}>
        <group position={[0, flat ? 0 : h / 2, 0]}>
          <mesh renderOrder={10}><planeGeometry args={[w + 0.04, h + 0.04]} /><meshBasicMaterial color="#cfd4dd" depthTest={false} /></mesh>
          <mesh renderOrder={11}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#ffffff" depthTest={false} /></mesh>
          <Text renderOrder={12} material-depthTest={false} position={[-w / 2 + 0.25, n.sub ? 0.16 : 0, 0.01]} anchorX="left" anchorY="middle" fontSize={0.33} fontWeight={700} color="#1f2330">{n.label}</Text>
          {n.sub && <Text renderOrder={12} material-depthTest={false} position={[-w / 2 + 0.25, -0.22, 0.01]} anchorX="left" anchorY="middle" fontSize={0.26} color="#6b7280">{n.sub}</Text>}
        </group>
      </Billboard>
    </>
  )
}

// ---- links: navy on the floor, one flat arrow partway along the longest run, the label as a pill
function Pill({ at, text, color }: { at: [number, number, number]; text: string; color: string }) {
  const w = text.length * 0.18 + 0.4
  return (
    <Billboard position={at}>
      <mesh renderOrder={10}><planeGeometry args={[w + 0.05, 0.5]} /><meshBasicMaterial color={color} depthTest={false} /></mesh>
      <mesh renderOrder={11}><planeGeometry args={[w, 0.45]} /><meshBasicMaterial color="#ffffff" depthTest={false} /></mesh>
      <Text renderOrder={12} material-depthTest={false} position={[0, 0, 0.01]} fontSize={0.27} color="#333333" anchorX="center" anchorY="middle">{text}</Text>
    </Billboard>
  )
}
const ARROW = (() => { const s = new THREE.Shape(); s.moveTo(0.32, 0); s.lineTo(-0.32, 0.26); s.lineTo(-0.13, 0); s.lineTo(-0.32, -0.26); s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2) })()
function FloorLink({ l, y }: { l: Link; y: number }) {
  const color = l.color ?? NAVY
  let best = 0, bi = 1
  l.pts.forEach((p, i) => { if (i) { const d = Math.hypot(p[0] - l.pts[i - 1][0], p[1] - l.pts[i - 1][1]); if (d > best) { best = d; bi = i } } })
  const a = l.pts[bi - 1], b = l.pts[bi], m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  const lifeline = l.dashed && !l.label
  return (
    <>
      <Line points={l.pts.map(([x, z]) => [x, y, z] as [number, number, number])} color={color} lineWidth={lifeline ? 1.5 : 3.2} dashed={l.dashed} dashSize={0.25} gapSize={0.18} />
      {!lifeline && <mesh geometry={ARROW} position={[m[0], y + 0.003, m[1]]} rotation={[0, ang, 0]}><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>}
      {l.label && <Pill at={[m[0], y + 0.3, m[1] - (Math.abs(b[0] - a[0]) > 0.1 ? 0.5 : 0)]} text={l.label} color={color} />}
    </>
  )
}

// ---- dotted links: a dashed arc overhead, peak a quarter of its span, a cone at its target
function ArcLink({ a, b, label }: { a: Node; b: Node; label?: string }) {
  const ya = a.level * FLOOR + ICON_TOP[a.shape], yb = b.level * FLOOR + ICON_TOP[b.shape]
  const pts = useMemo(() => {
    const L = Math.hypot(b.x - a.x, b.z - a.z), h = L / 4
    return Array.from({ length: 49 }, (_, i) => { const t = i / 48; return new THREE.Vector3(a.x + (b.x - a.x) * t, ya + (yb - ya) * t + 4 * h * t * (1 - t), a.z + (b.z - a.z) * t) })
  }, [a, b, ya, yb])
  const end = pts[pts.length - 1], dir = end.clone().sub(pts[pts.length - 3]).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  return (
    <>
      <Line points={pts.slice(0, -2)} color={FAR} lineWidth={2.6} dashed dashSize={0.3} gapSize={0.24} />
      <mesh position={end.clone().addScaledVector(dir, -0.2)} quaternion={q}><coneGeometry args={[0.14, 0.4, 16]} /><meshBasicMaterial color={FAR} /></mesh>
      {label && <Pill at={pts[24].toArray() as [number, number, number]} text={label} color={FAR} />}
    </>
  )
}

// ---- the scene and its camera at one of Bonkei's three views (drag turns it, scroll zooms)
function View({ mode, box }: { mode: Mode; box: { cx: number; cz: number; X: number; Z: number } }) {
  const { camera, size: px } = useThree()
  useEffect(() => {
    const p = PRESET[mode], cam = camera as THREE.PerspectiveCamera, aspect = px.width / px.height
    const wide = Math.abs(Math.cos(p.yaw)) * box.X + Math.abs(Math.sin(p.yaw)) * box.Z
    const deep = (Math.abs(Math.sin(p.yaw)) * box.X + Math.abs(Math.cos(p.yaw)) * box.Z) * Math.sin(p.pitch) + 2
    const span = Math.max(deep, wide / aspect) * (mode === '3d' ? 1.3 : 1.15)
    const dist = span / 2 / Math.tan((p.fov * Math.PI) / 360)
    cam.fov = p.fov; cam.near = dist / 50; cam.far = dist * 50
    cam.position.set(box.cx + Math.sin(p.yaw) * Math.cos(p.pitch) * dist, Math.sin(p.pitch) * dist, box.cz + Math.cos(p.yaw) * Math.cos(p.pitch) * dist)
    cam.lookAt(box.cx, 0, box.cz); cam.updateProjectionMatrix()
  }, [mode, box, camera, px.width, px.height])
  return <OrbitControls makeDefault target={[box.cx, 0, box.cz]} />
}

function Scene({ d, mode, showSource = true }: { d: Diagram; mode: Mode; showSource?: boolean }) {
  const by = Object.fromEntries(d.nodes.map(n => [n.id, n]))
  const box = useMemo(() => {
    const xs = d.zones.flatMap(z => [z.x0, z.x1]), zs = d.zones.flatMap(z => [z.z0, z.z1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs)
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, X: x1 - x0, Z: z1 - z0 }
  }, [d])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: BG }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 45, position: [0, 30, 30] }} gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}>
        <color attach="background" args={[BG]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[-8, 14, 10]} intensity={1.6} />
        <gridHelper args={[60, 60, GRID, GRID]} position={[box.cx, -0.005, box.cz]} />
        {d.zones.map(z => <Floor key={z.label} z={z} />)}
        {d.links.map((l, i) => <FloorLink key={i} l={l} y={FLOOR + 0.02} />)}
        {d.nodes.map(n => <Icon key={n.id} n={n} />)}
        {d.arcs.map(a => <ArcLink key={a.from + a.to} a={by[a.from]} b={by[a.to]} label={a.label} />)}
        {d.nodes.map(n => <Card key={n.id} n={n} mode={mode} />)}
        <View mode={mode} box={box} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 12, font: '12px system-ui', color: '#6b7280', pointerEvents: 'none' }}>{mode} · mockup, made-up data · drag to turn</div>
      {showSource && <details style={{ position: 'absolute', right: 12, bottom: 12, background: '#fff', border: '1px solid #d9dde5', borderRadius: 8, font: '12px system-ui', color: '#333' }}><summary style={{ padding: '6px 10px', cursor: 'pointer' }}>The source, as written</summary><pre style={{ margin: 0, padding: '10px 12px', maxHeight: '60%', overflow: 'auto', background: '#fff', border: '1px solid #d9dde5', borderRadius: 8, font: '11px/1.45 ui-monospace, monospace', color: '#333' }}>{d.source}</pre></details>}
    </div>
  )
}

type Args = { mode: Mode }
const meta: Meta<Args> = {
  title: 'Mockups/Cloud Cartography',
  parameters: { layout: 'fullscreen' },
  args: { mode: 'iso' },
  argTypes: { mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] } },
}
export default meta
type Story = StoryObj<Args>
const one = (d: Diagram, mode: Mode): Story => ({ args: { mode }, render: ({ mode }) => <div style={{ height: '100vh' }}><Scene d={d} mode={mode} /></div> })

/** The flowchart: three top-level zones, a nested one, all four icons, two dotted links as arcs, subtitles from <br>. */
export const FlowIso = one(FLOW, 'iso')
export const FlowFlat = one(FLOW, 'flat')
export const Flow3D = one(FLOW, '3d')
/** A sequence diagram: participants as icons on one floor, lifelines and messages on the ground. */
export const SequenceIso = one(SEQ, 'iso')
export const Sequence3D = one(SEQ, '3d')
export const SequenceFlat = one(SEQ, 'flat')
/** The flowchart in the three views side by side. */
export const ThreeViews: StoryObj = {
  render: () => (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, background: '#cfd4dd' }}>
      {(['flat', 'iso', '3d'] as Mode[]).map(m => <Scene key={m} d={FLOW} mode={m} showSource={false} />)}
    </div>
  ),
}

// MOCKUP (BON-248): the Lazers theme, from sketches/lazers.html. MADE-UP SAMPLE DATA.
// Two halves:
// - Mockups/Lazers/Today's settings: the real renderer with a Theme made from today's tokens only (dark ground, red lines, a red trench
//   light). It has no mirrors, devices or beam halo: those need drawing code.
// - Mockups/Lazers/Pieces: the new drawing, built in three.js as the build would (no bloom, no scene light): beams as a core line in
//   layered halos, a solid mirror on every bend (flat turns, steps onto the tray, bridges and tunnels), a splitter where two beams part,
//   and nodes as devices worked out from their edges. Colouring: one colour, or by source (each beam the colour of the device it left). Routes are hand-placed here; the build takes them from the router.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls, Text } from '@react-three/drei'
import { BONKEI, CLASSIC, Bonkei, type Mode, type Theme } from 'bonkei'
import { SAMPLES } from './samples'

const meta: Meta = { title: 'Mockups/Lazers', parameters: { layout: 'fullscreen' } }
export default meta

const GROUND = '#05070c'
const PALETTES = {
  red: { core: '#fff0f0', beam: '#ff3b3b', halo: '#ff2020' },
  green: { core: '#f0fff2', beam: '#39ff6a', halo: '#18e04c' },
  blue: { core: '#eef7ff', beam: '#3fa9ff', halo: '#1f7dff' },
  violet: { core: '#fbf0ff', beam: '#c25bff', halo: '#9a2cff' },
} as const
type Palette = keyof typeof PALETTES
type Pal = { core: string; beam: string; halo: string }
// By source: each device that sends beams gets its own laser colour, and every beam it fires is that colour, so a beam can be traced to
// the device it left. A relay fires in its own colour, not the colour it caught.
const SOURCES: Pal[] = [
  PALETTES.red, PALETTES.green, PALETTES.blue,
  { core: '#fff8e6', beam: '#ffb020', halo: '#ff9000' }, PALETTES.violet, { core: '#effeff', beam: '#2ff0ff', halo: '#00c8f0' },
]
type Colouring = 'one colour' | 'by source' | 'from the text'
// From the text: the author gives a node its colour in the Mermaid source, the Mermaid way (a style line, or a classDef and class), and
// every beam out of that node is that colour. A node with no colour gets the next automatic one, as in by source.
const SOURCE_TEXT = `flowchart LR
  Client --> Gateway
  Gateway --> Auth & Orders & DB
  Metrics --> Orders
  Orders --> DB --> Logs
  style Client fill:#ff3b3b
  classDef cool fill:#2ff0ff
  class Metrics cool
  style DB fill:#ffb020`
// the colours the text gives: style <id> fill:<colour>, and class <ids> <name> with classDef <name> fill:<colour>
function textColours(src: string): Record<string, string> {
  const defs: Record<string, string> = {}, out: Record<string, string> = {}
  for (const m of src.matchAll(/^\s*classDef\s+(\w+)\s+.*?fill:\s*(#[0-9a-f]{3,6})/gim)) defs[m[1]] = m[2]
  for (const m of src.matchAll(/^\s*class\s+([\w,]+)\s+(\w+)/gim)) for (const id of m[1].split(',')) if (defs[m[2]]) out[id] = defs[m[2]]
  for (const m of src.matchAll(/^\s*style\s+(\w+)\s+.*?fill:\s*(#[0-9a-f]{3,6})/gim)) out[m[1]] = m[2]
  return out
}
const palOf = (hex: string): Pal => ({ beam: hex, halo: hex, core: '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.85).getHexString() })

// ---------- today's settings, in the real renderer ----------
const lazersToday = (p: Palette): Theme => {
  const c = PALETTES[p]
  return {
    ...CLASSIC,
    name: 'lazers',
    ground: { bg: GROUND, grid: ['#151c2b', '#0d1220'], major: 0, majorColor: '#151c2b', grain: 0, lit: true },
    light: { ...CLASSIC.light, ambient: 0.35, sky: '#9fb2d6', floor: '#0a0e16', hemi: 0.35, sun: 1.1 },
    node: {
      ...CLASSIC.node,
      colors: { rect: '#2f3a52', round: '#33405a', cylinder: '#2b354b', diamond: '#364462' },
      outline: '#3a4866', outlineWidth: 1.2, bevel: 0.02, hover: c.beam, hoverIntensity: 0.25,
    },
    tray: { ...CLASSIC.tray, colors: ['#0e1422', '#111829', '#141c30'], outline: '#2a3550', hover: c.beam, hoverIntensity: 0.12 },
    label: { ...CLASSIC.label, node: { ...CLASSIC.label.node, text: '#e9eefb' }, tray: { ...CLASSIC.label.tray, text: '#7f8aa3' } },
    ink: BONKEI.ink,
    edge: {
      ...CLASSIC.edge, color: c.beam, width: 2.5, label: '#e9eefb', labelOutline: GROUND, portal: c.beam, rim: 'none',
      glow: { core: c.core, coreWidth: 3.5, halo: c.halo, haloWidth: 11, haloOpacity: 0.28, wash: c.halo, washIntensity: 0.3 },
    },
    seq: { lifeline: '#3a4866', activation: c.beam, note: '#141c30', noteText: '#e9eefb', blockText: '#e9eefb', blockSub: '#9aa6c0', cross: c.beam, crossLine: c.beam },
  }
}
const stage: Decorator = Story => <div style={{ height: '100vh', background: GROUND }}><Story /></div>
type TodayArgs = { palette: Palette }
const today = (mode: Mode, source = SAMPLES['flow: large (~50 nodes)']): StoryObj<TodayArgs> => ({
  args: { palette: 'red' },
  argTypes: { palette: { control: 'inline-radio', options: Object.keys(PALETTES) } },
  decorators: [stage],
  render: ({ palette }) => <Bonkei source={source} theme={lazersToday(palette)} mode={mode} toolbar />,
})
export const TodayFlowFlat = { ...today('flat'), name: "Today's settings / Flow flat" }
export const TodayFlowIso = { ...today('iso'), name: "Today's settings / Flow iso" }
export const TodayFlow3D = { ...today('3d'), name: "Today's settings / Flow 3D" }
export const TodaySequence = { ...today('iso', SAMPLES['seq: login flow']), name: "Today's settings / Sequence iso" }

// ---------- the new pieces ----------
type V3 = [number, number, number] // x, y (up), z
const TRAY = { x0: 4, z0: -0.8, x1: 12, z1: 7.8, t: 0.25 }
const NODE_H = 0.5, W = 1.6, D = 1
const G = 0.25, T = TRAY.t + 0.25
const NODES = [
  { id: 'Client', x: 0, z: 0, tray: false }, { id: 'Gateway', x: 6, z: 1, tray: true }, { id: 'Auth', x: 6, z: 5, tray: true },
  { id: 'Orders', x: 10, z: 1, tray: true }, { id: 'DB', x: 10, z: 5, tray: true }, { id: 'Metrics', x: 14.6, z: 1, tray: false },
  { id: 'Logs', x: 14.6, z: 7, tray: false }, { id: 'Cron', x: 0, z: 6, tray: false },
]
const p = (x: number, z: number, y: number): V3 => [x, y, z]
const EDGES: { from: string; to: string; pts: V3[] }[] = [
  { from: 'Client', to: 'Gateway', pts: [p(0.8, 0, G), p(2, 0, G), p(2, 1, G), p(3.5, 1, G), p(3.5, 1, T), p(5.2, 1, T)] },
  { from: 'Gateway', to: 'Auth', pts: [p(6, 1.5, T), p(6, 4.5, T)] },
  { from: 'Gateway', to: 'Orders', pts: [p(6.8, 1, T), p(9.2, 1, T)] },
  { from: 'Gateway', to: 'DB', pts: [p(6.8, 1, T), p(8, 1, T), p(8, 5, T), p(9.2, 5, T)] },
  { from: 'Orders', to: 'DB', pts: [p(10, 1.5, T), p(10, 4.5, T)] },
  { from: 'Metrics', to: 'Orders', pts: [p(13.8, 1, G), p(12.5, 1, G), p(12.5, 1, T), p(10.8, 1, T)] },
  { from: 'DB', to: 'Logs', pts: [p(10.8, 5, T), p(11.4, 5, T), p(11.4, 7, T), p(12.5, 7, T), p(12.5, 7, G), p(13.8, 7, G)] },
]
// the crossings, beside the diagram: a bridge and a tunnel over / under a beam along x
const BRIDGE_UNDER: V3[] = [p(17, 2, G), p(21, 2, G)]
const BRIDGE: V3[] = [p(19, 0, G), p(19, 1.5, G), p(19, 1.5, G + 0.6), p(19, 2.5, G + 0.6), p(19, 2.5, G), p(19, 4, G)]
const TUNNEL_UNDER: V3[] = [p(17, 7, G), p(21, 7, G)]
const TUNNEL: V3[] = [p(19, 5, G), p(19, 6.5, G), p(19, 6.5, -0.22), p(19, 7.5, -0.22), p(19, 7.5, G), p(19, 9, G)]

const role = (id: string) => {
  const o = EDGES.some(e => e.from === id), i = EDGES.some(e => e.to === id)
  return o && i ? 'relay' : o ? 'emitter' : i ? 'detector' : 'idle'
}
const v = (a: V3) => new THREE.Vector3(...a)

function Beam({ pts, c }: { pts: V3[]; c: Pal }) {
  return (
    <>
      <Line points={pts} color={c.halo} lineWidth={14} transparent opacity={0.12} depthWrite={false} />
      <Line points={pts} color={c.halo} lineWidth={6} transparent opacity={0.3} depthWrite={false} />
      <Line points={pts} color={c.beam} lineWidth={2.6} />
      <Line points={pts} color={c.core} lineWidth={1} />
    </>
  )
}

// A solid plate on a bend: its face normal is (out - in), it spans (in + out) and the hinge (in x out). Silver where the beam bounces.
function Mirror({ at, a, b, c }: { at: V3; a: THREE.Vector3; b: THREE.Vector3; c: Pal }) {
  const q = useMemo(() => {
    const u = a.clone().add(b).normalize(), w = a.clone().cross(b).normalize(), n = b.clone().sub(a).normalize()
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n))
  }, [a, b])
  const upright = Math.abs(a.clone().cross(b).normalize().y) > 0.9
  return (
    <group position={at}>
      <group quaternion={q}>
        <mesh position={[0, 0, -0.04]}><boxGeometry args={[0.4, 0.32, 0.08]} /><meshStandardMaterial color="#3a4560" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.002]}><planeGeometry args={[0.38, 0.3]} /><meshStandardMaterial color="#dbe9ff" metalness={1} roughness={0.08} emissive="#9fb8e0" emissiveIntensity={0.35} /></mesh>
      </group>
      {upright && <mesh position={[0, -0.28, 0]}><cylinderGeometry args={[0.025, 0.04, 0.24, 8]} /><meshStandardMaterial color="#55607a" /></mesh>}
      <mesh><sphereGeometry args={[0.05, 12, 12]} /><meshBasicMaterial color={c.core} /></mesh>
      <mesh><sphereGeometry args={[0.12, 12, 12]} /><meshBasicMaterial color={c.halo} transparent opacity={0.3} depthWrite={false} /></mesh>
    </group>
  )
}

function Splitter({ at }: { at: V3 }) {
  return (
    <mesh position={at}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshPhysicalMaterial color="#a0dcff" transparent opacity={0.3} roughness={0.05} metalness={0.1} depthWrite={false} />
    </mesh>
  )
}

const onSeg = (q: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a), t = q.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)
  return t >= 0 && t <= 1 && a.clone().addScaledVector(ab, t).distanceTo(q) < 1e-6
}
// every bend of every beam: a mirror, or a splitter where another beam runs through the same point
function Bends({ lines, cs }: { lines: V3[][]; cs: Pal[] }) {
  const out: React.ReactNode[] = []
  lines.forEach((pts, li) => {
    for (let i = 1; i < pts.length - 1; i++) {
      const a = v(pts[i]).sub(v(pts[i - 1])).normalize(), b = v(pts[i + 1]).sub(v(pts[i])).normalize()
      if (a.distanceTo(b) < 1e-6) continue
      const shared = lines.some((o, oi) => oi !== li && o.slice(1).some((q, k) => onSeg(v(pts[i]), v(o[k]), v(q))))
      out.push(shared ? <Splitter key={`${li}-${i}`} at={pts[i]} /> : <Mirror key={`${li}-${i}`} at={pts[i]} a={a} b={b} c={cs[li]} />)
    }
  })
  return <>{out}</>
}

// A device: a dark metal box; a lens barrel where each beam leaves, a lit target where each lands, a status light lit when it receives.
function Device({ n, c }: { n: (typeof NODES)[number]; c: Pal }) { // c: the colour of the first beam it catches
  const r = role(n.id), y0 = n.tray ? TRAY.t : 0, idle = r === 'idle', lit = r === 'detector' || r === 'relay'
  return (
    <group>
      <mesh position={[n.x, y0 + NODE_H / 2, n.z]}>
        <boxGeometry args={[W, NODE_H, D]} />
        <meshStandardMaterial color={idle ? '#1a2130' : '#2f3a52'} emissive={idle ? '#000000' : '#0f1626'} metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[n.x + W / 2 - 0.25, y0 + NODE_H + 0.01, n.z - D / 2 + 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.08, 16]} /><meshBasicMaterial color={lit ? c.core : '#2a3245'} />
      </mesh>
      <Text position={[n.x, y0 + NODE_H + 0.02, n.z + 0.1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.26} color={idle ? '#5c667d' : '#e9eefb'}>{n.id}</Text>
    </group>
  )
}
function Barrel({ at, dir, c }: { at: V3; dir: THREE.Vector3; c: Pal }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), [dir])
  return (
    <group position={at} quaternion={q}>
      <mesh position={[0, -0.09, 0]}><cylinderGeometry args={[0.09, 0.09, 0.18, 16]} /><meshStandardMaterial color="#3a4560" metalness={0.6} /></mesh>
      <mesh position={[0, 0.001, 0]}><cylinderGeometry args={[0.06, 0.06, 0.01, 16]} /><meshBasicMaterial color={c.beam} /></mesh>
    </group>
  )
}
function Target({ at, dir, c }: { at: V3; dir: THREE.Vector3; c: Pal }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize().negate()), [dir])
  return (
    <group position={at} quaternion={q}>
      <mesh><ringGeometry args={[0.1, 0.14, 24]} /><meshBasicMaterial color={c.beam} side={THREE.DoubleSide} /></mesh>
      <mesh><circleGeometry args={[0.06, 16]} /><meshBasicMaterial color={c.core} side={THREE.DoubleSide} /></mesh>
      <mesh><circleGeometry args={[0.26, 24]} /><meshBasicMaterial color={c.halo} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

function Bench({ palette, colouring }: { palette: Palette; colouring: Colouring }) {
  const one = PALETTES[palette]
  const senders = NODES.filter(n => EDGES.some(e => e.from === n.id)).map(n => n.id)
  const given = colouring === 'from the text' ? textColours(SOURCE_TEXT) : {}
  const auto = senders.filter(id => !given[id]) // automatic colours go to the nodes the text leaves uncoloured, in order
  const of = (from: string) => (colouring === 'one colour' ? one : given[from] ? palOf(given[from]) : SOURCES[(colouring === 'from the text' ? auto.indexOf(from) + 1 : senders.indexOf(from)) % SOURCES.length])
  const all = [...EDGES.map(e => e.pts), BRIDGE_UNDER, BRIDGE, TUNNEL_UNDER, TUNNEL]
  const cs = [...EDGES.map(e => of(e.from)), ...(colouring === 'one colour' ? [one, one, one, one] : [SOURCES[0], SOURCES[1], SOURCES[2], SOURCES[3]])]
  const caught = (id: string) => { const e = EDGES.find(e => e.to === id); return e ? of(e.from) : one }
  return (
    <group position={[-10, 0, -4]}>
      <gridHelper args={[40, 80, '#151c2b', '#0d1220']} position={[10, 0, 4]} />
      {/* the tray: an optical breadboard */}
      <mesh position={[(TRAY.x0 + TRAY.x1) / 2, TRAY.t / 2, (TRAY.z0 + TRAY.z1) / 2]}>
        <boxGeometry args={[TRAY.x1 - TRAY.x0, TRAY.t, TRAY.z1 - TRAY.z0]} />
        <meshStandardMaterial color="#0e1422" metalness={0.4} roughness={0.6} />
      </mesh>
      <Text position={[TRAY.x0 + 0.9, TRAY.t + 0.01, TRAY.z0 + 0.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#7f8aa3">Platform</Text>
      {/* the tunnel's trench, open in the ground */}
      <mesh position={[19, -0.2, 7]}><boxGeometry args={[0.3, 0.4, 1.4]} /><meshStandardMaterial color="#03050a" side={THREE.BackSide} /></mesh>
      <Text position={[19, 0.01, -0.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#7f8aa3">Bridge</Text>
      <Text position={[19, 0.01, 9.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#7f8aa3">Tunnel</Text>
      {NODES.map(n => <Device key={n.id} n={n} c={caught(n.id)} />)}
      {all.map((pts, i) => <Beam key={i} pts={pts} c={cs[i]} />)}
      <Bends lines={all} cs={cs} />
      {EDGES.map((e, i) => {
        const n = e.pts.length
        return (
          <group key={i}>
            <Barrel at={e.pts[0]} dir={v(e.pts[1]).sub(v(e.pts[0]))} c={cs[i]} />
            <Target at={e.pts[n - 1]} dir={v(e.pts[n - 1]).sub(v(e.pts[n - 2]))} c={cs[i]} />
          </group>
        )
      })}
    </group>
  )
}

type PiecesArgs = { palette: Palette; colouring: Colouring }
const pieces = (view: 'flat' | 'iso' | '3d', colouring: Colouring = 'one colour'): StoryObj<PiecesArgs> => ({
  args: { palette: 'red', colouring },
  argTypes: { palette: { control: 'inline-radio', options: Object.keys(PALETTES) }, colouring: { control: 'inline-radio', options: ['one colour', 'by source', 'from the text'] } },
  decorators: [stage],
  render: ({ palette, colouring }) => (
    <div style={{ height: '100vh', position: 'relative' }}>
      <Canvas
        orthographic={view !== '3d'}
        camera={view === 'flat' ? { position: [0, 30, 0.001], zoom: 56 } : view === 'iso' ? { position: [20, 20, 20], zoom: 56 } : { position: [10, 9, 14], fov: 45 }}
        gl={{ antialias: true }}>
        <color attach="background" args={[GROUND]} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#9fb2d6', '#0a0e16', 0.6]} />
        <directionalLight position={[8, 14, 6]} intensity={1.2} />
        <Bench palette={palette} colouring={colouring} />
        <OrbitControls makeDefault enableRotate={view !== 'flat'} />
      </Canvas>
      {colouring === 'from the text' && (
        <pre style={{ position: 'absolute', top: 12, left: 12, margin: 0, padding: '10px 12px', background: 'rgba(13,18,32,.9)', color: '#c9d3e6', border: '1px solid #222c42', borderRadius: 6, font: '12px/1.5 ui-monospace, monospace' }}>{SOURCE_TEXT}</pre>
      )}
    </div>
  ),
})
export const PiecesFlat = { ...pieces('flat'), name: 'Pieces / Flat' }
export const PiecesIso = { ...pieces('iso'), name: 'Pieces / Iso' }
export const Pieces3D = { ...pieces('3d'), name: 'Pieces / 3D' }
export const PiecesBySourceIso = { ...pieces('iso', 'by source'), name: 'Pieces / By source, iso' }
export const PiecesBySource3D = { ...pieces('3d', 'by source'), name: 'Pieces / By source, 3D' }
export const PiecesFromTheText = { ...pieces('3d', 'from the text'), name: 'Pieces / Colours from the text, 3D' }

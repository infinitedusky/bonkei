// MOCKUP (BON-253, with a preview of BON-255): a 3D model as a stage, and meeples acting a sequence diagram out on it.
// The models are built from boxes here, standing in for a loaded glTF with the same named objects; the labels, toolbar,
// camera views, error card and strip are Bonkei's own look. Not the real renderer: for Storybook only.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createCamera, Label, Toolbar, ThemeProvider, themeByName, UI, S } from 'bonkei/internal'
import type { Camera, Mode, Theme } from 'bonkei/internal'

// ---- a made-up model: what GLTFLoader would hand back, top-level named objects with pieces inside ----
type Piece = { name?: string; x: number; z: number; w: number; d: number; h: number; y?: number; color: string; metal?: boolean; glow?: boolean }
export type Part = { name?: string; pieces: Piece[] }
export interface StageModel { file: string; floor: { w: number; d: number; color: string }; parts: Part[]; wires?: [number, number, number][][]; wall?: boolean }

const STEEL = '#b8c0c8', DARK = '#2b2f36'
export const KITCHEN: StageModel = {
  file: 'kitchen.glb', floor: { w: 11, d: 7.4, color: '#d9d2c3' }, wall: true,
  parts: [
    { name: 'grill', pieces: [
      { name: 'Cube.003', x: -4.2, z: -2.4, w: 3, d: 1.4, h: 0.9, color: STEEL, metal: true },
      { name: 'griddle', x: -4.2, z: -2.4, w: 2.8, d: 1.2, h: 0.06, y: 0.9, color: DARK, metal: true },
      { name: 'patty', x: -4.9, z: -2.5, w: 0.4, d: 0.4, h: 0.08, y: 0.96, color: '#6b3b22' },
      { name: 'patty.001', x: -4.3, z: -2.3, w: 0.4, d: 0.4, h: 0.08, y: 0.96, color: '#6b3b22' },
      { name: 'patty.002', x: -3.7, z: -2.5, w: 0.4, d: 0.4, h: 0.08, y: 0.96, color: '#6b3b22' },
      { name: 'hood', x: -4.2, z: -2.9, w: 3.2, d: 0.6, h: 0.3, y: 2.0, color: STEEL, metal: true },
    ] },
    { name: 'prep line', pieces: [
      { x: 0.2, z: -2.4, w: 3.6, d: 1.4, h: 0.9, color: STEEL, metal: true },
      { name: 'lettuce bin', x: -0.9, z: -2.4, w: 0.7, d: 0.8, h: 0.12, y: 0.9, color: '#5cae4a' },
      { name: 'tomato bin', x: -0.1, z: -2.4, w: 0.7, d: 0.8, h: 0.12, y: 0.9, color: '#d8463a' },
      { name: 'onion bin', x: 0.7, z: -2.4, w: 0.7, d: 0.8, h: 0.12, y: 0.9, color: '#e9e2d0' },
      { name: 'bun rack', x: 1.5, z: -2.4, w: 0.7, d: 0.8, h: 0.4, y: 0.9, color: '#e0b06a' },
    ] },
    { name: 'wrap station', pieces: [
      { x: 4.0, z: -0.4, w: 1.4, d: 2.6, h: 0.9, color: STEEL, metal: true },
      { name: 'paper', x: 4.0, z: -0.9, w: 1.0, d: 0.9, h: 0.04, y: 0.9, color: '#f3efe6' },
      { name: 'Cylinder', x: 4.0, z: 0.4, w: 1.0, d: 0.3, h: 0.3, y: 0.9, color: '#d7302c' },
    ] },
    { name: 'register', pieces: [
      { x: 1.0, z: 2.4, w: 3.2, d: 1.0, h: 1.05, color: '#d7302c' },
      { name: 'screen', x: 0.4, z: 2.4, w: 0.7, d: 0.1, h: 0.5, y: 1.05, color: DARK },
      { name: 'till', x: 1.4, z: 2.4, w: 0.6, d: 0.5, h: 0.2, y: 1.05, color: DARK },
    ] },
    // an object nobody named (a fridge): drawn, not a part
    { pieces: [{ x: -4.6, z: 1.6, w: 1.4, d: 1.4, h: 2.2, color: '#e6e8ea' }] },
  ],
}

// a house with a phone line out to the street, an exchange down the road, and a data centre
export const HOUSE: StageModel = {
  file: 'house.glb', floor: { w: 22, d: 9, color: '#9cc27a' },
  parts: [
    { name: 'phone', pieces: [
      { name: 'sofa', x: -9.3, z: 0.6, w: 1.6, d: 0.7, h: 0.5, color: '#7a5c9e' },
      { name: 'Screen.001', x: -9.3, z: 0.1, w: 0.25, d: 0.12, h: 0.42, y: 0.5, color: DARK, glow: true },
    ] },
    { name: 'router', pieces: [
      { name: 'shelf', x: -7.6, z: -1.2, w: 1, d: 0.5, h: 0.7, color: '#c89b6a' },
      { name: 'Box', x: -7.6, z: -1.2, w: 0.6, d: 0.35, h: 0.14, y: 0.7, color: '#f2f2f2', glow: true },
    ] },
    { name: 'telephone pole', pieces: [
      { name: 'Cylinder.002', x: -4.2, z: -2.6, w: 0.25, d: 0.25, h: 4.2, color: '#7a5434' },
      { name: 'crossarm', x: -4.2, z: -2.6, w: 1.4, d: 0.15, h: 0.15, y: 3.8, color: '#7a5434' },
    ] },
    { name: 'exchange', pieces: [
      { x: 1.5, z: -1.8, w: 3.4, d: 2.6, h: 2.2, color: '#c9b79c' },
      { name: 'Roof', x: 1.5, z: -1.8, w: 3.6, d: 2.8, h: 0.2, y: 2.2, color: '#6e6a64' },
      { name: 'door', x: 1.5, z: -0.48, w: 0.7, d: 0.06, h: 1.2, color: '#3b4c6b' },
    ] },
    { name: 'server', pieces: [
      { name: 'datacentre', x: 8, z: -1, w: 4.4, d: 3.6, h: 2.6, color: '#d6dbe2' },
      { name: 'rack', x: 7.2, z: 1.0, w: 0.7, d: 0.5, h: 1.8, color: DARK, glow: true },
      { name: 'rack.001', x: 8.2, z: 1.0, w: 0.7, d: 0.5, h: 1.8, color: DARK, glow: true },
    ] },
    // the house itself and the road: unnamed, so drawn and not parts
    { pieces: [
      { x: -8.4, z: -0.3, w: 4.2, d: 3.6, h: 0.08, color: '#e8dcc6' },
      { x: -8.4, z: -2.1, w: 4.2, d: 0.12, h: 2.3, color: '#f1ebe0' },
      { x: -10.5, z: -0.3, w: 0.12, d: 3.6, h: 2.3, color: '#f1ebe0' },
      { x: -6.3, z: -0.3, w: 0.12, d: 3.6, h: 2.3, color: '#f1ebe0' },
    ] },
    { pieces: [{ x: 0, z: 3.4, w: 22, d: 1.6, h: 0.03, color: '#4a4d52' }] },
  ],
  // the line: router → out through the wall → up the pole → across to the exchange → on to the data centre (a fibre run)
  wires: [[[-7.6, 0.84, -1.2], [-6.3, 1.9, -1.4], [-4.2, 3.85, -2.6], [-0.2, 2.1, -2.2], [1.5, 2.4, -1.8]], [[1.5, 2.4, -1.8], [4.5, 1.0, -1.0], [5.8, 1.2, -1.0], [7.2, 1.8, 1.0]]],
}

const topOf = (p: Part) => Math.max(...p.pieces.map(q => (q.y ?? 0) + q.h))
const centreOf = (p: Part) => {
  const xs = p.pieces.flatMap(q => [q.x - q.w / 2, q.x + q.w / 2]), zs = p.pieces.flatMap(q => [q.z - q.d / 2, q.z + q.d / 2])
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, w: Math.max(...xs) - Math.min(...xs) }
}
export const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ')

// ---- the script: a sequence diagram whose participants are meeples standing at stage parts ----
export interface Actor { name: string; color: string; at: [number, number] }
export interface Message { from: string; to: string; text: string; reply?: boolean }
export interface Script { kind: 'walk' | 'signal'; actors: Actor[]; messages: Message[]; source: string; /** signal: the path between two actors, along the wires */ path?: (from: string, to: string) => [number, number, number][] }

export const KITCHEN_SCRIPT: Script = {
  kind: 'walk',
  actors: [
    { name: 'Customer', color: '#5b8def', at: [1.0, 3.5] },
    { name: 'Cashier', color: '#d7302c', at: [1.0, 1.4] },
    { name: 'Cook', color: '#f2c14e', at: [-4.2, -1.2] },
    { name: 'Wrapper', color: '#3fbf9b', at: [2.9, -0.4] },
  ],
  messages: [
    { from: 'Customer', to: 'Cashier', text: 'Double-Double, animal style' },
    { from: 'Cashier', to: 'Cook', text: 'order 42' },
    { from: 'Cook', to: 'Wrapper', text: 'two patties' },
    { from: 'Wrapper', to: 'Cashier', text: 'burger 42', reply: true },
    { from: 'Cashier', to: 'Customer', text: 'here you go', reply: true },
  ],
  source: `---
config:
  bonkei:
    stage: kitchen.glb
---
sequenceDiagram
  participant Customer at register
  participant Cashier at register
  participant Cook at grill
  participant Wrapper at wrap station
  Customer->>Cashier: Double-Double, animal style
  Cashier->>Cook: order 42
  Cook->>Wrapper: two patties
  Wrapper-->>Cashier: burger 42
  Cashier-->>Customer: here you go`,
}

const LINE = HOUSE.wires!.flat()
const stop = { You: 0, Router: 0, ISP: 4, Server: 8 } as Record<string, number> // where each actor joins the line (index into LINE)
export const HOUSE_SCRIPT: Script = {
  kind: 'signal',
  actors: [
    { name: 'You', color: '#5b8def', at: [-9.3, 1.3] },
    { name: 'Router', color: '#f2c14e', at: [-7.6, -0.4] },
    { name: 'ISP', color: '#d96c8a', at: [1.5, 0.3] },
    { name: 'Server', color: '#3fbf9b', at: [7.7, 2.0] },
  ],
  messages: [
    { from: 'You', to: 'Router', text: 'GET bonkei.dev' },
    { from: 'Router', to: 'ISP', text: 'packets' },
    { from: 'ISP', to: 'Server', text: 'GET /' },
    { from: 'Server', to: 'ISP', text: '200 OK', reply: true },
    { from: 'ISP', to: 'Router', text: 'packets', reply: true },
    { from: 'Router', to: 'You', text: 'the page', reply: true },
  ],
  path: (from, to) => {
    const room: [number, number, number][] = [[-9.3, 0.95, 0.1], [-8.4, 1.6, -0.6], [-7.6, 0.84, -1.2]] // over the air, phone to router
    if (from === 'You') return room
    if (to === 'You') return [...room].reverse()
    const a = stop[from], b = stop[to]
    return a < b ? LINE.slice(a, b + 1) : LINE.slice(b, a + 1).reverse()
  },
  source: `---
config:
  bonkei:
    stage: house.glb
---
sequenceDiagram
  participant You at phone
  participant Router at router
  participant ISP at exchange
  participant Server at server
  You->>Router: GET bonkei.dev
  Router->>ISP: packets
  ISP->>Server: GET /
  Server-->>ISP: 200 OK
  ISP-->>Router: packets
  Router-->>You: the page`,
}

// ---- the camera: Bonkei's own camera object and its tween, as the scene's Rig runs it ----
function Rig({ cam }: { cam: Camera }) {
  useFrame(({ camera, size }, dt) => {
    cam.aspect = size.width / size.height
    const c = cam.cur, g = cam.goal, k = 1 - Math.exp(-6 * Math.min(dt, 0.1))
    for (const key of ['tx', 'tz', 'yaw', 'pitch'] as const) c[key] += (g[key] - c[key]) * k
    for (const key of ['H', 'fov'] as const) c[key] = Math.exp(Math.log(c[key]) + (Math.log(g[key]) - Math.log(c[key])) * k)
    const p = camera as THREE.PerspectiveCamera
    const d = c.H / 2 / Math.tan((c.fov * Math.PI) / 360)
    p.fov = c.fov; p.near = Math.max(0.1, d - 120); p.far = d + 120
    p.position.set(c.tx + d * Math.sin(c.yaw) * Math.cos(c.pitch), d * Math.sin(c.pitch), c.tz + d * Math.cos(c.yaw) * Math.cos(c.pitch))
    p.lookAt(c.tx, 0, c.tz); p.updateProjectionMatrix()
  })
  return null
}

// pan / orbit / zoom, roughly as the real controls do (drag pans; in 3D drag turns, Shift-drag pans; wheel zooms)
function Gestures({ cam }: { cam: Camera }) {
  const { gl } = useThree()
  useEffect(() => {
    const el = gl.domElement
    let last: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => { last = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => {
      if (!last) return
      const dx = e.clientX - last.x, dy = e.clientY - last.y
      last = { x: e.clientX, y: e.clientY }
      const g = cam.goal, c = cam.cur
      if (cam.mode === '3d' && !e.shiftKey) { g.yaw -= dx * 0.005; g.pitch = Math.min(1.5, Math.max(0.15, g.pitch + dy * 0.005)); return }
      const upp = c.H / el.clientHeight, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw)
      const mx = -dx * upp * cy + dy * upp * (-sy) / Math.sin(c.pitch), mz = dx * upp * sy + dy * upp * (-cy) / Math.sin(c.pitch)
      g.tx += mx; g.tz += mz; c.tx += mx; c.tz += mz
    }
    const up = () => { last = null }
    const wheel = (e: WheelEvent) => { e.preventDefault(); cam.goal.H = Math.min(200, Math.max(3, cam.goal.H * Math.exp(e.deltaY * 0.0015))) }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('wheel', wheel) }
  }, [gl, cam])
  return null
}

function Model({ model, labels, hit, dim }: { model: StageModel; labels: 'top' | 'billboard'; hit: string | null; dim: boolean }) {
  const { floor } = model
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow><planeGeometry args={[floor.w, floor.d]} /><meshStandardMaterial color={floor.color} /></mesh>
      {model.wall && <mesh position={[0, 1.4, -floor.d / 2 - 0.05]} receiveShadow castShadow><boxGeometry args={[floor.w, 2.8, 0.1]} /><meshStandardMaterial color="#ece6da" /></mesh>}
      {model.wires?.map((w, i) => <Line key={i} points={w} color="#1c1c1c" lineWidth={2} />)}
      {model.parts.map((p, i) => {
        const c = centreOf(p), lit = !!p.name && hit === norm(p.name)
        return (
          <group key={i}>
            {p.pieces.map((q, j) => (
              <mesh key={j} position={[q.x, (q.y ?? 0) + q.h / 2, q.z]} castShadow receiveShadow>
                <boxGeometry args={[q.w, q.h, q.d]} />
                <meshStandardMaterial color={q.color} metalness={q.metal ? 0.5 : 0} roughness={q.metal ? 0.35 : 0.7}
                  emissive={lit ? '#5b8def' : q.glow ? '#4fd1ff' : '#000'} emissiveIntensity={lit ? 0.35 : q.glow ? 0.25 : 0} />
              </mesh>
            ))}
            {p.name && <group position={[c.x, 0, c.z]}><Label text={p.name!} mode={labels} y={topOf(p) + 0.08} size={dim ? 0.3 : 0.36} maxWidth={Math.max(2, c.w)} role="tray" /></group>}
          </group>
        )
      })}
    </group>
  )
}

// a meeple: the board-game figure, extruded
const MEEPLE = (() => {
  const body = new THREE.Shape([[-0.12, 0.62], [-0.45, 0.55], [-0.5, 0.42], [-0.2, 0.38], [-0.36, 0], [-0.08, 0], [0, 0.16], [0.08, 0], [0.36, 0], [0.2, 0.38], [0.5, 0.42], [0.45, 0.55], [0.12, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)))
  const head = new THREE.Shape(); head.absarc(0, 0.76, 0.17, 0, Math.PI * 2, false)
  const g = new THREE.ExtrudeGeometry([body, head], { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 })
  g.translate(0, 0, -0.11)
  return g
})()

function Meeple({ actor, at, face }: { actor: Actor; at: THREE.Vector3; face?: number }) {
  return (
    <group position={at} rotation={[0, face ?? 0, 0]}>
      <mesh geometry={MEEPLE} scale={1.1} castShadow><meshStandardMaterial color={actor.color} roughness={0.5} /></mesh>
      <group rotation={[0, -(face ?? 0), 0]}><Label text={actor.name} mode="billboard" y={0.95} size={0.26} maxWidth={2} role="node" /></group>
    </group>
  )
}

const STEP = 2.6 // seconds a message takes
function Play({ script, onStep, playing }: { script: Script; onStep: (i: number) => void; playing: boolean }) {
  const home = useMemo(() => Object.fromEntries(script.actors.map(a => [a.name, new THREE.Vector3(a.at[0], 0, a.at[1])])), [script])
  const pos = useMemo(() => Object.fromEntries(script.actors.map(a => [a.name, home[a.name].clone()])), [script, home])
  const [, tick] = useState(0)
  const t = useRef(0), shown = useRef(-1)
  const token = useRef(new THREE.Vector3()), tokenOn = useRef(false), msg = useRef<Message | null>(null), face = useRef<Record<string, number>>({})
  const paths = useMemo(() => script.messages.map(m => {
    const pts = script.kind === 'signal' ? script.path!(m.from, m.to) : [[home[m.from].x, 0, home[m.from].z], [home[m.to].x, 0, home[m.to].z]]
    return new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.05)
  }), [script, home])
  useFrame((_, dt) => {
    if (playing) t.current += Math.min(dt, 0.1)
    const n = script.messages.length, i = Math.floor(t.current / STEP) % n, f = (t.current % STEP) / STEP
    if (i !== shown.current) { shown.current = i; onStep(i) }
    const m = script.messages[i]; msg.current = m
    for (const a of script.actors) pos[a.name].copy(home[a.name])
    if (script.kind === 'walk') {
      // the sender carries the message to the receiver, hands it over, and walks back
      const go = f < 0.45 ? f / 0.45 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4
      const e = go * go * (3 - 2 * go)
      paths[i].getPoint(Math.min(0.88, e * 0.88), pos[m.from])
      const d = new THREE.Vector3().subVectors(home[m.to], home[m.from])
      face.current = { [m.from]: Math.atan2(d.x, d.z) * (f < 0.6 ? 1 : -1) + (f < 0.6 ? 0 : Math.PI) }
      tokenOn.current = f < 0.6
      token.current.copy(pos[m.from]).add(new THREE.Vector3(0, 1.45, 0))
    } else {
      // a signal runs along the line; the actors stay at their places
      const g = Math.min(1, f / 0.75)
      tokenOn.current = f < 0.85
      paths[i].getPoint(g, token.current)
      face.current = {}
    }
    tick(x => (x + 1) % 1000)
  })
  const m = msg.current
  return (
    <group>
      {script.actors.map(a => <Meeple key={a.name} actor={a} at={pos[a.name]} face={face.current[a.name]} />)}
      {tokenOn.current && m && (
        <group position={token.current}>
          {script.kind === 'signal'
            ? <mesh><sphereGeometry args={[0.16, 16, 16]} /><meshStandardMaterial color={m.reply ? '#3fbf9b' : '#4fd1ff'} emissive={m.reply ? '#3fbf9b' : '#4fd1ff'} emissiveIntensity={1.4} /></mesh>
            : <mesh castShadow><boxGeometry args={[0.32, 0.18, 0.32]} /><meshStandardMaterial color="#f3efe6" /></mesh>}
          <Label text={m.text} mode="billboard" y={0.15} size={0.24} maxWidth={3} role="node" />
        </group>
      )}
    </group>
  )
}

function Lights({ th, cam, span }: { th: Theme; cam: Camera; span: number }) {
  const sun = useRef<THREE.DirectionalLight>(null!)
  const at = useRef(new THREE.Vector3(10, 18, 7))
  useFrame((_, dt) => {
    const to = cam.mode === 'flat' ? new THREE.Vector3(1.9, 21.7, 0) : new THREE.Vector3(10, 18, 7)
    at.current.lerp(to, 1 - Math.exp(-6 * Math.min(dt, 0.1))); sun.current?.position.copy(at.current)
  })
  const r = span / 2 + 2
  return (<>
    <ambientLight intensity={th.light.ambient} />
    <hemisphereLight args={[th.light.sky, th.light.floor, th.light.hemi]} />
    <directionalLight ref={sun} intensity={th.light.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} />
  </>)
}

export const panel: React.CSSProperties = { background: UI.panel, color: UI.text, border: `1px solid ${UI.border}`, borderRadius: 6, font: '13px system-ui, sans-serif' }

export interface StageMockProps { model?: StageModel; script?: Script; mode?: Mode; theme?: string; labels?: 'top' | 'billboard'; parts?: boolean; warning?: string }
export function StageMock({ model = KITCHEN, script, mode: start = 'iso', theme = 'classic', labels = 'top', parts = true, warning }: StageMockProps) {
  const th = themeByName(theme).theme
  const [cam] = useState(createCamera)
  const [mode, setMode] = useState<Mode>(start)
  const [q, setQ] = useState('')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const fitIt = () => cam.fit(model.floor.w / S, model.floor.d / S)
  const fit = () => { fitIt(); cam.square() }
  useMemo(() => { cam.setMode(start); fitIt(); cam.snap() }, [cam, start, model])
  useEffect(() => { cam.setMode(mode) }, [cam, mode])
  const named = model.parts.filter(p => p.name)
  const hit = q && named.some(p => norm(p.name!) === norm(q)) ? norm(q) : null
  const lines = script?.source.split('\n') ?? []
  const firstMsg = lines.findIndex(l => /->>|-->>/.test(l))
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: th.ground.bg }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 1, near: 1, far: 5000, position: [0, 100, 0] }} gl={{ antialias: true }}>
          <color attach="background" args={[th.ground.bg]} />
          <ThemeProvider theme={th}>
            <Rig cam={cam} /><Gestures cam={cam} /><Lights th={th} cam={cam} span={Math.max(model.floor.w, model.floor.d)} />
            <Model model={model} labels={labels} hit={hit} dim={!!script} />
            {script && <Play script={script} onStep={setStep} playing={playing} />}
          </ThemeProvider>
        </Canvas>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)' }}><Toolbar mode={mode} onPick={setMode} onFit={fit} /></div>
        {script && <div style={{ ...panel, position: 'absolute', left: 10, top: 10, padding: '4px 10px', fontSize: 12, color: '#f5c76a' }}>Preview of BON-255 · not in this task</div>}
        {warning && <div role="status" style={{ ...panel, position: 'absolute', left: 10, right: 10, bottom: 10, padding: '6px 10px', font: '12px ui-monospace, monospace' }}><span style={{ color: '#f5c76a' }}>Warning</span> · {warning}</div>}
      </div>
      {script ? (
        <aside style={{ ...panel, width: 340, borderRadius: 0, borderWidth: '0 0 0 1px', padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Script</span>
            <button onClick={() => setPlaying(p => !p)} style={{ ...panel, padding: '3px 10px', cursor: 'pointer' }}>{playing ? 'Pause' : 'Play'}</button>
          </div>
          <pre style={{ margin: 0, font: '12px/1.6 ui-monospace, monospace', whiteSpace: 'pre-wrap' }}>
            {lines.map((l, i) => <div key={i} style={{ background: i === firstMsg + step ? '#24345e' : 'transparent', color: i < firstMsg - 5 ? UI.muted : UI.text, padding: '0 4px', borderRadius: 3 }}>{l || ' '}</div>)}
          </pre>
          <div style={{ color: UI.muted, fontSize: 11, marginTop: 10 }}>"at" puts a participant at a stage part; its syntax is still to be settled in BON-255.</div>
        </aside>
      ) : parts && (
        <aside style={{ ...panel, width: 230, borderRadius: 0, borderWidth: '0 0 0 1px', padding: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Stage parts</div>
          <div style={{ color: UI.muted, fontSize: 12, marginBottom: 10 }}>{model.file} · what a script can point at</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a part… try Prep_Line" style={{ width: '100%', padding: '5px 8px', background: '#1a2030', color: UI.text, border: `1px solid ${UI.border}`, borderRadius: 5, marginBottom: 8 }} />
          {named.map(p => (
            <div key={p.name} style={{ padding: '5px 8px', borderRadius: 5, display: 'flex', justifyContent: 'space-between', background: hit === norm(p.name!) ? '#24345e' : 'transparent' }}>
              <span>{p.name}</span><span style={{ color: UI.muted, fontSize: 11 }}>{p.pieces.length > 1 ? `${p.pieces.length - 1} pieces` : ''}</span>
            </div>
          ))}
          <div style={{ color: UI.muted, fontSize: 11, marginTop: 10 }}>Objects without a name are drawn, not listed.</div>
        </aside>
      )}
    </div>
  )
}

// the real card and strip's look (Bonkei.tsx ErrorCard / ErrorStrip), over an empty stage
export function Problem({ title = "This diagram couldn't be drawn", message, strip = false }: { title?: string; message: string; strip?: boolean }) {
  const bg = themeByName('classic').theme.ground.bg
  if (strip) return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <StageMock parts={false} />
      <div role="status" style={{ ...panel, position: 'absolute', left: 10, right: 10, bottom: 10, padding: '6px 10px', font: '12px ui-monospace, monospace' }}><span style={{ color: UI.error }}>Not updated</span> · {message}</div>
    </div>
  )
  return (
    <div style={{ width: '100vw', height: '100vh', background: bg, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="alert" style={{ ...panel, padding: '14px 18px', maxWidth: 480 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ color: UI.error, font: '12px ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</div>
      </div>
    </div>
  )
}

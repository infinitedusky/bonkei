// MOCKUP (BON-253): a glTF kitchen as a stage. The kitchen here is built from boxes in the story, standing in for a loaded
// model with the same named objects; the labels, toolbar, camera views, error card and strip are Bonkei's own look.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createCamera, PRESET, Label, Toolbar, ThemeProvider, themeByName, UI, THEME_NAMES, S } from 'bonkei/internal'
import type { Camera, Mode, Theme } from 'bonkei/internal'

// ---- the made-up model: what GLTFLoader would hand back, top-level named objects with pieces inside ----
type Piece = { name?: string; x: number; z: number; w: number; d: number; h: number; y?: number; color: string; metal?: boolean }
type Part = { name?: string; pieces: Piece[] }
const STEEL = '#b8c0c8', DARK = '#2b2f36', WOOD = '#c89b6a'
const KITCHEN: Part[] = [
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
]
const FLOOR = { w: 11, d: 7.4 }
const topOf = (p: Part) => Math.max(...p.pieces.map(q => (q.y ?? 0) + q.h))
const centreOf = (p: Part) => {
  const xs = p.pieces.flatMap(q => [q.x - q.w / 2, q.x + q.w / 2]), zs = p.pieces.flatMap(q => [q.z - q.d / 2, q.z + q.d / 2])
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, w: Math.max(...xs) - Math.min(...xs) }
}
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ')

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

// pan / orbit / zoom, roughly as the real controls do (drag pans; in 3D drag turns; wheel zooms)
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

function Model({ labels, hit, flat }: { labels: 'top' | 'billboard'; hit: string | null; flat: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow><planeGeometry args={[FLOOR.w, FLOOR.d]} /><meshStandardMaterial color="#d9d2c3" /></mesh>
      <mesh position={[0, 1.4, -FLOOR.d / 2 - 0.05]} receiveShadow castShadow><boxGeometry args={[FLOOR.w, 2.8, 0.1]} /><meshStandardMaterial color="#ece6da" /></mesh>
      <mesh position={[0, 0.55, 3.0]} castShadow><boxGeometry args={[FLOOR.w, 0.05, 0.05]} /><meshStandardMaterial color={WOOD} /></mesh>
      {KITCHEN.map((p, i) => {
        const c = centreOf(p), lit = !!p.name && hit === norm(p.name)
        return (
          <group key={i}>
            {p.pieces.map((q, j) => (
              <mesh key={j} position={[q.x, (q.y ?? 0) + q.h / 2, q.z]} castShadow receiveShadow>
                <boxGeometry args={[q.w, q.h, q.d]} />
                <meshStandardMaterial color={q.color} metalness={q.metal ? 0.5 : 0} roughness={q.metal ? 0.35 : 0.7} emissive={lit ? '#5b8def' : '#000'} emissiveIntensity={lit ? 0.35 : 0} />
              </mesh>
            ))}
            {p.name && <group position={[c.x, 0, flat ? c.z : c.z]}><Label text={p.name} mode={labels} y={topOf(p) + 0.08} size={0.36} maxWidth={Math.max(2, c.w)} role="node" /></group>}
          </group>
        )
      })}
    </group>
  )
}

function Lights({ th, cam }: { th: Theme; cam: Camera }) {
  const sun = useRef<THREE.DirectionalLight>(null!)
  const at = useRef(new THREE.Vector3(10, 18, 7))
  useFrame((_, dt) => {
    const to = cam.mode === 'flat' ? new THREE.Vector3(1.9, 21.7, 0) : new THREE.Vector3(10, 18, 7)
    at.current.lerp(to, 1 - Math.exp(-6 * Math.min(dt, 0.1))); sun.current?.position.copy(at.current)
  })
  return (<>
    <ambientLight intensity={th.light.ambient} />
    <hemisphereLight args={[th.light.sky, th.light.floor, th.light.hemi]} />
    <directionalLight ref={sun} intensity={th.light.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
  </>)
}

const panel: React.CSSProperties = { background: UI.panel, color: UI.text, border: `1px solid ${UI.border}`, borderRadius: 6, font: '13px system-ui, sans-serif' }

function StageMock({ mode: start = 'iso', theme = 'classic', labels = 'top', parts = true, warning }: { mode?: Mode; theme?: string; labels?: 'top' | 'billboard'; parts?: boolean; warning?: string }) {
  const th = themeByName(theme).theme
  const [cam] = useState(createCamera)
  const [mode, setMode] = useState<Mode>(start)
  const [q, setQ] = useState('')
  const fit = () => { cam.fit(FLOOR.w / S, FLOOR.d / S); cam.square() }
  useMemo(() => { cam.setMode(start); cam.fit(FLOOR.w / S, FLOOR.d / S); cam.snap() }, [cam, start])
  useEffect(() => { cam.setMode(mode) }, [cam, mode])
  const named = KITCHEN.filter(p => p.name)
  const hit = q && named.some(p => norm(p.name!) === norm(q)) ? norm(q) : null
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: th.ground.bg }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 1, near: 1, far: 5000, position: [0, 100, 0] }} gl={{ antialias: true }}>
          <color attach="background" args={[th.ground.bg]} />
          <ThemeProvider theme={th}>
            <Rig cam={cam} /><Gestures cam={cam} /><Lights th={th} cam={cam} />
            <Model labels={labels} hit={hit} flat={mode === 'flat'} />
          </ThemeProvider>
        </Canvas>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)' }}><Toolbar mode={mode} onPick={setMode} onFit={fit} /></div>
        {warning && <div role="status" style={{ ...panel, position: 'absolute', left: 10, right: 10, bottom: 10, padding: '6px 10px', font: '12px ui-monospace, monospace' }}><span style={{ color: '#f5c76a' }}>Warning</span> · {warning}</div>}
      </div>
      {parts && (
        <aside style={{ ...panel, width: 230, borderRadius: 0, borderWidth: '0 0 0 1px', padding: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Stage parts</div>
          <div style={{ color: UI.muted, fontSize: 12, marginBottom: 10 }}>kitchen.glb · what a script can point at</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a part… try Prep_Line" style={{ width: '100%', padding: '5px 8px', background: '#1a2030', color: UI.text, border: `1px solid ${UI.border}`, borderRadius: 5, marginBottom: 8 }} />
          {named.map(p => (
            <div key={p.name} style={{ padding: '5px 8px', borderRadius: 5, display: 'flex', justifyContent: 'space-between', background: hit === norm(p.name!) ? '#24345e' : 'transparent' }}>
              <span>{p.name}</span><span style={{ color: UI.muted, fontSize: 11 }}>{p.pieces.length > 1 ? `${p.pieces.length - 1} pieces` : ''}</span>
            </div>
          ))}
          <div style={{ color: UI.muted, fontSize: 11, marginTop: 10 }}>1 object without a name is drawn, not listed.</div>
        </aside>
      )}
    </div>
  )
}

// the real card and strip's look (Bonkei.tsx ErrorCard / ErrorStrip), over an empty stage
function Problem({ title = "This diagram couldn't be drawn", message, strip = false }: { title?: string; message: string; strip?: boolean }) {
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

const meta: Meta<typeof StageMock> = {
  title: 'Mockups/Stage (BON-253)', component: StageMock, parameters: { layout: 'fullscreen' },
  argTypes: { mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] }, theme: { control: 'select', options: THEME_NAMES }, labels: { control: 'inline-radio', options: ['top', 'billboard'] } },
}
export default meta
type Story = StoryObj<typeof StageMock>

/** The kitchen stage in the playground: four named parts labelled, the grill's pieces and the unnamed fridge not. */
export const Kitchen: Story = { args: { mode: 'iso' } }
/** Flat: a floor plan. */
export const KitchenFlat: Story = { args: { mode: 'flat' } }
/** 3D: drag turns, Shift-drag pans, the wheel zooms. */
export const Kitchen3D: Story = { args: { mode: '3d', labels: 'billboard' } }
/** The same stage in a built-in theme: the labels take the theme's plates; the model keeps its own colours. */
export const KitchenBlueprint: Story = { args: { mode: 'iso', theme: 'blueprint' } }
/** An embed: no parts list, just the stage. */
export const KitchenEmbedded: Story = { args: { mode: 'iso', parts: false } }
/** Two parts named alike: both drawn, with a warning. */
export const DuplicateName: Story = { args: { mode: 'iso', warning: 'two parts are named "grill"; a script pointing at grill will use the first' } }

export const MissingFile: StoryObj = { render: () => <Problem message="line 4: the stage kichen.glb wasn't found (404)" /> }
export const NoNamedParts: StoryObj = { render: () => <Problem title="This stage has no named parts" message={'line 4: blob.glb loaded, but none of its top-level objects has a name.\nName them in your 3D tool (grill, register…) and export again.'} /> }
export const CouldNotFetch: StoryObj = { render: () => <Problem message="line 4: the stage example.com/kitchen.glb couldn't be fetched; the site may not allow other pages to load it (CORS)" /> }
export const Compressed: StoryObj = { render: () => <Problem message={'line 4: kitchen-draco.glb uses Draco compression, which Bonkei can\'t read yet.\nExport again with compression off.'} /> }
export const NotUpdated: StoryObj = { render: () => <Problem strip message="line 4: the stage kitchen2.glb wasn't found (404)" /> }

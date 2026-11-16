// Mockup for BON-85: edges in 3D. Made-up data (a payments flow), hand-placed, not laid out by ELK.
// Blocks and trays are core's own NodeBody and Tray; the lines are drawn here the way the renderer
// draws them (drei Line, width 2, cone tip), with a height per point.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as THREE from 'three'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls, OrthographicCamera, PerspectiveCamera, useFBO } from '@react-three/drei'
import { NodeBody, Tray, TRAY, NODE_H, S } from 'bonkei/internal'
import type { Box, Mode } from 'bonkei/internal'

type Crossing = 'today' | 'none' | 'bridge' | 'tunnel' | 'portal'
type P = [number, number, number] // x, z (plan, world units), height

const LINE = '#e8edf7'
const LINE_ON_WHITE = '#1f2633' // light lines vanish on a light ground
const PRESETS = { dark: '#0f1218', grey: '#a3a9b3', white: '#ffffff' }
// grid a shade off the ground; lines dark on a light ground, light on a dark one
const shade = (hex: string, dl: number) => {
  const c = new THREE.Color(hex), hsl = c.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace)
  return '#' + c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + dl)), THREE.SRGBColorSpace).getHexString()
}
const isLight = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace).l > 0.45
const LineColor = createContext(LINE)
const PORTAL = '#3fa7ff'
const TALL = 1.8 // Fraud Check's height, to show blocks of different heights
const box = (o: Partial<Box> & { r: [number, number, number, number] }): Box & { r: [number, number, number, number] } =>
  ({ id: o.label ?? 'n', label: 'Node', kind: 'node', shape: 'rect', x: 0, y: 0, w: (o.r[2] - o.r[0]) / S, h: (o.r[3] - o.r[1]) / S, level: 0, ...o })

// plan rects [x0, z0, x1, z1]
const trays = [
  box({ kind: 'group', label: 'Payments', r: [0, 0, 11, 6], level: 0 }),
  box({ kind: 'group', label: 'Risk', r: [5.5, 0.8, 9.5, 5.4], level: 1 }),
]
const nodes = [
  box({ label: 'Client', shape: 'round', r: [-6, 2.4, -4, 3.6] }),
  box({ label: 'Notifier', r: [3, -5, 5, -3.8] }),
  box({ label: 'Pay API', r: [1, 2.4, 3, 3.6], level: 1 }),
  { ...box({ label: 'Fraud Check', shape: 'diamond', r: [6.5, 1.5, 8.5, 2.7], level: 2 }), tall: TALL },
  box({ label: 'Review', r: [6.5, 3.8, 8.5, 5.0], level: 2 }),
  box({ label: 'Ledger', shape: 'cylinder', r: [13, 2.4, 15, 3.6] }),
  box({ label: 'Audit', r: [13, -2.6, 15, -1.4] }),
]

// Mid-heights: ground block .35, block on Payments .6, block on Risk .85, Fraud Check 1.4, Payments rim .125.
// One step per edge, straight to where it is headed: just outside the outermost tray edge crossed,
// or a short way (0.5) out from the higher end.
const B = 0.35
const edges: { id: string; today: number; pts: P[]; bridge?: P[]; tunnel?: P[]; slot?: { x0: number; x1: number; z: number }; portals?: { before: P[]; after: P[]; at: [number, number] } }[] = [
  { id: 'client-pay', today: TRAY, pts: [[-4, 3, .35], [-0.5, 3, .35], [-0.5, 3, .6], [1, 3, .6]] },
  { id: 'pay-fraud', today: 2 * TRAY, pts: [[3, 3, .6], [4.5, 3, .6], [4.5, 2.1, .6], [5, 2.1, .6], [5, 2.1, 1.4], [6.5, 2.1, 1.4]] },
  { id: 'fraud-review', today: 2 * TRAY, pts: [[7.5, 2.7, 1.4], [7.5, 3.2, 1.4], [7.5, 3.2, .85], [7.5, 3.8, .85]] },
  { id: 'fraud-ledger', today: 2 * TRAY, pts: [[8.5, 2.1, 1.4], [11.5, 2.1, 1.4], [11.5, 2.1, .35], [12.2, 2.1, .35], [12.2, 3, .35], [13, 3, .35]] },
  {
    id: 'client-audit', today: 0, pts: [[-5, 2.4, .35], [-5, -2, .35], [13, -2, .35]],
    bridge: [[-5, 2.4, .35], [-5, -2, .35], [3.7, -2, .35], [3.7, -2, .35 + B], [4.3, -2, .35 + B], [4.3, -2, .35], [13, -2, .35]],
    tunnel: [[-5, 2.4, .35], [-5, -2, .35], [3.6, -2, .35], [3.6, -2, -.25], [4.4, -2, -.25], [4.4, -2, .35], [13, -2, .35]], slot: { x0: 3.5, x1: 4.5, z: -2 },
    // the line meets each portal's face; the portal's back sits a little behind it, so the line's rounded end never shows from behind
    portals: { before: [[-5, 2.4, .35], [-5, -2, .35], [3.6, -2, .35]], after: [[4.4, -2, .35], [13, -2, .35]], at: [3.6, 4.4] },
  },
  { id: 'notifier-pay', today: TRAY, pts: [[4, -3.8, .35], [4, -1.2, .35], [2, -1.2, .35], [2, -0.5, .35], [2, -0.5, .6], [2, 2.4, .6]] },
  { id: 'ledger-payments', today: TRAY, pts: [[14, 3.6, .35], [14, 4.1, .35], [14, 4.1, .125], [14, 7.5, .125], [5.5, 7.5, .125], [5.5, 6, .125]] },
]

const UP = new THREE.Vector3(0, 1, 0)
const v3 = ([x, z, y]: P) => new THREE.Vector3(x, y, z)

// Edge shadows (to try the look): drei's Line is drawn in screen space and casts none, so each segment
// gets an invisible thin tube that only writes to the shadow map.
const EdgeShadows = createContext(false)
// Edge thickness, in world units. world: the line is that thick in the scene, so it and its shadow match at any zoom;
// screen: the renderer's way today, a fixed width in pixels (0.03 world = 1 px here), so it looks thinner as you zoom in.
const EdgeWidth = createContext({ w: 0.06, world: true })
const px = (w: number) => w / 0.03
const caster = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
function ShadowTubes({ v }: { v: THREE.Vector3[] }) {
  const { w } = useContext(EdgeWidth)
  if (!useContext(EdgeShadows)) return null
  return <>{v.slice(1).map((b, i) => {
    const a = v[i], len = a.distanceTo(b)
    if (len < 1e-6) return null
    return <mesh key={i} castShadow material={caster} position={a.clone().add(b).multiplyScalar(0.5)}
      quaternion={new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())}>
      <cylinderGeometry args={[w / 2, w / 2, len, 8]} />
    </mesh>
  })}</>
}

// Line's worldUnits only comes out right with a perspective camera. With the orthographic flat/iso camera
// a world unit is camera.zoom pixels, so the width is set in pixels from the zoom, every frame (zooming changes it).
function WLine({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const { w, world } = useContext(EdgeWidth)
  const camera = useThree(st => st.camera)
  const ref = useRef<any>(null)
  const ortho = (camera as THREE.OrthographicCamera).isOrthographicCamera
  useFrame(() => { if (world && ortho && ref.current) ref.current.material.linewidth = w * (camera as THREE.OrthographicCamera).zoom })
  if (world && !ortho) return <Line points={points} color={color} lineWidth={w} worldUnits />
  return <Line ref={ref} points={points} color={color} lineWidth={world ? w * (camera as THREE.OrthographicCamera).zoom : px(w)} />
}

function EdgeLine({ pts, arrow = true }: { pts: P[]; arrow?: boolean }) {
  const LINE = useContext(LineColor), { w } = useContext(EdgeWidth)
  const v = pts.map(v3)
  if (!arrow) return <><WLine points={v} color={LINE} /><ShadowTubes v={v} /></>
  const k = Math.max(0.75, w / 0.06) // the arrowhead grows with thick lines
  const n = v.length, dir = v[n - 1].clone().sub(v[n - 2]).normalize()
  const tip = v[n - 1].clone().addScaledVector(dir, -0.3 * k)
  return (
    <group>
      <WLine points={[...v.slice(0, n - 1), tip]} color={LINE} />
      <ShadowTubes v={[...v.slice(0, n - 1), tip]} />
      <mesh castShadow scale={k} position={tip.clone().addScaledVector(dir, 0.15 * k)} quaternion={new THREE.Quaternion().setFromUnitVectors(UP, dir)}>
        <coneGeometry args={[0.13, 0.35, 16]} />
        <meshBasicMaterial color={LINE} />
      </mesh>
    </group>
  )
}

// Tunnel: an open slot cut in the ground along the stretch that dips, so from above you still see the line
// running through it under the other one. The ground has a matching hole (see Ground); this is the trench.
const SLOT_W = 0.3, SLOT_D = 0.4, SLOT_R = SLOT_W / 2 // rounded ends: the radius is half the width
type SlotAt = { x0: number; x1: number; z: number }
// the slot's outline in plan, a stadium (straight sides, round ends), drawn in shape space (x, y = -z)
function stadium(sl: SlotAt, p: THREE.Path = new THREE.Path()) {
  const y = -sl.z, a = sl.x0 + SLOT_R, b = sl.x1 - SLOT_R
  p.moveTo(a, y - SLOT_R); p.lineTo(b, y - SLOT_R)
  p.absarc(b, y, SLOT_R, -Math.PI / 2, Math.PI / 2, false)
  p.lineTo(a, y + SLOT_R)
  p.absarc(a, y, SLOT_R, Math.PI / 2, Math.PI * 1.5, false)
  return p
}
// Tunnel: an open trough with rounded ends cut in the ground along the stretch that dips, outlined at its lip,
// so from any view you see the line go down into it, under the other one, and back up.
function Slot({ sl, color }: { sl: SlotAt; color: string }) {
  const wall = shade(color, -0.12), floor = shade(color, -0.2), rim = shade(color, -0.35)
  const shape = useMemo(() => { const sh = new THREE.Shape(); stadium(sl, sh); return sh }, [sl.x0, sl.x1, sl.z])
  const walls = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: SLOT_D, bevelEnabled: false, curveSegments: 16 }), [shape])
  const flat = useMemo(() => new THREE.ShapeGeometry(shape, 16), [shape])
  const outline = useMemo(() => shape.getPoints(16).map(p => new THREE.Vector3(p.x, 0.005, -p.y)), [shape])
  return (
    <>
      {/* extruded from the trough's floor up to the ground, caps hidden, so it reads as the trough's walls */}
      <mesh geometry={walls} rotation={[-Math.PI / 2, 0, 0]} position={[0, -SLOT_D, 0]} receiveShadow material={[new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: wall, side: THREE.DoubleSide })]} />
      <mesh geometry={flat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -SLOT_D, 0]} receiveShadow><meshStandardMaterial color={floor} /></mesh>
      <Line points={[...outline, outline[0]]} color={rim} lineWidth={1.5} />
    </>
  )
}
// the ground, with the slot cut out of it when a tunnel shows; the grid is masked out over the slot (stencil)
function Ground({ bg, grid, slot }: { bg: string; grid: string[]; slot?: SlotAt }) {
  const geo = useMemo(() => {
    const sh = new THREE.Shape(); sh.moveTo(-36, -41); sh.lineTo(44, -41); sh.lineTo(44, 39); sh.lineTo(-36, 39); sh.closePath()
    if (slot) sh.holes.push(stadium(slot))
    return new THREE.ShapeGeometry(sh, 16)
  }, [slot?.x0, slot?.x1, slot?.z])
  const mask = useMemo(() => slot ? new THREE.ShapeGeometry(stadium(slot, new THREE.Shape()) as THREE.Shape, 16) : null, [slot?.x0, slot?.x1, slot?.z])
  return (
    <>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial color={bg} roughness={1} /></mesh>
      {slot && mask && <>
        <Slot sl={slot} color={bg} />
        <mesh geometry={mask} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
          <meshBasicMaterial colorWrite={false} depthWrite={false} stencilWrite stencilRef={1} stencilFunc={THREE.AlwaysStencilFunc} stencilZPass={THREE.ReplaceStencilOp} />
        </mesh>
      </>}
      <gridHelper key={bg + !!slot} args={[80, 80, grid[0], grid[1]]} position={[4, 0.002, 1]} renderOrder={1}
        material-stencilWrite={!!slot} material-stencilRef={1} material-stencilFunc={THREE.NotEqualStencilFunc} />
    </>
  )
}

// Portals as in the game, one colour: looking into either mouth you see out of the other one.
// Each mouth shows the scene rendered from the camera shifted by the gap, clipped at the far portal's plane.
// (Both sit on one straight line facing apart, so the shift is a plain translation along x.)
const mouthMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
  uniforms: { tex: { value: tex }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  // the target is sRGB, so sampling decodes to linear; encode back on output or the view comes out too dark
  fragmentShader: 'uniform sampler2D tex; uniform vec2 res; void main() { gl_FragColor = texture2D(tex, gl_FragCoord.xy / res);\n#include <colorspace_fragment>\n}',
})
function PortalPair({ ax, bx, z, y }: { ax: number; bx: number; z: number; y: number }) {
  const { gl, scene, camera } = useThree()
  const ra = useFBO(), rb = useFBO()
  ra.texture.colorSpace = rb.texture.colorSpace = THREE.SRGBColorSpace
  const ma = useMemo(() => mouthMat(ra.texture), [ra]), mb = useMemo(() => mouthMat(rb.texture), [rb])
  const mouthA = useRef<THREE.Mesh>(null!), mouthB = useRef<THREE.Mesh>(null!)
  const size = useMemo(() => new THREE.Vector2(), [])
  useFrame(() => {
    gl.getDrawingBufferSize(size)
    gl.localClippingEnabled = true
    const pass = (rt: THREE.WebGLRenderTarget, shift: number, plane: THREE.Plane, mat: THREE.ShaderMaterial) => {
      mat.uniforms.res.value.copy(size)
      const v = camera.clone(); v.position.x += shift; v.updateMatrixWorld()
      gl.clippingPlanes = [plane]
      gl.setRenderTarget(rt); gl.render(scene, v)
    }
    // reuse the shadow map from the main render: re-rendering it here would apply the portal's clipping plane
    // to it and drop the shadows (the lines' among them) from the view through the portal
    const autoShadows = gl.shadowMap.autoUpdate; gl.shadowMap.autoUpdate = false
    mouthA.current.visible = mouthB.current.visible = false
    pass(ra, bx - ax, new THREE.Plane(new THREE.Vector3(1, 0, 0), -bx), ma) // into A, out of B: keep x >= bx
    pass(rb, ax - bx, new THREE.Plane(new THREE.Vector3(-1, 0, 0), ax), mb) // into B, out of A: keep x <= ax
    mouthA.current.visible = mouthB.current.visible = true
    gl.clippingPlanes = []; gl.setRenderTarget(null); gl.shadowMap.autoUpdate = autoShadows
  })
  const one = (x: number, facing: 1 | -1, mouth: React.RefObject<THREE.Mesh>, mat: THREE.ShaderMaterial) => (
    <group position={[x, y, z]} scale={[1, 1.5, 1]}>
      <mesh castShadow rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.2, 0.03, 10, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
      <mesh ref={mouth} material={mat} position={[facing * 0.002, 0, 0]} rotation={[0, facing * Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /></mesh>
      <mesh castShadow position={[-facing * 0.03, 0, 0]} rotation={[0, -facing * Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
    </group>
  )
  return <>{one(ax, -1, mouthA, ma)}{one(bx, 1, mouthB, mb)}</>
}

function Edges({ crossing }: { crossing: Crossing }) {
  return (
    <>
      {edges.map(e => {
        if (crossing === 'today') return <EdgeLine key={e.id} pts={e.pts.map(([x, z]) => [x, z, e.today + 0.06] as P)} />
        if (crossing === 'bridge' && e.bridge) return <EdgeLine key={e.id} pts={e.bridge} />
        if (crossing === 'tunnel' && e.tunnel) return <EdgeLine key={e.id} pts={e.tunnel} />
        if (crossing === 'portal' && e.portals) {
          const p = e.portals
          return <group key={e.id}><EdgeLine pts={p.before} arrow={false} /><EdgeLine pts={p.after} /><PortalPair ax={p.at[0]} bx={p.at[1]} z={-2} y={.35} /></group>
        }
        return <EdgeLine key={e.id} pts={e.pts} />
      })}
    </>
  )
}

const T: [number, number, number] = [4.5, 0, 1]
function Cam({ mode }: { mode: Mode }) {
  if (mode === '3d') return <><PerspectiveCamera makeDefault position={[11.5, 9, 16]} fov={45} /><OrbitControls makeDefault target={T} /></>
  const d = 40, pos: [number, number, number] = mode === 'flat' ? [T[0], d, T[2] + 0.0001] : [T[0] + d * 0.577, d * 0.577, T[2] + d * 0.577]
  return <><OrthographicCamera makeDefault position={pos} zoom={36} near={-200} far={200} /><OrbitControls makeDefault target={T} enableRotate={false} /></>
}

// The sun. In flat view it is almost straight overhead (5° off), so shadows fall short and barely to one side.
const SUN: [number, number, number] = [10, 18, 7]
const FLAT_SUN: [number, number, number] = [21.8 * Math.sin(5 * Math.PI / 180), 21.8 * Math.cos(5 * Math.PI / 180), 0]
type Args = { mode: Mode; crossing: Crossing; edgeShadows: boolean; ground: string; edgeColor: string; edgeWidth: number; worldWidth: boolean } // edgeColor 'auto': dark on a light ground, light on a dark one
const EDGE_PRESETS = { light: LINE, dark: LINE_ON_WHITE, amber: '#ffb347', cyan: '#3fd6e8' }

// The story's own controls, on the page (the embedded view hides Storybook's Controls panel).
const btn = (on: boolean): React.CSSProperties => ({ font: '12px system-ui', padding: '4px 8px', border: '1px solid #3a4258', borderRadius: 6, cursor: 'pointer', background: on ? '#4b6bdc' : '#151a24', color: on ? '#fff' : '#9aa6c0' })
function Panel({ a, set }: { a: Args; set: (p: Partial<Args>) => void }) {
  const row = (label: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 64, color: '#9aa6c0' }}>{label}</span>{children}</div>
  )
  return (
    <div style={{ position: 'absolute', top: 34, left: 12, display: 'grid', gap: 6, padding: 10, background: 'rgba(15,18,24,.85)', borderRadius: 8, font: '12px system-ui' }}>
      {row('View', (['flat', 'iso', '3d'] as Mode[]).map(m => <button key={m} style={btn(a.mode === m)} onClick={() => set({ mode: m })}>{m}</button>))}
      {row('Crossings', (['today', 'none', 'bridge', 'tunnel', 'portal'] as Crossing[]).map(c => <button key={c} style={btn(a.crossing === c)} onClick={() => set({ crossing: c })}>{c}</button>))}
      {row('Shadows', <button style={btn(a.edgeShadows)} onClick={() => set({ edgeShadows: !a.edgeShadows })}>edges cast shadows</button>)}
      {row('Ground', <>
        {Object.entries(PRESETS).map(([k, c]) => <button key={k} style={btn(a.ground === c)} onClick={() => set({ ground: c })}>{k}</button>)}
        <input type="color" value={a.ground} onChange={e => set({ ground: e.target.value })} style={{ width: 32, height: 24, border: 0, padding: 0, background: 'none', cursor: 'pointer' }} />
      </>)}
      {row('Edges', <>
        <button style={btn(a.edgeColor === 'auto')} onClick={() => set({ edgeColor: 'auto' })}>auto</button>
        {Object.entries(EDGE_PRESETS).map(([k, c]) => <button key={k} style={btn(a.edgeColor === c)} onClick={() => set({ edgeColor: c })}>{k}</button>)}
        <input type="color" value={a.edgeColor === 'auto' ? '#888888' : a.edgeColor} onChange={e => set({ edgeColor: e.target.value })} style={{ width: 32, height: 24, border: 0, padding: 0, background: 'none', cursor: 'pointer' }} />
      </>)}
      {row('Thickness', <>
        <input type="range" min={0.02} max={0.2} step={0.01} value={a.edgeWidth} onChange={e => set({ edgeWidth: +e.target.value })} />
        <span style={{ color: '#9aa6c0', width: 36 }}>{a.worldWidth ? a.edgeWidth.toFixed(2) : `${px(a.edgeWidth).toFixed(1)}px`}</span>
        <button style={btn(a.worldWidth)} onClick={() => set({ worldWidth: true })}>in the scene</button>
        <button style={btn(!a.worldWidth)} onClick={() => set({ worldWidth: false })}>on screen</button>
      </>)}
    </div>
  )
}

function EdgesScene(initial: Args) {
  const [a, setA] = useState(initial)
  useEffect(() => setA(initial), [initial.mode, initial.crossing, initial.edgeShadows, initial.ground, initial.edgeColor, initial.edgeWidth, initial.worldWidth])
  const set = (p: Partial<Args>) => setA(x => ({ ...x, ...p }))
  const { mode, crossing, edgeShadows, ground: bg, edgeColor, edgeWidth, worldWidth } = a
  const light = isLight(bg), grid = [shade(bg, light ? -0.14 : 0.10), shade(bg, light ? -0.08 : 0.06)] // a faint grid on the floor
  return (
    <div style={{ width: '100vw', height: '100vh', background: bg, position: 'relative' }}>
      <Canvas shadows dpr={[1, 2]}>
        <color attach="background" args={[bg]} />
        <Cam key={mode} mode={mode} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#bcd0ff', '#202838', 0.5]} />
        <directionalLight position={mode === 'flat' ? FLAT_SUN : SUN} intensity={1.6} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004}
          shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-camera-far={80} />
        <Ground bg={bg} grid={grid} slot={crossing === 'tunnel' ? edges.find(e => e.slot)?.slot : undefined} />
        {trays.map(t => (
          <group key={t.id} position={[(t.r[0] + t.r[2]) / 2, t.level * TRAY, (t.r[1] + t.r[3]) / 2]}>
            <Tray b={t} labelMode="top" />
          </group>
        ))}
        {nodes.map(n => (
          <group key={n.id} position={[(n.r[0] + n.r[2]) / 2, n.level * TRAY, (n.r[1] + n.r[3]) / 2]}
            scale={[1, 'tall' in n ? n.tall / NODE_H : 1, 1]}>
            <NodeBody b={n} labelMode="top" />
          </group>
        ))}
        <LineColor.Provider value={edgeColor !== 'auto' ? edgeColor : light ? LINE_ON_WHITE : LINE}><EdgeShadows.Provider value={edgeShadows}><EdgeWidth.Provider value={{ w: edgeWidth, world: worldWidth }}><Edges crossing={crossing} /></EdgeWidth.Provider></EdgeShadows.Provider></LineColor.Provider>
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 12, color: light ? '#3a4258' : '#9aa6c0', font: '12px monospace', pointerEvents: 'none' }}>
        mockup · made-up data (a payments flow), hand-placed
      </div>
      <Panel a={a} set={set} />
    </div>
  )
}

const meta: Meta<Args> = {
  title: 'Mockups/Edges in 3D',
  args: { mode: 'iso', edgeShadows: false, ground: PRESETS.grey, edgeColor: 'auto', edgeWidth: 0.06, worldWidth: true },
  argTypes: {
    mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] },
    crossing: { control: 'inline-radio', options: ['today', 'none', 'bridge', 'tunnel', 'portal'] },
    edgeShadows: { control: 'boolean' },
    ground: { control: 'color' },
    edgeColor: { control: 'color' },
    edgeWidth: { control: { type: 'range', min: 0.02, max: 0.2, step: 0.01 } },
    worldWidth: { control: 'boolean' },
  },
  render: (args) => <EdgesScene {...args} />,
}
export default meta
type Story = StoryObj<typeof meta>

/** How edges are drawn now: one height per line, the higher end's surface. */
export const Today: Story = { args: { crossing: 'today' } }
/** The default: side midpoints halfway up, one step to where each line is headed; crossings plain. */
export const Steps: Story = { args: { crossing: 'none' } }
/** Crossing style: bridge. Client → Audit hops over Notifier → Pay API. */
export const Bridge: Story = { args: { crossing: 'bridge' } }
/** Crossing style: tunnel. Down into an open slot cut in the ground and up again; from above you still see the line in the slot. */
export const Tunnel: Story = { args: { crossing: 'tunnel' } }
/** Crossing style: portal. Look into one and you see out of the other; solid blue from behind, like the ring. Try 3D. */
export const Portal: Story = { args: { crossing: 'portal', mode: '3d' } }
/** Steps with edges casting shadows (a look to try; toggle edgeShadows on any story). Try 3D. */
export const EdgeShadowsOn: Story = { name: 'Edge shadows', args: { crossing: 'bridge', mode: '3d', edgeShadows: true } }

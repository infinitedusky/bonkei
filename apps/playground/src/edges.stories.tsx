// Mockup for BON-85: edges in 3D. Made-up data (a payments flow), hand-placed, not laid out by ELK.
// Blocks and trays are core's own NodeBody and Tray; the lines are drawn here the way the renderer
// draws them (drei Line, width 2, cone tip), with a height per point.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls, OrthographicCamera, PerspectiveCamera, useFBO } from '@react-three/drei'
import { NodeBody, Tray, TRAY, NODE_H, S } from 'bonkei'
import type { Box, Mode } from 'bonkei'

type Crossing = 'today' | 'none' | 'bridge' | 'tunnel' | 'portal'
type P = [number, number, number] // x, z (plan, world units), height

const LINE = '#e8edf7'
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
const edges: { id: string; today: number; pts: P[]; bridge?: P[]; tunnel?: P[]; holes?: [number, number][]; portals?: { before: P[]; after: P[]; at: [number, number] } }[] = [
  { id: 'client-pay', today: TRAY, pts: [[-4, 3, .35], [-0.5, 3, .35], [-0.5, 3, .6], [1, 3, .6]] },
  { id: 'pay-fraud', today: 2 * TRAY, pts: [[3, 3, .6], [4.5, 3, .6], [4.5, 2.1, .6], [5, 2.1, .6], [5, 2.1, 1.4], [6.5, 2.1, 1.4]] },
  { id: 'fraud-review', today: 2 * TRAY, pts: [[7.5, 2.7, 1.4], [7.5, 3.2, 1.4], [7.5, 3.2, .85], [7.5, 3.8, .85]] },
  { id: 'fraud-ledger', today: 2 * TRAY, pts: [[8.5, 2.1, 1.4], [11.5, 2.1, 1.4], [11.5, 2.1, .35], [12.2, 2.1, .35], [12.2, 3, .35], [13, 3, .35]] },
  {
    id: 'client-audit', today: 0, pts: [[-5, 2.4, .35], [-5, -2, .35], [13, -2, .35]],
    bridge: [[-5, 2.4, .35], [-5, -2, .35], [3.7, -2, .35], [3.7, -2, .35 + B], [4.3, -2, .35 + B], [4.3, -2, .35], [13, -2, .35]],
    tunnel: [[-5, 2.4, .35], [-5, -2, .35], [3.6, -2, .35], [3.6, -2, -.25], [4.4, -2, -.25], [4.4, -2, .35], [13, -2, .35]], holes: [[3.6, -2], [4.4, -2]],
    portals: { before: [[-5, 2.4, .35], [-5, -2, .35], [3.6, -2, .35]], after: [[4.4, -2, .35], [13, -2, .35]], at: [3.6, 4.4] },
  },
  { id: 'notifier-pay', today: TRAY, pts: [[4, -3.8, .35], [4, -1.2, .35], [2, -1.2, .35], [2, -0.5, .35], [2, -0.5, .6], [2, 2.4, .6]] },
  { id: 'ledger-payments', today: TRAY, pts: [[14, 3.6, .35], [14, 4.1, .35], [14, 4.1, .125], [14, 7.5, .125], [5.5, 7.5, .125], [5.5, 6, .125]] },
]

const UP = new THREE.Vector3(0, 1, 0)
const v3 = ([x, z, y]: P) => new THREE.Vector3(x, y, z)

function EdgeLine({ pts, arrow = true }: { pts: P[]; arrow?: boolean }) {
  const v = pts.map(v3)
  if (!arrow) return <Line points={v} color={LINE} lineWidth={2} />
  const n = v.length, dir = v[n - 1].clone().sub(v[n - 2]).normalize()
  const tip = v[n - 1].clone().addScaledVector(dir, -0.3)
  return (
    <group>
      <Line points={[...v.slice(0, n - 1), tip]} color={LINE} lineWidth={2} />
      <mesh position={tip.clone().addScaledVector(dir, 0.15)} quaternion={new THREE.Quaternion().setFromUnitVectors(UP, dir)}>
        <coneGeometry args={[0.13, 0.35, 16]} />
        <meshBasicMaterial color={LINE} />
      </mesh>
    </group>
  )
}

function Hole({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><circleGeometry args={[0.13, 24]} /><meshBasicMaterial color="#000" /></mesh>
      <mesh><ringGeometry args={[0.13, 0.17, 24]} /><meshBasicMaterial color="#7f8aa3" /></mesh>
    </group>
  )
}

// Portals as in the game, one colour: looking into either mouth you see out of the other one.
// Each mouth shows the scene rendered from the camera shifted by the gap, clipped at the far portal's plane.
// (Both sit on one straight line facing apart, so the shift is a plain translation along x.)
const mouthMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
  uniforms: { tex: { value: tex }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tex; uniform vec2 res; void main() { gl_FragColor = texture2D(tex, gl_FragCoord.xy / res); }',
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
    mouthA.current.visible = mouthB.current.visible = false
    pass(ra, bx - ax, new THREE.Plane(new THREE.Vector3(1, 0, 0), -bx), ma) // into A, out of B: keep x >= bx
    pass(rb, ax - bx, new THREE.Plane(new THREE.Vector3(-1, 0, 0), ax), mb) // into B, out of A: keep x <= ax
    mouthA.current.visible = mouthB.current.visible = true
    gl.clippingPlanes = []; gl.setRenderTarget(null)
  })
  const one = (x: number, facing: 1 | -1, mouth: React.RefObject<THREE.Mesh>, mat: THREE.ShaderMaterial) => (
    <group position={[x, y, z]} scale={[1, 1.5, 1]}>
      <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.2, 0.03, 10, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
      <mesh ref={mouth} material={mat} position={[facing * 0.002, 0, 0]} rotation={[0, facing * Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /></mesh>
      <mesh position={[-facing * 0.002, 0, 0]} rotation={[0, -facing * Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /><meshStandardMaterial color="#8a93a8" roughness={0.9} /></mesh>
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
        if (crossing === 'tunnel' && e.tunnel) return <group key={e.id}><EdgeLine pts={e.tunnel} />{e.holes!.map(([x, z]) => <Hole key={x} x={x} z={z} />)}</group>
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

function EdgesScene({ mode, crossing }: { mode: Mode; crossing: Crossing }) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f1218', position: 'relative' }}>
      <Canvas shadows dpr={[1, 2]}>
        <color attach="background" args={['#0f1218']} />
        <Cam key={mode} mode={mode} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#bcd0ff', '#202838', 0.5]} />
        <directionalLight position={[10, 18, 7]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0, 1]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#0f1218" roughness={1} />
        </mesh>
        <gridHelper args={[80, 80, '#1d2433', '#161c28']} position={[4, 0.002, 1]} />
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
        <Edges crossing={crossing} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 12, color: '#9aa6c0', font: '12px monospace', pointerEvents: 'none' }}>
        mockup · made-up data (a payments flow), hand-placed · crossings: {crossing}
      </div>
    </div>
  )
}

const meta: Meta<{ mode: Mode; crossing: Crossing }> = {
  title: 'Mockups/Edges in 3D',
  args: { mode: 'iso' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] },
    crossing: { control: 'inline-radio', options: ['today', 'none', 'bridge', 'tunnel', 'portal'] },
  },
  render: ({ mode, crossing }) => <EdgesScene mode={mode} crossing={crossing} />,
}
export default meta
type Story = StoryObj<typeof meta>

/** How edges are drawn now: one height per line, the higher end's surface. */
export const Today: Story = { args: { crossing: 'today' } }
/** The default: side midpoints halfway up, one step to where each line is headed; crossings plain. */
export const Steps: Story = { args: { crossing: 'none' } }
/** Crossing style: bridge. Client → Audit hops over Notifier → Pay API. */
export const Bridge: Story = { args: { crossing: 'bridge' } }
/** Crossing style: tunnel. Down through a hole, up through another; in flat, a break between two holes. */
export const Tunnel: Story = { args: { crossing: 'tunnel' } }
/** Crossing style: portal. Look into one and you see out of the other; opaque from behind. Try 3D. */
export const Portal: Story = { args: { crossing: 'portal', mode: '3d' } }

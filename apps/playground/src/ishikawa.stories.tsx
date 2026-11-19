// BON-142 mockup: Ishikawa (fishbone) diagrams, drawn with Bonkei's own blocks, labels, lines and themes. A picture of what the build
// should draw, agreed in sketches/ishikawa-viewer.html and sketches/ishikawa-compare.html: the parse and the layout here are the mockup's
// own, not the build's. MADE-UP SAMPLE DATA (Mermaid's "Blurry Photo" sample, and variants of it).
//
// What it shows: the effect is a fish's head; categories are blocks at the bone tips; causes are pills, lower and smaller the deeper
// they go. Every line leaves its pill's front (the end toward the head) and ends in an arrowhead on what it causes; lines are level or
// diagonal the same way as the bones (the herringbone), turning level / diagonal / level as they go down, at any depth.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, type ReactNode } from 'react'
import { NodeBody, Label, ThemeProvider, useTheme, PRESETS, PRESET, S, type Box, type Mode, type Theme } from 'bonkei/internal'

// ---- the text: the first line after the keyword is the effect; lines at its indent are categories; deeper lines are causes
type Item = { label: string; kids: Item[]; ind: number }
function parse(src: string): Item {
  const lines = src.split('\n').filter(l => l.trim() && !l.trim().startsWith('%%')).slice(1)
  const root: Item = { label: '', kids: [], ind: -1 }
  const stack: Item[] = []
  let base = -1
  for (const raw of lines) {
    const ind = raw.length - raw.trimStart().length, label = raw.trim()
    if (base < 0) { root.label = label; base = ind; continue }
    if (ind < base) continue
    const it: Item = { label, kids: [], ind }
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop()
    ;(stack.length ? stack[stack.length - 1] : root).kids.push(it)
    stack.push(it)
  }
  return root
}

// ---- the layout, in px (x along the spine toward the head, z across it)
type Piece = { kind: 'effect' | 'cat' | 'cause'; depth: number; label: string; x: number; z: number; w: number; d: number }
type Rod = { a: [number, number]; b: [number, number]; depth: number }
const pillW = (t: string) => t.length * 8.5 + 34
const count = (n: Item): number => 1 + n.kids.reduce((m, k) => m + count(k), 0)
const ROW = 40

// kids that slant into a level line at z = pz, whose left end (the parent pill's front) is at xa. Each takes one row on the far side of
// the line (d), the first farthest; an item's own causes take the rows between it and the line, each on a level line into its diagonal.
function hangSlanted(kids: Item[], pz: number, xa: number, d: number, depth: number, pieces: Piece[], rods: Rod[]) {
  const fx = xa + 8
  let off = 0
  for (const kid of [...kids].reverse()) {
    const dz = (off + count(kid)) * ROW, sz = pz + d * dz, sw = pillW(kid.label) * Math.max(0.7, 1 - 0.12 * (depth - 2))
    rods.push({ a: [fx, sz], b: [fx + 0.62 * dz, pz], depth })
    pieces.push({ kind: 'cause', depth, label: kid.label, x: fx - sw / 2, z: sz, w: sw, d: 28 })
    let r = off
    for (const g of kid.kids) {
      r += 1
      const gz = pz + d * r * ROW, gx = fx + 0.62 * (dz - r * ROW), gw = pillW(g.label) * Math.max(0.7, 1 - 0.12 * (depth - 1)), gf = fx - 40
      rods.push({ a: [gf, gz], b: [gx, gz], depth: depth + 1 })
      pieces.push({ kind: 'cause', depth: depth + 1, label: g.label, x: gf - gw / 2, z: gz, w: gw, d: 26 })
      hangSlanted(g.kids, gz, gf, d, depth + 2, pieces, rods)
      r += count(g) - 1
    }
    off += count(kid)
  }
}

function layout(root: Item) {
  const pieces: Piece[] = [], rods: Rod[] = []
  const cats = root.kids, cols = Math.max(1, Math.ceil(cats.length / 2))
  // a bone's length grows with what hangs on it; each side shares one length so the category blocks line up
  const need = (c: Item) => 90 + c.kids.reduce((s, k) => s + 56 + (count(k) - 1) * ROW, 0)
  const side = [0, 1].map(sd => Math.max(300, ...cats.filter((_, k) => k % 2 === sd).map(need)))
  const colW = Math.max(460, ...cats.map(c => Math.max(0, ...c.kids.map(k => pillW(k.label))) + 260))
  const headX = 120 + colW * cols + 60
  rods.push({ a: [0, 0], b: [headX, 0], depth: 0 })
  pieces.push({ kind: 'effect', depth: 0, label: root.label, x: headX + 150, z: 0, w: 300, d: 170 })
  cats.forEach((c, k) => {
    const col = Math.floor(k / 2), s = k % 2 === 0 ? -1 : 1, len = side[k % 2]
    const bx = 120 + colW * (col + 1), ex = bx - len * 0.62, ez = s * len
    rods.push({ a: [ex, ez - s * 30], b: [bx, 0], depth: 1 })
    pieces.push({ kind: 'cat', depth: 1, label: c.label, x: ex, z: ez, w: Math.max(150, pillW(c.label) + 20), d: 60 })
    let along = 80 // distance from the bone's tip, across the spine
    for (const cause of c.kids) {
      const rows = cause.kids.reduce((n, k) => n + count(k), 0)
      const pz = ez - s * (along + rows * ROW), z0 = ez - s * 30, t = (pz - z0) / -z0, px = ex + (bx - ex) * t, w = pillW(cause.label)
      const crx = px - (rows ? 70 + 25 * rows : 60)
      rods.push({ a: [crx, pz], b: [px, pz], depth: 2 })
      pieces.push({ kind: 'cause', depth: 2, label: cause.label, x: crx - w / 2, z: pz, w, d: 34 })
      hangSlanted(cause.kids, pz, crx, s, 3, pieces, rods)
      along += 56 + rows * ROW
    }
  })
  // centre it on the origin
  const xs = [...pieces.flatMap(p => [p.x - p.w / 2, p.x + p.w / 2]), ...rods.flatMap(r => [r.a[0], r.b[0]])]
  const zs = [...pieces.flatMap(p => [p.z - p.d / 2, p.z + p.d / 2]), ...rods.flatMap(r => [r.a[1], r.b[1]])]
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
  const size = { X: (Math.max(...xs) - Math.min(...xs)) * S, Z: (Math.max(...zs) - Math.min(...zs)) * S }
  return { pieces, rods, cx, cz, size }
}

// ---- the scene
// the theme's material, as core's Mat picks it (toon shading in the Bonkei looks)
function Mat(p: { color: string; roughness?: number }) {
  const th = useTheme()
  return th.light.shading === 'toon' ? <meshToonMaterial color={p.color} /> : <meshStandardMaterial color={p.color} roughness={p.roughness ?? 0.5} metalness={0.05} />
}
const LINE_Y = [0.34, 0.3, 0.26, 0.2, 0.16] // by depth: the spine highest, deeper lines lower, plugging into their pills
const lineY = (depth: number) => LINE_Y[Math.min(depth, LINE_Y.length - 1)]
const pillH = (depth: number) => Math.max(0.12, 0.4 - 0.1 * (depth - 2)) // a cause's height: lower the deeper it goes

// the theme's line and an arrowhead where it joins what it causes, sized to the line (the spine and bones heavier)
function Arrow({ a, b, depth, wx, wz }: { a: [number, number]; b: [number, number]; depth: number; wx: (x: number) => number; wz: (z: number) => number }) {
  const th = useTheme()
  const y = lineY(depth), from = new THREE.Vector3(wx(a[0]), y, wz(a[1])), to = new THREE.Vector3(wx(b[0]), y, wz(b[1]))
  const dir = to.clone().sub(from).normalize()
  const cl = depth === 0 ? 0.45 : depth === 1 ? 0.38 : 0.26, cr = depth === 0 ? 0.14 : depth === 1 ? 0.12 : 0.08
  const end = to.clone().addScaledVector(dir, -cl * 0.8)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  const width = th.edge.width * (depth === 0 ? 2.2 : depth === 1 ? 1.6 : 1)
  return (
    <group>
      <Line points={[from.toArray(), end.toArray()]} color={th.edge.color} lineWidth={width} />
      <mesh position={to.clone().addScaledVector(dir, -cl / 2)} quaternion={q}><coneGeometry args={[cr, cl, 14]} /><meshBasicMaterial color={th.edge.color} /></mesh>
    </group>
  )
}

// The effect: a fish's head in plan, extruded. A flat back where the spine meets it, gill plates swelling past the back, a blunt snout;
// a gill line across the top and an eye near the snout. The theme's diamond colour (Classic's pink), the node label on top.
function FishHead({ p, wx, wz }: { p: Piece; wx: (x: number) => number; wz: (z: number) => number }) {
  const th = useTheme()
  const w = p.w * S, hd = (p.d * S) / 2, h = 1.3, x0 = -w / 2, x1 = w / 2
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(x0 + w * 0.06, -hd * 0.62)
    sh.bezierCurveTo(x0 + w * 0.02, -hd * 1.02, x0 + w * 0.42, -hd * 1.05, x0 + w * 0.62, -hd * 0.82)
    sh.bezierCurveTo(x1 - w * 0.12, -hd * 0.6, x1, -hd * 0.22, x1, 0.02 * hd)
    sh.bezierCurveTo(x1, hd * 0.26, x1 - w * 0.14, hd * 0.62, x0 + w * 0.62, hd * 0.82)
    sh.bezierCurveTo(x0 + w * 0.42, hd * 1.05, x0 + w * 0.02, hd * 1.02, x0 + w * 0.06, hd * 0.62)
    sh.bezierCurveTo(x0 - w * 0.01, hd * 0.3, x0 - w * 0.01, -hd * 0.3, x0 + w * 0.06, -hd * 0.62)
    const bev = 0.06
    const g = new THREE.ExtrudeGeometry(sh, { depth: h - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 32 })
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0)
    return g
  }, [w, hd, x0, x1])
  const gill = useMemo(() => {
    const pts = new THREE.EllipseCurve(x0 + w * 0.2, 0, w * 0.12, hd * 0.78, -Math.PI / 2.3, Math.PI / 2.3).getPoints(24).map(q => new THREE.Vector3(q.x, 0, q.y))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.035, 8)
  }, [w, hd, x0])
  const color = th.node.colors.diamond
  const dark = '#' + new THREE.Color(color).multiplyScalar(0.55).getHexString()
  return (
    <group position={[wx(p.x), 0, wz(p.z)]}>
      <mesh geometry={geo} castShadow={th.light.shadows} receiveShadow={th.light.shadows}><Mat color={color} roughness={0.5} /></mesh>
      <mesh geometry={gill} position={[0, h + 0.005, 0]}><Mat color={dark} roughness={0.6} /></mesh>
      <mesh position={[w * 0.3, h + 0.03, -hd * 0.42]}><cylinderGeometry args={[0.17, 0.17, 0.06, 24]} /><Mat color="#2a1520" roughness={0.3} /></mesh>
      <mesh position={[w * 0.3 - 0.05, h + 0.04, -hd * 0.47]}><cylinderGeometry args={[0.05, 0.05, 0.07, 12]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <group position={[w * 0.04, 0, hd * 0.08]}><Label text={p.label} mode="top" y={h + 0.02} size={0.5} maxWidth={w * 0.62} role="node" /></group>
    </group>
  )
}

function Fishbone({ src }: { src: string }) {
  const { pieces, rods, cx, cz } = useMemo(() => layout(parse(src)), [src])
  const wx = (x: number) => (x - cx) * S, wz = (z: number) => (z - cz) * S
  return (
    <group>
      {rods.map((r, i) => <Arrow key={'r' + i} {...r} wx={wx} wz={wz} />)}
      {pieces.map((p, i) => {
        if (p.kind === 'effect') return <FishHead key={i} p={p} wx={wx} wz={wz} />
        const b: Box = { id: String(i), label: p.label, kind: 'node', shape: p.kind === 'cat' ? 'rect' : 'round', x: 0, y: 0, w: p.w, h: p.d, level: 0 }
        // a cause is a pill, scaled down in height by its depth (its label stays on its top)
        const k = p.kind === 'cat' ? 1 : pillH(p.depth) / 0.7
        return <group key={i} position={[wx(p.x), 0, wz(p.z)]} scale={[1, k, 1]}><NodeBody b={b} labelMode="top" /></group>
      })}
    </group>
  )
}

// the camera at one of Bonkei's three views, framing the whole diagram; drag turns it, scroll zooms
function View({ mode, size }: { mode: Mode; size: { X: number; Z: number } }) {
  const { camera, size: px } = useThree()
  useEffect(() => {
    const p = PRESET[mode], cam = camera as THREE.PerspectiveCamera, aspect = px.width / px.height
    const wide = Math.abs(Math.cos(p.yaw)) * size.X + Math.abs(Math.sin(p.yaw)) * size.Z
    const deep = (Math.abs(Math.sin(p.yaw)) * size.X + Math.abs(Math.cos(p.yaw)) * size.Z) * Math.sin(p.pitch)
    const span = Math.max(deep, wide / aspect) * (mode === '3d' ? 1.35 : 1.2)
    const dist = span / 2 / Math.tan((p.fov * Math.PI) / 360)
    cam.fov = p.fov; cam.near = dist / 50; cam.far = dist * 50
    cam.layers.enable(1) // labels live on core's TEXT_LAYER (1), which only a camera that enables it draws, as SceneView's does
    cam.position.set(Math.sin(p.yaw) * Math.cos(p.pitch) * dist, Math.sin(p.pitch) * dist, Math.cos(p.yaw) * Math.cos(p.pitch) * dist)
    cam.lookAt(0, 0, 0); cam.updateProjectionMatrix()
  }, [mode, size.X, size.Z, camera, px.width, px.height])
  return <OrbitControls makeDefault target={[0, 0, 0]} />
}

function Ground() {
  const th = useTheme()
  return (
    <>
      <ambientLight intensity={th.light.ambient} />
      <hemisphereLight args={[th.light.sky, th.light.floor, th.light.hemi]} />
      <directionalLight position={[10, 18, 7]} intensity={th.light.sun} castShadow={th.light.shadows} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-bias={-0.0004} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={th.light.shadows}>
        <planeGeometry args={[400, 400]} />
        {th.ground.lit ? <meshStandardMaterial color={th.ground.bg} roughness={1} /> : <meshBasicMaterial color={th.ground.bg} />}
      </mesh>
      {th.ground.grid && <gridHelper args={[200, 200, ...th.ground.grid]} position={[0, -0.01, 0]} />}
    </>
  )
}

function Diagram({ src, mode, theme, caption }: { src: string; mode: Mode; theme: Theme; caption?: ReactNode }) {
  const { size } = useMemo(() => layout(parse(src)), [src])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: theme.ground.bg }}>
      <Canvas shadows={theme.light.shadows} dpr={[1, 2]} camera={{ fov: 45, position: [0, 30, 30] }} gl={{ antialias: true, toneMapping: theme.light.toneMapping ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping }}>
        <ThemeProvider theme={theme}>
          <color attach="background" args={[theme.ground.bg]} />
          <Ground />
          <Fishbone src={src} />
          <View mode={mode} size={size} />
        </ThemeProvider>
      </Canvas>
      {caption && <div style={{ position: 'absolute', top: 10, left: 12, font: '12px monospace', color: theme.ground.lit ? '#9aa6c0' : '#5d554b', pointerEvents: 'none' }}>{caption}</div>}
    </div>
  )
}

// ---- the samples (made up): Mermaid's own, a fourth level, and a busy one
const BLURRY = `ishikawa-beta
    Blurry Photo
    Process
        Out of focus
        Shutter speed too slow
        Protective film not removed
        Beautification filter applied
    User
        Shaky hands
    Equipment
        LENS
            Inappropriate lens
            Damaged lens
            Dirty lens
        SENSOR
            Damaged sensor
            Dirty sensor
    Environment
        Subject moved too quickly
        Too dark`
const DEEPER = BLURRY.replace('            Damaged lens\n', '            Damaged lens\n                Bad case\n')
const BUSY = `ishikawa-beta
    Churn up 4%
    Price
        Increase in March
        Annual plan removed
    Product
        Slow search
        Missing export
            CSV only
            No API
    Support
        Long waits
    Onboarding
        No tour
    Billing
        Card failures
            Expired cards
    Competition
        Cheaper rival
    Marketing
        Wrong audience
    Season
        Summer dip`

type Args = { mode: Mode; theme: string }
const meta: Meta<Args> = {
  title: 'Ishikawa (fishbone)',
  parameters: { layout: 'fullscreen' },
  args: { mode: '3d', theme: 'classic' },
  argTypes: { mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] }, theme: { control: 'inline-radio', options: Object.keys(PRESETS) } },
}
export default meta
type Story = StoryObj<Args>
const one = (src: string, caption: string): Story => ({
  render: ({ mode, theme }) => <div style={{ height: '100vh' }}><Diagram src={src} mode={mode} theme={PRESETS[theme]} caption={caption} /></div>,
})

/** Mermaid's own sample from mermaid.js.org/syntax/ishikawa, unchanged. */
export const BlurryPhoto = one(BLURRY, 'sample data: Mermaid\'s "Blurry Photo"')
/** A fourth level: "Bad case" under "Damaged lens", a level line into Damaged lens's diagonal. */
export const FourthLevel = one(DEEPER, 'sample data: "Blurry Photo" + "Bad case" under "Damaged lens"')
/** Eight categories, some causes with causes of their own: the spine grows. */
export const EightCategories = one(BUSY, 'sample data: made up, eight categories')

/** The same diagram in the three views side by side. */
export const ThreeViews: StoryObj<{ theme: string }> = {
  render: ({ theme }) => (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, background: '#000' }}>
      {(['flat', 'iso', '3d'] as Mode[]).map(m => <Diagram key={m} src={DEEPER} mode={m} theme={PRESETS[theme]} caption={m} />)}
    </div>
  ),
}

/** The three themes, in 3D. */
export const Themes: StoryObj<{ mode: Mode }> = {
  render: ({ mode }) => (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, background: '#000' }}>
      {Object.entries(PRESETS).map(([name, th]) => <Diagram key={name} src={BLURRY} mode={mode} theme={th} caption={name} />)}
    </div>
  ),
}

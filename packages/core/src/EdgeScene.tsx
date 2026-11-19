// Draws an EdgePlan: the line in parts, tunnel holes and portals. Portals follow the game: looking into one you
// see out of the other, solid from behind. Decisions: LOG.md, "How edges sit in 3D (BON-85)".
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line, Text } from '@react-three/drei'
import { SLOT_W, flatLine, type Body, type EdgePlan, type P3, type PortalPair, type Slot } from './edges3d.ts'
import { useTheme, fontUrl } from './look'
import { TEXT_LAYER } from './scale.ts'
import type { LabelMode } from './model'

const v3 = ([x, z, y]: P3) => new THREE.Vector3(x, y, z)

// An arrowhead with no depth: a triangle lying in the surface, pointing along `dir` (horizontal part).
function FlatArrow({ tip, dir, color }: { tip: THREE.Vector3; dir: THREE.Vector3; color: string }) {
  const geo = useMemo(() => {
    const d = new THREE.Vector3(dir.x, 0, dir.z).normalize(), n = new THREE.Vector3(-d.z, 0, d.x)
    const b = tip.clone().addScaledVector(d, -0.4)
    const g = new THREE.BufferGeometry().setFromPoints([tip, b.clone().addScaledVector(n, 0.15), b.clone().addScaledVector(n, -0.15)])
    return g
  }, [tip, dir])
  return <mesh geometry={geo}><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>
}

export function Edge({ plan, label, labelMode, bodies }: { plan: EdgePlan; label?: string; labelMode: LabelMode; bodies?: Body[] }) {
  const th = useTheme()
  const flat = th.edge.flat && !!bodies
  // flat: the whole route (its parts joined) is laid on the surfaces under it; a bridge or tunnel is levelled
  const parts = flat
    ? [flatLine(plan.parts.flatMap(p => p), bodies!).map(v3)]
    : plan.parts.map(p => p.map(v3))
  const last = parts[parts.length - 1]
  const n = last.length
  const dir = new THREE.Vector3().subVectors(last[n - 1], last[n - 2]).normalize()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  const tip = last[n - 1]
  const lines = parts.map((p, i) => i === parts.length - 1 ? [...p.slice(0, n - 1), tip.clone().addScaledVector(dir, -0.3)] : p)
  // label on the longest run in plan
  let best = 0, at = new THREE.Vector3()
  for (const p of parts) for (let i = 0; i < p.length - 1; i++) {
    const l = Math.hypot(p[i + 1].x - p[i].x, p[i + 1].z - p[i].z)
    if (l > best) { best = l; at = p[i].clone().add(p[i + 1]).multiplyScalar(0.5) }
  }
  return (
    <group>
      {lines.map((l, i) => <Line key={i} points={l.map(p => p.toArray() as [number, number, number])} color={th.edge.color} lineWidth={th.edge.width} />)}
      {flat
        ? <FlatArrow tip={tip} dir={dir} color={th.edge.color} />
        : (
          <mesh position={tip.clone().addScaledVector(dir, -0.2)} quaternion={quat}>
            <coneGeometry args={[0.13, 0.4, 16]} />
            <meshBasicMaterial color={th.edge.color} />
          </mesh>
        )}
      {label && (
        <Text layers={TEXT_LAYER as any} position={[at.x, at.y + (labelMode === 'top' ? 0.02 : 0.4), at.z]} rotation={labelMode === 'top' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} font={fontUrl(th)} fontSize={0.22} color={th.edge.label} outlineWidth={0.02} outlineColor={th.edge.labelOutline}>{label}</Text>
      )}
    </group>
  )
}

// The trough's plan outline, in shape space (x, y = -z): straight sides and round ends of radius half the slot width
// (a stadium for one line); merged troughs are a rounded rectangle with the same corner radius. One outline serves the
// hole in the surface, the walls, the floor and the grid mask.
export function stadium(s: { x0: number; x1: number; z0: number; z1: number }, p: THREE.Path = new THREE.Path(), inset = 0) {
  const c = SLOT_W / 2, r = c - inset
  const xa = s.x0 + inset, xb = s.x1 - inset, ya = -s.z1 - c + inset, yb = -s.z0 + c - inset // ya < yb
  p.moveTo(xa + r, ya); p.lineTo(xb - r, ya)
  p.absarc(xb - r, ya + r, r, -Math.PI / 2, 0, false)
  p.lineTo(xb, yb - r)
  p.absarc(xb - r, yb - r, r, 0, Math.PI / 2, false)
  p.lineTo(xa + r, yb)
  p.absarc(xa + r, yb - r, r, Math.PI / 2, Math.PI, false)
  p.lineTo(xa, ya + r)
  p.absarc(xa + r, ya + r, r, Math.PI, Math.PI * 1.5, false)
  return p
}

// A tunnel's open trough: walls (the stadium extruded from the floor up to the surface, caps hidden), a floor and an
// outline round the lip, all darker than the surface they are cut in; the walls receive shadows. The surface itself
// has a matching hole (Ground, Tray). The line runs along the floor under the other line.
export function Trench({ slot, color, y = 0 }: { slot: Slot; color: string; y?: number }) {
  const th = useTheme()
  // a hair inside the hole, so a tray's own cut walls and these never share a plane
  const shape = useMemo(() => { const sh = new THREE.Shape(); stadium(slot, sh, 0.004); return sh }, [slot.x0, slot.x1, slot.z0, slot.z1])
  const walls = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: slot.depth, bevelEnabled: false, curveSegments: 16 }), [shape, slot.depth])
  const flat = useMemo(() => new THREE.ShapeGeometry(shape, 16), [shape])
  const top = slot.top + y
  const outline = useMemo(() => shape.getPoints(16).map(p => [p.x, top + 0.005, -p.y] as [number, number, number]), [shape, top])
  const wall = useMemo(() => new THREE.Color(color).multiplyScalar(0.55), [color])
  const floor = useMemo(() => new THREE.Color(color).multiplyScalar(0.3), [color])
  const rim = useMemo(() => new THREE.Color(color).multiplyScalar(0.2), [color])
  // the light along the floor where it meets the walls (theme.edge.glow); no point light, it blows out the neighbouring block
  const g = th.edge.glow
  const ledPts = useMemo(() => shape.getPoints(16).map(p => [p.x, top - slot.depth + 0.015, -p.y] as [number, number, number]), [shape, top, slot.depth])
  const hidden = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: wall, side: THREE.DoubleSide, roughness: 1, ...(g.wash ? { emissive: g.wash, emissiveIntensity: g.washIntensity } : {}) }), [wall, g.wash, g.washIntensity])
  return (
    <>
      <mesh geometry={walls} rotation={[-Math.PI / 2, 0, 0]} position={[0, top - slot.depth, 0]} receiveShadow material={[hidden, wallMat]} />
      <mesh geometry={flat} rotation={[-Math.PI / 2, 0, 0]} position={[0, top - slot.depth, 0]} receiveShadow><meshStandardMaterial color={floor} roughness={1} /></mesh>
      {th.edge.rim !== 'none' && <Line points={[...outline, outline[0]]} color={th.edge.rim ?? rim} lineWidth={th.edge.rimWidth} />}
      {g.halo && <Line points={[...ledPts, ledPts[0]]} color={g.halo} lineWidth={g.haloWidth} transparent opacity={g.haloOpacity} depthWrite={false} />}
      {g.core && <Line points={[...ledPts, ledPts[0]]} color={g.core} lineWidth={g.coreWidth} />}
    </>
  )
}

// A rectangle shape with the slots cut out of it (shape y is world -z once laid flat).
export function slotShape(x0: number, z0: number, x1: number, z1: number, slots: { x0: number; x1: number; z0: number; z1: number }[]) {
  const sh = new THREE.Shape()
  sh.moveTo(x0, -z0); sh.lineTo(x1, -z0); sh.lineTo(x1, -z1); sh.lineTo(x0, -z1); sh.closePath()
  for (const s of slots) sh.holes.push(stadium(s))
  return sh
}

// How the portal views are kept cheap (BON-85, criterion 10). All portals are one system sharing a per-frame budget:
// - a mouth renders only its own screen rectangle (view offset on the virtual camera) into a power-of-two target;
// - the visible mouths share a pixel budget weighted by on-screen area (bigger or nearer keep more detail, none below
//   MIN_H px tall; smaller than MIN_PX on screen is a flat tint of the ground colour);
// - targets only grow, or shrink when they are less than 60% of what is wanted, so the quality steps down without popping;
// - a frame re-renders at most MAX_PASSES views, picked by size x time since last drawn (nothing starves), and only while
//   the camera or scene changed (plus SETTLE frames, for text and hover animations that land late);
// - off-screen and from-behind mouths cost nothing; the pass leaves out text (layer 1) and reuses the main shadow map.
const PIXEL_BUDGET = 2 * 400 * 600 // pixels of render target shared by all visible portals: two full-size mouth views
const MAX_PASSES = 4 // portal views drawn per frame
const MIN_PX = 24 // smaller than this on screen: a tint
const MIN_H = 64 // no target is shorter than this
const SETTLE = 45 // frames to keep drawing after something changed

const mouthMat = (bg: string) => new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, rect: { value: new THREE.Vector4() }, tint: { value: new THREE.Color(bg) }, plain: { value: 1 } },
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  // the target is sRGB, so sampling decodes to linear; encode back on output or the view comes out too dark.
  // The texture holds only the mouth's screen rectangle `rect` (x, y, w, h in drawing-buffer pixels).
  fragmentShader: `uniform sampler2D tex; uniform vec4 rect; uniform vec3 tint; uniform float plain;
void main() {
  vec2 uv = (gl_FragCoord.xy - rect.xy) / rect.zw;
  gl_FragColor = plain > 0.5 ? vec4(tint, 1.0) : texture2D(tex, clamp(uv, 0.0, 1.0));
#include <colorspace_fragment>
}`,
})

const HALF_W = 0.24, HALF_H = 0.35 // the oval's half extents plus the ring, in world units
const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)))

interface Mouth {
  pos: THREE.Vector3; face: THREE.Vector3; side: THREE.Vector3; shift: THREE.Vector3; plane: THREE.Plane
  mat: THREE.ShaderMaterial; mesh: THREE.Mesh | null; rt: THREE.WebGLRenderTarget | null
  rect: number[]; area: number; on: boolean; plain: boolean; pending: boolean; last: number; hidden: number
}
export interface PortalStats { visible: number; tinted: number; passes: number; rendered: number; avgPx: number; fullPx: number; px: number[] }

// A pair sits on one straight segment facing apart (a faces back along the line, b forward), so the view
// through a is the main camera shifted by (b - a), clipped at b's plane; and the reverse for b. Any axis, either way.
// `deps` changes whenever something in the scene moved (the plans, the hover).
export function PortalSystem({ pairs, deps }: { pairs: PortalPair[]; deps: unknown[] }) {
  const th = useTheme()
  const PORTAL = th.edge.portal
  const { gl, scene, camera } = useThree()
  const size = useMemo(() => new THREE.Vector2(), [])
  const virt = useMemo(() => new THREE.PerspectiveCamera(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const st = useRef({ cam: '', deps: [] as unknown[], settle: SETTLE, frame: 0 })
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const mouths = useMemo<Mouth[]>(() => pairs.flatMap(pair => {
    const d = new THREE.Vector3(pair.dir[0], 0, pair.dir[1])
    const a = v3(pair.a), b = v3(pair.b)
    const side = (f: THREE.Vector3) => new THREE.Vector3(-f.z, 0, f.x)
    const base = { mesh: null, rt: null, rect: [0, 0, 0, 0], area: 0, on: false, plain: true, pending: true, last: -1e9, hidden: 0 }
    return [
      { ...base, mat: mouthMat(th.ground.bg), pos: a, face: d.clone().negate(), side: side(d.clone().negate()), shift: b.clone().sub(a), plane: new THREE.Plane(d.clone(), -d.dot(b)) },
      { ...base, mat: mouthMat(th.ground.bg), pos: b, face: d.clone(), side: side(d), shift: a.clone().sub(b), plane: new THREE.Plane(d.clone().negate(), d.dot(a)) },
    ] as Mouth[]
  }), [pairs, th.ground.bg])
  useEffect(() => { st.current.settle = SETTLE; return () => mouths.forEach(m => { m.rt?.dispose(); m.mat.dispose() }) }, [mouths])

  useFrame(() => {
    const s = st.current
    s.frame++
    gl.getDrawingBufferSize(size)
    const W = size.x, H = size.y
    const e = camera.matrixWorld.elements
    const sig = `${W}x${H}|${(camera as THREE.PerspectiveCamera).fov}|${e[12].toFixed(4)},${e[13].toFixed(4)},${e[14].toFixed(4)}|${e[0].toFixed(5)},${e[4].toFixed(5)},${e[8].toFixed(5)},${e[1].toFixed(5)},${e[5].toFixed(5)},${e[9].toFixed(5)}`
    const moved = sig !== s.cam || deps.length !== s.deps.length || deps.some((d, i) => d !== s.deps[i])
    if (moved) { s.cam = sig; s.deps = deps; s.settle = SETTLE }
    const settling = s.settle > 0
    if (settling) { s.settle--; mouths.forEach(m => { m.pending = true }) }
    if (!settling && !mouths.some(m => m.pending)) return // nothing changed: the last textures stand

    // 1. where each mouth is on screen
    const vis: Mouth[] = []
    for (const m of mouths) {
      const mesh = m.mesh
      const front = m.face.dot(tmp.copy(camera.position).sub(m.pos)) > 0
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        tmp.copy(m.pos).addScaledVector(m.side, su * HALF_W); tmp.y += sv * HALF_H
        tmp.project(camera)
        const px = (tmp.x * 0.5 + 0.5) * W, py = (tmp.y * 0.5 + 0.5) * H
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
      }
      m.on = front && x1 > 0 && x0 < W && y1 > 0 && y0 < H
      if (mesh) mesh.visible = m.on // from behind the solid back shows; off screen nothing shows
      if (!m.on) { m.pending = false; m.hidden++; if (m.hidden > 120 && m.rt) { m.rt.dispose(); m.rt = null } continue }
      m.hidden = 0
      m.plain = Math.max(x1 - x0, y1 - y0) < MIN_PX
      m.mat.uniforms.plain.value = m.plain ? 1 : 0
      if (m.plain) { m.pending = false; continue }
      const rx = Math.max(0, Math.floor(x0) - 2), ry = Math.max(0, Math.floor(y0) - 2)
      m.rect = [rx, ry, Math.min(W, Math.ceil(x1) + 2) - rx, Math.min(H, Math.ceil(y1) + 2) - ry]
      m.area = m.rect[2] * m.rect[3]
      m.mat.uniforms.rect.value.set(m.rect[0], m.rect[1], m.rect[2], m.rect[3])
      vis.push(m)
    }

    // 2. each visible mouth's share of the pixel budget, by area^1.5; its target grows, or shrinks only well below what it needs
    const wsum = vis.reduce((a, m) => a + m.area ** 1.5, 0)
    for (const m of vis) {
      const share = wsum > 0 ? PIXEL_BUDGET * (m.area ** 1.5) / wsum : PIXEL_BUDGET
      const px = Math.min(m.area, share)
      const k = Math.sqrt(px / m.area)
      let tw = m.rect[2] * k, th = m.rect[3] * k
      if (th < MIN_H) { const f = Math.min(MIN_H / th, m.rect[3] / th); tw *= f; th *= f }
      const cw = m.rt?.width ?? 0, ch = m.rt?.height ?? 0
      if (!m.rt || tw > cw || th > ch || (tw < cw * 0.6 && th < ch * 0.6)) {
        const nw = pow2(tw), nh = pow2(th)
        if (!m.rt || nw !== cw || nh !== ch) {
          m.rt?.dispose()
          m.rt = new THREE.WebGLRenderTarget(nw, nh, { samples: 2 })
          m.rt.texture.colorSpace = THREE.SRGBColorSpace
          m.mat.uniforms.tex.value = m.rt.texture
          m.pending = true
        }
      }
    }

    // 3. draw at most MAX_PASSES views: the largest and longest-waiting first
    const todo = vis.filter(m => m.pending && m.rt).sort((a, b) => b.area * (s.frame - b.last) - a.area * (s.frame - a.last)).slice(0, MAX_PASSES)
    if (todo.length) {
      const autoShadows = gl.shadowMap.autoUpdate
      const was = gl.getRenderTarget()
      gl.localClippingEnabled = true
      // reuse the shadow map from the main render: re-rendering it here would apply the clipping plane to it
      gl.shadowMap.autoUpdate = false
      for (const m of mouths) if (m.mesh) m.mesh.visible = false
      for (const m of todo) {
        const [rx, ry, rw, rh] = m.rect
        virt.copy(camera as THREE.PerspectiveCamera)
        virt.layers.set(0) // no text
        virt.position.add(m.shift); virt.updateMatrixWorld()
        virt.setViewOffset(W, H, rx, H - ry - rh, rw, rh)
        gl.clippingPlanes = [m.plane]
        gl.setRenderTarget(m.rt); gl.render(scene, virt)
        m.pending = false; m.last = s.frame
      }
      gl.clippingPlanes = []; gl.setRenderTarget(was); gl.shadowMap.autoUpdate = autoShadows
      for (const m of mouths) if (m.mesh) m.mesh.visible = m.on
    }
    const stats: PortalStats = {
      visible: vis.length, tinted: mouths.filter(m => m.on && m.plain).length, passes: todo.length,
      rendered: mouths.filter(m => m.on && !m.plain && !m.pending).length,
      avgPx: vis.length ? vis.reduce((a, m) => a + (m.rt ? m.rt.width * m.rt.height : 0), 0) / vis.length : 0,
      fullPx: vis.length ? vis.reduce((a, m) => a + m.area, 0) / vis.length : 0,
      px: vis.map(m => (m.rt ? m.rt.width : 0) * 10000 + (m.rt ? m.rt.height : 0)),
    }
    ;(gl.domElement as unknown as { __portals?: PortalStats }).__portals = stats
  })

  return <>{mouths.map((m, i) => (
    <group key={i} position={m.pos} rotation={[0, Math.atan2(-m.face.z, m.face.x), 0]} scale={[1, 1.5, 1]}>
      <mesh castShadow rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.2, 0.03, 10, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
      <mesh ref={el => { m.mesh = el; refs.current[i] = el }} material={m.mat} position={[0.002, 0, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /></mesh>
      <mesh castShadow position={[-0.03, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
    </group>
  ))}</>
}

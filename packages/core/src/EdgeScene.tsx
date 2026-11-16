// Draws an EdgePlan: the line in parts, tunnel holes and portals. Portals follow the game: looking into one you
// see out of the other, solid from behind. Decisions: LOG.md, "How edges sit in 3D (BON-85)".
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line, Text } from '@react-three/drei'
import type { EdgePlan, P3, PortalPair } from './edges3d.ts'
import { SCENE } from './palette'
import type { LabelMode } from './model'

const PORTAL = '#3fa7ff'
const v3 = ([x, z, y]: P3) => new THREE.Vector3(x, y, z)

export function Edge({ plan, label, labelMode }: { plan: EdgePlan; label?: string; labelMode: LabelMode }) {
  const parts = plan.parts.map(p => p.map(v3))
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
      {lines.map((l, i) => <Line key={i} points={l.map(p => p.toArray() as [number, number, number])} color={SCENE.edge} lineWidth={2} />)}
      <mesh position={tip.clone().addScaledVector(dir, -0.2)} quaternion={quat}>
        <coneGeometry args={[0.13, 0.4, 16]} />
        <meshBasicMaterial color={SCENE.edge} />
      </mesh>
      {label && (
        <Text position={[at.x, at.y + (labelMode === 'top' ? 0.02 : 0.4), at.z]} rotation={labelMode === 'top' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} fontSize={0.22} color={SCENE.label} outlineWidth={0.02} outlineColor="#000">{label}</Text>
      )}
    </group>
  )
}

export function Hole({ p }: { p: P3 }) {
  return (
    <group position={[p[0], p[2] + 0.004, p[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><circleGeometry args={[0.13, 24]} /><meshBasicMaterial color="#000" /></mesh>
      <mesh><ringGeometry args={[0.13, 0.17, 24]} /><meshBasicMaterial color="#7f8aa3" /></mesh>
    </group>
  )
}

const mouthMat = () => new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  // the target is sRGB, so sampling decodes to linear; encode back on output or the view comes out too dark
  fragmentShader: 'uniform sampler2D tex; uniform vec2 res; void main() { gl_FragColor = texture2D(tex, gl_FragCoord.xy / res);\n#include <colorspace_fragment>\n}',
})

interface Mouth { pos: THREE.Vector3; face: THREE.Vector3; shift: THREE.Vector3; plane: THREE.Plane }

// A pair sits on one straight segment facing apart (a faces back along the line, b forward), so the view
// through a is the main camera shifted by (b - a), clipped at b's plane; and the reverse for b. Any axis, either way.
export function Portals({ pair }: { pair: PortalPair }) {
  const { gl, scene, camera } = useThree()
  const mats = useMemo(() => [mouthMat(), mouthMat()], [])
  const targets = useRef<(THREE.WebGLRenderTarget | null)[]>([null, null])
  const meshes = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)]
  const size = useMemo(() => new THREE.Vector2(), [])
  const mouths = useMemo<Mouth[]>(() => {
    const d = new THREE.Vector3(pair.dir[0], 0, pair.dir[1])
    const a = v3(pair.a), b = v3(pair.b)
    return [
      { pos: a, face: d.clone().negate(), shift: b.clone().sub(a), plane: new THREE.Plane(d.clone(), -d.dot(b)) },
      { pos: b, face: d.clone(), shift: a.clone().sub(b), plane: new THREE.Plane(d.clone().negate(), d.dot(a)) },
    ]
  }, [pair])

  useFrame(() => {
    gl.getDrawingBufferSize(size)
    const autoShadows = gl.shadowMap.autoUpdate
    const was = gl.getRenderTarget()
    gl.localClippingEnabled = true
    // reuse the shadow map from the main render: re-rendering it here would apply the clipping plane to it
    gl.shadowMap.autoUpdate = false
    meshes.forEach(m => { m.current.visible = false })
    mouths.forEach((m, i) => {
      if (m.face.dot(camera.position.clone().sub(m.pos)) <= 0) return // seen from behind: the solid back shows
      let rt = targets.current[i]
      if (!rt || rt.width !== size.x || rt.height !== size.y) {
        rt?.dispose()
        rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4 })
        rt.texture.colorSpace = THREE.SRGBColorSpace
        targets.current[i] = rt
        mats[i].uniforms.tex.value = rt.texture
      }
      mats[i].uniforms.res.value.copy(size)
      const v = camera.clone(); v.position.add(m.shift); v.updateMatrixWorld()
      gl.clippingPlanes = [m.plane]
      gl.setRenderTarget(rt); gl.render(scene, v)
      meshes[i].current.visible = true
    })
    gl.clippingPlanes = []; gl.setRenderTarget(was); gl.shadowMap.autoUpdate = autoShadows
  })

  return <>{mouths.map((m, i) => (
    <group key={i} position={m.pos} rotation={[0, Math.atan2(-m.face.z, m.face.x), 0]} scale={[1, 1.5, 1]}>
      <mesh castShadow rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.2, 0.03, 10, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
      <mesh ref={meshes[i]} material={mats[i]} position={[0.002, 0, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /></mesh>
      <mesh castShadow position={[-0.03, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><circleGeometry args={[0.2, 40]} /><meshBasicMaterial color={PORTAL} /></mesh>
    </group>
  ))}</>
}

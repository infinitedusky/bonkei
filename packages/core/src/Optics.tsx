// Lazers' pieces: the beam (layered lines), mirrors, periscope boxes, splitters, lens barrels and hit spots. Drawn from the edges' own
// drawn lines (optics.ts), so they follow every re-plan. No bloom and no scene light: the glow is lines, as the trench light is.
import * as THREE from 'three'
import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useTheme } from './look'
import { findBends, type Line as DrawnLine, type V } from './lasers.ts'

const v = (p: V) => new THREE.Vector3(...p)
/** A beam colour as the pieces use it: the beam, its halo, and a white-ish centre. */
export const beamColours = (hex: string, centre: number, halo: string | null) => ({ beam: hex, halo: halo ?? hex, core: '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), centre).getHexString() })
export type Pal = ReturnType<typeof beamColours>

export function Beam({ pts, c, width, centreWidth, haloWidth, haloOpacity }: { pts: V[]; c: Pal; width: number; centreWidth: number; haloWidth: number; haloOpacity: number }) {
  return (
    <>
      <Line points={pts} color={c.halo} lineWidth={haloWidth * 2.3} transparent opacity={haloOpacity * 0.4} depthWrite={false} />
      <Line points={pts} color={c.halo} lineWidth={haloWidth} transparent opacity={haloOpacity} depthWrite={false} />
      <Line points={pts} color={c.beam} lineWidth={width} />
      <Line points={pts} color={c.core} lineWidth={centreWidth} />
    </>
  )
}

// A plate on a bend: its face normal is (b - a), it spans (a + b) and the hinge. Basis is right-handed: (a + b) x (b x a) = b - a.
function Mirror({ at, a, b, c, size }: { at: V; a: V; b: V; c: Pal; size: number }) {
  const th = useTheme().edge.optics
  const q = useMemo(() => {
    const A = v(a), B = v(b)
    const u = A.clone().add(B).normalize(), w = B.clone().cross(A).normalize(), n = B.clone().sub(A).normalize()
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n))
  }, [a, b])
  const upright = Math.abs(v(a).cross(v(b)).normalize().y) > 0.9
  return (
    <group position={at}>
      <group quaternion={q} scale={size}>
        <mesh position={[0, 0, -0.04]}><boxGeometry args={[0.4, 0.32, 0.08]} /><meshStandardMaterial color={th.metal} metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.002]}><planeGeometry args={[0.38, 0.3]} /><meshStandardMaterial color={th.face} metalness={1} roughness={0.08} emissive={th.face} emissiveIntensity={0.3} /></mesh>
      </group>
      {upright && size === 1 && <mesh position={[0, -0.28, 0]}><cylinderGeometry args={[0.025, 0.04, 0.24, 8]} /><meshStandardMaterial color={th.metal} /></mesh>}
      <mesh><sphereGeometry args={[0.05, 12, 12]} /><meshBasicMaterial color={c.core} /></mesh>
      <mesh><sphereGeometry args={[0.12, 12, 12]} /><meshBasicMaterial color={c.halo} transparent opacity={0.3} depthWrite={false} /></mesh>
    </group>
  )
}

// Two bends of a jog in one box: the beam goes in at one window and out at the other.
function Periscope({ from, to, a, c }: { from: V; to: V; a: V; c: Pal }) {
  const th = useTheme().edge.optics
  const p = v(from), q2 = v(to), d = q2.clone().sub(p), L = d.length()
  const quat = useMemo(() => {
    const y = d.clone().normalize(), z = v(a).cross(y).normalize()
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(a).normalize(), y, z))
  }, [from, to, a])
  const mid = p.clone().add(q2).multiplyScalar(0.5)
  return (
    <group position={mid} quaternion={quat}>
      <mesh><boxGeometry args={[0.34, L + 0.3, 0.26]} /><meshStandardMaterial color={th.metal} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[-0.171, -L / 2, 0]} rotation={[0, -Math.PI / 2, 0]}><circleGeometry args={[0.07, 16]} /><meshBasicMaterial color={c.core} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0.171, L / 2, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.07, 16]} /><meshBasicMaterial color={c.core} side={THREE.DoubleSide} /></mesh>
      {[-L / 2, L / 2].map((y, i) => (
        <mesh key={i} position={[0, y, 0.131]} rotation={[0, 0, Math.PI / 4]}><planeGeometry args={[0.3, 0.03]} /><meshBasicMaterial color={th.face} /></mesh>
      ))}
    </group>
  )
}

function Splitter({ at }: { at: V }) {
  const th = useTheme().edge.optics
  return (
    <mesh position={at}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshPhysicalMaterial color={th.glass} transparent opacity={0.3} roughness={0.05} metalness={0.1} depthWrite={false} />
    </mesh>
  )
}

/** Every bend of every drawn line. `lines[i].ci` indexes `pals`. */
export function Optics({ lines, pals, onCount }: { lines: DrawnLine[]; pals: Pal[]; onCount?: (n: { mirrors: number; periscopes: number; splitters: number }) => void }) {
  const th = useTheme().edge.optics
  const bends = useMemo(() => findBends(lines, th.jog), [lines, th.jog])
  useMemo(() => onCount?.({ mirrors: bends.mirrors.length, periscopes: bends.periscopes.length, splitters: bends.splitters.length }), [bends])
  return (
    <>
      {bends.mirrors.map((m, i) => <Mirror key={`m${i}`} {...m} c={pals[m.ci]} />)}
      {bends.periscopes.map((p, i) => <Periscope key={`p${i}`} {...p} c={pals[p.ci]} />)}
      {bends.splitters.map((s, i) => <Splitter key={`s${i}`} at={s} />)}
    </>
  )
}

// where a beam leaves a node: a lens barrel along the beam, a lit disc at its mouth
export function Barrel({ at, dir, c }: { at: THREE.Vector3; dir: THREE.Vector3; c: Pal }) {
  const th = useTheme().edge.optics
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), [dir])
  return (
    <group position={at} quaternion={q}>
      <mesh position={[0, -0.09, 0]}><cylinderGeometry args={[0.09, 0.09, 0.18, 16]} /><meshStandardMaterial color={th.metal} metalness={0.6} /></mesh>
      <mesh position={[0, 0.001, 0]}><cylinderGeometry args={[0.06, 0.06, 0.01, 16]} /><meshBasicMaterial color={c.beam} /></mesh>
    </group>
  )
}

// where a beam lands: a ring, a lit centre and a faint halo, facing the beam (the hit spot that replaces the arrowhead)
export function HitSpot({ at, dir, c }: { at: THREE.Vector3; dir: THREE.Vector3; c: Pal }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize().negate()), [dir])
  return (
    <group position={at} quaternion={q}>
      <mesh><ringGeometry args={[0.1, 0.14, 24]} /><meshBasicMaterial color={c.beam} side={THREE.DoubleSide} /></mesh>
      <mesh><circleGeometry args={[0.06, 16]} /><meshBasicMaterial color={c.core} side={THREE.DoubleSide} /></mesh>
      <mesh><circleGeometry args={[0.26, 24]} /><meshBasicMaterial color={c.halo} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

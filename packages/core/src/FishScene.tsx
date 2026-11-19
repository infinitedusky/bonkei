import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import type { FishLayout, FishRod } from './fish'
import type { Box } from './model'
import { NodeBody, Label, type LabelMode } from './shapes'
import { S } from './scale'
import { useTheme, Mat } from './look'

const LINE_Y = [0.34, 0.3, 0.26, 0.2, 0.16] // by depth: the spine highest, deeper lines lower, plugging into their pills
const lineY = (depth: number) => LINE_Y[Math.min(depth, LINE_Y.length - 1)]
const pillH = (depth: number) => Math.max(0.12, 0.4 - 0.1 * (depth - 2)) // a cause's height: lower the deeper it goes

// the theme's line, with an arrowhead where it joins what it causes; the spine and bones heavier
function Rod({ r, wx, wz }: { r: FishRod; wx: (x: number) => number; wz: (z: number) => number }) {
  const th = useTheme()
  const y = lineY(r.depth), from = new THREE.Vector3(wx(r.a[0]), y, wz(r.a[1])), to = new THREE.Vector3(wx(r.b[0]), y, wz(r.b[1]))
  const dir = to.clone().sub(from).normalize()
  const cl = r.depth === 0 ? 0.45 : r.depth === 1 ? 0.38 : 0.26, cr = r.depth === 0 ? 0.14 : r.depth === 1 ? 0.12 : 0.08
  const end = to.clone().addScaledVector(dir, -cl * 0.8)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  const width = th.edge.width * (r.depth === 0 ? 2.2 : r.depth === 1 ? 1.6 : 1)
  return (
    <group>
      <Line points={[from.toArray(), end.toArray()]} color={th.edge.color} lineWidth={width} />
      <mesh position={to.clone().addScaledVector(dir, -cl / 2)} quaternion={q}><coneGeometry args={[cr, cl, 14]} /><meshBasicMaterial color={th.edge.color} /></mesh>
    </group>
  )
}

// The effect: a fish's head in plan, extruded. A flat back where the spine meets it, gill plates swelling past the back, a blunt snout;
// a gill line across the top and an eye near the snout. The theme's diamond colour, the label on top.
function FishHead({ h: p, wx, wz, labelMode }: { h: FishLayout['head']; wx: (x: number) => number; wz: (z: number) => number; labelMode: LabelMode }) {
  const th = useTheme()
  const w = p.w * S, hd = (p.h * S) / 2, h = 1.3, x0 = -w / 2, x1 = w / 2
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
    <group position={[wx(p.x), 0, wz(p.y)]}>
      <mesh geometry={geo} castShadow={th.light.shadows} receiveShadow={th.light.shadows}><Mat color={color} roughness={0.5} /></mesh>
      <mesh geometry={gill} position={[0, h + 0.005, 0]}><Mat color={dark} roughness={0.6} /></mesh>
      <mesh position={[w * 0.3, h + 0.03, -hd * 0.42]}><cylinderGeometry args={[0.17, 0.17, 0.06, 24]} /><Mat color="#2a1520" roughness={0.3} /></mesh>
      <mesh position={[w * 0.3 - 0.05, h + 0.04, -hd * 0.47]}><cylinderGeometry args={[0.05, 0.05, 0.07, 12]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <group position={[w * 0.04, 0, hd * 0.08]}><Label text={p.label} mode={labelMode} y={h + 0.02} size={0.5} maxWidth={w * 0.62} role="node" /></group>
    </group>
  )
}

export function FishScene({ data, labelMode }: { data: FishLayout; labelMode: LabelMode }) {
  const th = useTheme()
  const land = th.node.form === 'landscape' // its forms and label plates stand up facing the camera: squashing a pill would skew them
  const W = data.width, H = data.height
  const wx = (x: number) => (x - W / 2) * S, wz = (y: number) => (y - H / 2) * S
  return (
    <group>
      {data.rods.map((r, i) => <Rod key={'r' + i} r={r} wx={wx} wz={wz} />)}
      <FishHead h={data.head} wx={wx} wz={wz} labelMode={labelMode} />
      {data.pieces.map((p, i) => {
        const b: Box = { id: String(i), label: p.label, kind: 'node', shape: p.kind === 'cat' ? 'rect' : 'round', x: 0, y: 0, w: p.w, h: p.h, level: 0 }
        // a cause is a pill, scaled down in height by its depth (its label stays on its top); in a landscape theme it is smaller by depth instead
        const k = p.kind === 'cat' || land ? 1 : pillH(p.depth) / 0.7
        return <group key={i} position={[wx(p.x), 0, wz(p.y)]} scale={[1, k, 1]}><NodeBody b={b} labelMode={labelMode} /></group>
      })}
    </group>
  )
}

// The stage (BON-253): a loaded glTF scene drawn as it was exported, under the theme's lights, with a name for each named part.
// Six ways to show the names (`labels`): top and billboard as on any diagram, base (on the floor at the part's foot, both long
// sides), sign (a floating arrow board over the part, the default for a stage) and diamond (a spinning plumbob with the name standing on it); sign and diamond names are capital letters in a column; zone is Cloud Cartography's floor and ground title.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { StageLayout, StagePart } from './stage.ts'
import { GroundTitle, Label, mixc, rounded } from './shapes'
import { zoneOf, hasZone, type Zone as ZoneRect } from './stageZones'
import { PlateText, fontUrl, useTheme } from './look'
import { S, TEXT_LAYER } from './scale'
import type { StageLabelMode } from './model'

// The name lying on the floor just outside the footprint, on both long sides, each reading from outside towards the part.
function BaseLabels({ p }: { p: StagePart }) {
  const th = useTheme()
  const hw = (p.w * S) / 2, hd = (p.h * S) / 2
  const alongX = hw >= hd
  const off = 0.5, long = Math.max(2.4, 2 * (alongX ? hw : hd))
  const sides: [number, number, number][] = alongX
    ? [[p.cx, p.cz + hd + off, 0], [p.cx, p.cz - hd - off, Math.PI]]
    : [[p.cx + hw + off, p.cz, Math.PI / 2], [p.cx - hw - off, p.cz, -Math.PI / 2]]
  return (
    <>
      {sides.map(([x, z, yaw], i) => (
        <group key={i} position={[x, 0.1, z]} rotation={[0, yaw, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <PlateText text={p.label} plate={th.label.node} font={fontUrl(th)} fontSize={0.4} maxWidth={long} outline />
          </group>
        </group>
      ))}
    </>
  )
}

// The name as the floating styles show it: in capitals (display only: the part's name and matching are as written), either a column of
// upright letters read top to bottom (`stacked`, a space is a gap in the column) or the whole word turned on its side, read bottom to top
// (`side`, like a book spine). Either way a narrow tall column; the letters shrink a little for a long name.
type Letters = 'stacked' | 'side'
function useColumn(label: string, letters: Letters) {
  const caps = label.trim().toUpperCase()
  const chars = [...caps]
  const size = letters === 'stacked' ? Math.min(0.36, 4 / Math.max(chars.length, 1)) : Math.min(0.4, 4 / Math.max(chars.length * 0.68, 1))
  const text = letters === 'stacked' ? chars.map(c => (c === ' ' ? ' ' : c)).join('\n') : caps
  const [measured, setMeasured] = useState<number | null>(null) // the word's length when set on its side
  const length = letters === 'stacked' ? chars.length * size : measured ?? chars.length * size * 0.68
  const onSync = (t: any) => {
    const r = t.textRenderInfo?.blockBounds
    if (letters === 'side' && r) setMeasured(m => (m !== null && Math.abs(m - (r[2] - r[0])) < 1e-3 ? m : r[2] - r[0]))
  }
  return { text, size, length, onSync, side: letters === 'side' }
}

const lum = (c: string) => { const k = new THREE.Color(c); return 0.299 * k.r + 0.587 * k.g + 0.114 * k.b }
const dim = (m: any) => { if (m) { m.depthTest = false; m.depthWrite = false } } // drawn over the model: a name inside walls can still be read

// A thin line from a floating name straight down to the top of its part, ending in a ring on it: which structure the name is for.
function Leader({ from, color }: { from: number; color: string }) {
  const pts = useMemo<[number, number, number][]>(() => [[0, from, 0], [0, 0.03, 0]], [from])
  return (
    <group>
      <Line points={pts} color={color} lineWidth={1.4} transparent opacity={0.75} depthTest={false} renderOrder={9} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[0.09, 0.16, 20]} /><meshBasicMaterial ref={dim} color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  )
}

// A sign-spinner's arrow board: a tall narrow board with the name on it, its point down at the part, hovering above its top and
// facing the camera (so it reads in flat, iso and 3D), bobbing gently, a leader line from its point to the part.
function Sign({ p, i, letters, plain = false }: { p: StagePart; i: number; letters: Letters; plain?: boolean }) {
  const th = useTheme()
  const bob = useRef<THREE.Group>(null!)
  const col = useColumn(p.label, letters)
  const W = (col.side ? col.size * 1.5 : col.size * 1.9) + 0.2, H = col.length + 0.3, A = 0.4, T = W * 0.28
  const hover = 0.9
  const [board, rim] = useMemo(() => {
    const shape = (g: number) => {
      const s = new THREE.Shape()
      s.moveTo(-W / 2 - g, -g); s.lineTo(-T - g, -g); s.lineTo(0, -A - g * 1.6); s.lineTo(T + g, -g); s.lineTo(W / 2 + g, -g)
      s.lineTo(W / 2 + g, H + g); s.lineTo(-W / 2 - g, H + g); s.closePath()
      return new THREE.ShapeGeometry(s)
    }
    return [shape(0), shape(0.07)]
  }, [W, H])
  const plate = th.label.node
  // a bright board whose lettering contrasts with it: the theme's own cartouche plate, else its edge-label colour
  const fill = plate.style === 'plain' ? th.edge.label : plate.plate
  const ink = lum(fill) > 0.55 ? '#1b1b1b' : '#ffffff'
  useFrame(({ clock }) => { if (bob.current) bob.current.position.y = Math.sin(clock.elapsedTime * 1.6 + i * 1.3) * 0.08 })
  return (
    <group position={[p.cx, p.top, p.cz]}>
      <Leader from={hover + 0.1} color={fill} />
      <group position={[0, hover + A, 0]}>
        <group ref={bob}>
          <Billboard>
            {!plain && <mesh geometry={rim} renderOrder={10} layers={TEXT_LAYER as any}><meshBasicMaterial ref={dim} color="#1b1b1b" toneMapped={false} /></mesh>}
            {!plain && <mesh geometry={board} position={[0, 0, 0.01]} renderOrder={11} layers={TEXT_LAYER as any}><meshBasicMaterial ref={dim} color={fill} toneMapped={false} /></mesh>}
            <Text layers={TEXT_LAYER as any} renderOrder={12} position={[0, H / 2, 0.02]} rotation={[0, 0, col.side ? Math.PI / 2 : 0]} font={fontUrl(th)} fontSize={col.size} lineHeight={1} color={plain ? th.label.node.text : ink}
              outlineWidth={plain ? 0.04 : 0} outlineColor="#000" 
              anchorX="center" anchorY="middle" textAlign="center" onSync={(t: any) => { dim(t.material); col.onSync(t) }}>{col.text}</Text>
          </Billboard>
        </group>
      </group>
    </group>
  )
}

// A Sims-style plumbob: a faceted double pyramid in plumbob green, slowly turning and bobbing over the part, its name standing on it
// as a column, a leader line from its lower tip to the part.
function Diamond({ p, i, letters }: { p: StagePart; i: number; letters: Letters }) {
  const th = useTheme()
  const col = useColumn(p.label, letters)
  const spin = useRef<THREE.Group>(null!), bob = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (spin.current) spin.current.rotation.y = t * 0.9 + i
    if (bob.current) bob.current.position.y = Math.sin(t * 1.6 + i * 1.3) * 0.1
  })
  return (
    <group position={[p.cx, p.top, p.cz]}>
      <Leader from={0.78} color="#3fd04a" />
      <group ref={bob}>
        <group ref={spin} position={[0, 1.35, 0]} scale={[0.42, 0.62, 0.42]}>
          <mesh renderOrder={10}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial ref={dim} color="#3fd04a" emissive="#1c9a2a" emissiveIntensity={0.7} flatShading roughness={0.35} /></mesh>
        </group>
        <Billboard position={[0, 2.1, 0]}>
          <Text layers={TEXT_LAYER as any} renderOrder={12} font={fontUrl(th)} fontSize={col.size} lineHeight={1} color={th.label.node.text}
            rotation={[0, 0, col.side ? Math.PI / 2 : 0]} outlineWidth={0.03} outlineColor="#000" anchorX={col.side ? 'left' : 'center'} anchorY={col.side ? 'middle' : 'bottom'} textAlign="center"
            onSync={(t: any) => { dim(t.material); col.onSync(t) }}>{col.text}</Text>
        </Billboard>
      </group>
    </group>
  )
}

// A zone under the part, as Cloud Cartography draws one: a rounded floor tinted from the theme's zone palette (each part its own colour),
// a rim line in the zone colour, and the part's name in big capitals in the ground font lying on it, front-left. The floor is the part's
// footprint plus a margin and a strip in front of it that is the room the name lies in (stageZones.ts), so no part stands on its own name.
const ZONE_T = 0.1 // the zone's floor reaches 0.1 above the base: above a model's own floor (about 0.05) wherever there is one
function Zone({ p, i, z }: { p: StagePart; i: number; z: ZoneRect }) {
  const th = useTheme()
  const color = th.tray.zones[i % th.tray.zones.length]
  const { w, h, fit } = z
  const r = Math.min(th.tray.radius || 0.5, w / 2, h / 2)
  const top = ZONE_T + i * 0.004 // overlapping zones do not share a plane
  const geo = useMemo(() => new THREE.ExtrudeGeometry(rounded(w, h, r), { depth: top, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2), [w, h, r, top])
  const rim = useMemo(() => rounded(w, h, r).getPoints(8).map(q => [q.x, top + 0.002, -q.y] as [number, number, number]), [w, h, r, top])
  return (
    <group position={[(z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={mixc(color, '#ffffff', th.tray.zoneMix[0])} roughness={0.9} />
      </mesh>
      <Line points={[...rim, rim[0]]} color={color} lineWidth={1.5} />
      <GroundTitle fit={fit} w={w} h={h} T={top} left back={false} color={mixc(color, '#000000', th.tray.groundInk)} fontKey={th.tray.groundFont ?? 'archivo'} x={z.titleX} />
    </group>
  )
}

// The floor grown under the model where a zone would run past it: the theme's own tray floor, its top level with the bottom of the model.
function Base({ r }: { r: { x0: number; x1: number; z0: number; z1: number } }) {
  const th = useTheme()
  const w = r.x1 - r.x0, h = r.z1 - r.z0, T = th.tray.thickness
  const geo = useMemo(() => new THREE.ExtrudeGeometry(rounded(w, h, Math.min(th.tray.radius || 0.4, w / 2, h / 2)), { depth: T, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2), [w, h, T, th.tray.radius])
  return <mesh geometry={geo} position={[(r.x0 + r.x1) / 2, -T, (r.z0 + r.z1) / 2]}><meshStandardMaterial color={th.tray.colors[0]} roughness={0.9} /></mesh>
}

export function StageScene({ data, labelMode, letters = 'stacked' }: { data: StageLayout; labelMode: StageLabelMode; letters?: Letters }) {
  // the model's geometry and materials are ours to free when the stage is replaced
  useEffect(() => () => {
    data.model.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry?.dispose()
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat?.dispose()
    })
  }, [data])
  const labels = (p: StagePart, i: number) => {
    const z = zoneOf(p, data.blockers)
    if (labelMode === 'base') return <BaseLabels key={p.id} p={p} />
    if (labelMode === 'sign') return <Sign key={p.id} p={p} i={i} letters={letters} />
    if (labelMode === 'diamond') return <Diamond key={p.id} p={p} i={i} letters={letters} />
    if (labelMode === 'zone' || labelMode === 'auto') return hasZone(labelMode, z) ? <Zone key={p.id} p={p} i={i} z={z} /> : <Sign key={p.id} p={p} i={i} letters={letters} plain />
    return (
      <group key={p.id} position={[p.cx, p.top, p.cz]}>
        <Label text={p.label} mode={labelMode} y={0.08} size={0.36} maxWidth={Math.max(2.4, p.w / 40)} role="node" />
      </group>
    )
  }
  return (
    <group position={[data.ox ?? 0, 0, data.oz ?? 0]}>
      {data.base && <Base r={data.base} />}
      <primitive object={data.model} />
      {data.parts.map(labels)}
    </group>
  )
}

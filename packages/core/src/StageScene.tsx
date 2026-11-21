// The stage (BON-253): a loaded glTF scene drawn as it was exported, under the theme's lights, and each named part marked: a flat
// shaded zone under it, its name lettered on the zone, else on the part's own sides, else floating above it with a line down
// (stageZones.ts decides which). A chunk of its own, fetched with the first stage's model (stage.ts drawStage imports it); SceneView renders what the stage brought.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Billboard, Line, Text } from '@react-three/drei'
import type { StageLayout, StagePart } from './stage.ts'
import { mixc, rounded } from './shapes'
import { FLOAT_HOVER as HOVER, FLOAT_SIZE, TITLE_INSET, type SideName, type Zone as ZoneRect } from './stageZones.ts'
import { GROUND } from './titles.ts'
import { fontOf, useTheme } from './look'
import { TEXT_LAYER } from './scale'
import type { Mode } from './camera'

const STAGE_FONT = 'archivo' // a stage's names, whatever the theme: the zone titles' heavy capitals, which read at a distance
const zoneColor = (th: ReturnType<typeof useTheme>, i: number) => th.tray.zones[i % th.tray.zones.length]
// drawn over the model: a floating name for a part inside walls can still be read
const overAll = (m: THREE.Material | null) => { if (m) { m.depthTest = false; m.depthWrite = false } }

// A floating name: the part's name in capitals, one letter under another (a gap for a space), facing the camera over the part,
// with a thin line straight down to a ring on the part's top: which part it names.
function FloatingName({ p, i }: { p: StagePart; i: number }) {
  const th = useTheme()
  const chars = [...p.label.trim().toUpperCase()]
  const color = zoneColor(th, i)
  const line = useMemo<[number, number, number][]>(() => [[0, HOVER, 0], [0, 0.03, 0]], [])
  return (
    <group position={[p.cx, p.top, p.cz]}>
      <Line points={line} color={color} lineWidth={1.4} transparent opacity={0.85} depthTest={false} renderOrder={9} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[0.09, 0.16, 20]} /><meshBasicMaterial ref={overAll} color={color} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <Billboard position={[0, HOVER + 0.1, 0]}>
        <Text layers={TEXT_LAYER as any} renderOrder={12} font={fontOf(STAGE_FONT)} fontSize={FLOAT_SIZE} lineHeight={1} color="#ffffff"
          outlineWidth={FLOAT_SIZE * 0.1} outlineColor={mixc(color, '#000000', 0.6)} anchorX="center" anchorY="bottom" textAlign="center"
          onSync={(t: any) => overAll(t.material)}>{chars.join('\n')}</Text>
      </Billboard>
    </group>
  )
}

// The name written on the part's own two faces (front and back, or right and left): white capitals with a dark edge in the part's zone colour.
function SideText({ i, s }: { i: number; s: SideName }) {
  const th = useTheme()
  const edge = mixc(zoneColor(th, i), '#000000', 0.55)
  return (
    <>
      {s.faces.map((f, k) => (
        <Text key={k} position={f.at} rotation={[0, f.rot, 0]} font={fontOf(STAGE_FONT)} fontSize={s.size} lineHeight={1.1} textAlign="center" anchorX="center" anchorY="middle"
          color="#ffffff" letterSpacing={0.04} outlineWidth={s.size * 0.09} outlineColor={edge} layers={TEXT_LAYER as any}>{s.lines.join('\n')}</Text>
      ))}
    </>
  )
}

// A part's zone: a rounded flat area tinted from the theme's zone palette (each part its own colour) with a rim line, and the name in big
// capitals lying on its strip when it fits there. The title is never scaled: stageZones.ts sized the zone for it.
const ZONE_T = 0.1 // the zone's top, above a model's own floor (about 0.05 thick) wherever there is one
function Zone({ i, z }: { i: number; z: ZoneRect }) {
  const th = useTheme()
  const color = zoneColor(th, i)
  const { w, h } = z
  const r = Math.min(th.tray.radius || 0.5, w / 2, h / 2)
  const top = ZONE_T + i * 0.004 // two zones never share a plane
  const geo = useMemo(() => new THREE.ExtrudeGeometry(rounded(w, h, r), { depth: top, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2), [w, h, r, top])
  useEffect(() => () => geo.dispose(), [geo])
  const rim = useMemo(() => { const pts = rounded(w, h, r).getPoints(8).map(q => [q.x, top + 0.002, -q.y] as [number, number, number]); return [...pts, pts[0]] }, [w, h, r, top])
  const t = z.title
  const lines = t ? t.lines.length : 0
  // the title's baseline: the strip in front of the part (the zone's +z end) or behind it
  const tz = t ? (z.side === 'front' ? h / 2 - TITLE_INSET : -h / 2 + TITLE_INSET + t.size * GROUND.line * lines) : 0
  return (
    <group position={[(z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2]}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={mixc(color, '#ffffff', th.tray.zoneMix[0])} roughness={0.9} />
      </mesh>
      <Line points={rim} color={color} lineWidth={1.5} />
      {t && (
        <Text position={[z.titleX, top + 0.004, tz]} rotation={[-Math.PI / 2, 0, 0]} font={fontOf(STAGE_FONT)} fontSize={t.size} letterSpacing={0.04}
          lineHeight={lines > 1 ? GROUND.line : undefined} textAlign="left" anchorX="left" anchorY="bottom" color={mixc(color, '#000000', th.tray.groundInk)}
          fillOpacity={0.85} layers={TEXT_LAYER as any}>{t.lines.join('\n')}</Text>
      )}
    </group>
  )
}

// A floor in the theme's tray style under a model that has none of its own, where a zone would run past the model.
function Base({ r }: { r: { x0: number; x1: number; z0: number; z1: number } }) {
  const th = useTheme()
  const w = r.x1 - r.x0, h = r.z1 - r.z0, T = th.tray.thickness
  const geo = useMemo(() => new THREE.ExtrudeGeometry(rounded(w, h, Math.min(th.tray.radius || 0.4, w / 2, h / 2)), { depth: T, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2), [w, h, T, th.tray.radius])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} position={[(r.x0 + r.x1) / 2, -T, (r.z0 + r.z1) / 2]} receiveShadow><meshStandardMaterial color={th.tray.colors[0]} roughness={0.9} /></mesh>
}

export function StageScene({ data, mode }: { data: StageLayout; mode: Mode }) {
  // the model's geometry and materials are ours to free when the stage is replaced
  useEffect(() => () => {
    data.model.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry?.dispose()
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat?.dispose()
    })
  }, [data])
  // the model's own floor, stretched (the same mesh and material) to the extent the zones need; as exported when none needs it
  useLayoutEffect(() => {
    const f = data.floor
    if (!f) return
    const to = data.floorTo ?? f.rect, cur = f.rect, off = data.model.position, u = data.model.scale
    const sx = (to.x1 - to.x0) / (cur.x1 - cur.x0), sz = (to.z1 - to.z0) / (cur.z1 - cur.z0)
    // the group sits in the model's own frame, which is the world's shifted by the model's position and scaled by its scale (a model in millimetres)
    f.group.scale.set(sx, 1, sz)
    f.group.position.set(((to.x0 + to.x1) / 2 - sx * (cur.x0 + cur.x1) / 2 + (sx - 1) * off.x) / u.x, 0, ((to.z0 + to.z1) / 2 - sz * (cur.z0 + cur.z1) / 2 + (sz - 1) * off.z) / u.z)
    f.group.updateMatrixWorld(true)
  }, [data.floor, data.floorTo, data.model])
  return (
    <group position={[data.ox ?? 0, 0, data.oz ?? 0]}>
      {data.base && <Base r={data.base} />}
      <primitive object={data.model} />
      {data.parts.map((p, i) => {
        const z = data.zones?.[i] ?? null, side = data.sides?.[i] ?? null
        return (
          <group key={p.id}>
            {z && <Zone i={i} z={z} />}
            {side && <SideText i={i} s={side} />}
            {/* named neither on its zone nor on its sides, or seen from above (flat), where its sides cannot be read: a floating name */}
            {!z?.title && (!side || mode === 'flat') && <FloatingName p={p} i={i} />}
          </group>
        )
      })}
    </group>
  )
}

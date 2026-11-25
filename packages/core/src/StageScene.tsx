// The stage (BON-253): a loaded glTF scene drawn as it was exported, under the theme's lights, and each named part's name written on
// its own sides, else floating above it with a line down (stageZones.ts decides which; in flat every part's floats). A chunk of its own,
// fetched with the first stage's model (stage.ts drawStage imports it); SceneView renders what the stage brought.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { StageLayout, StagePart } from './stage.ts'
import { mixc } from './shapes'
import { floatColumn, type SideName } from './stageZones.ts'
import { fontOf, fontUrl, useTheme } from './look'
import { TEXT_LAYER } from './scale'
import type { Mode } from './camera'

// drawn over the model: a floating name for a part inside walls can still be read
const overAll = (m: THREE.Material | null) => { if (m) { m.depthTest = false; m.depthWrite = false } }

// A floating name, as the approved prototype draws it: the part's name in capitals, one letter under another (a gap for a space), in the
// theme's label font and colour with a thin black outline, facing the camera over the part and bobbing gently (each part out of step with
// the next), with a thin line straight down to a ring on the part's top: which part it names. Line and ring are in the theme's
// cartouche colour, or its edge-label colour where its labels have no plate.
function FloatingName({ p, i }: { p: StagePart; i: number }) {
  const th = useTheme()
  const c = floatColumn(p.label)
  const bob = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { bob.current.position.y = Math.sin(clock.elapsedTime * 1.6 + i * 1.3) * 0.08 })
  const plate = th.label.node, color = plate.style === 'plain' ? th.edge.label : plate.plate
  const line = useMemo<[number, number, number][]>(() => [[0, c.line, 0], [0, 0.03, 0]], [c.line])
  return (
    <group position={[p.cx, p.top, p.cz]}>
      <Line points={line} color={color} lineWidth={1.4} transparent opacity={0.75} depthTest={false} renderOrder={9} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[0.09, 0.16, 20]} /><meshBasicMaterial ref={overAll} color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <group position={[0, c.foot, 0]}>
        <group ref={bob}>
          <Billboard>
            <Text layers={TEXT_LAYER as any} renderOrder={12} position={[0, c.h / 2, 0.02]} font={fontUrl(th)} fontSize={c.size} lineHeight={1} color={plate.text}
              outlineWidth={0.04} outlineColor="#000" anchorX="center" anchorY="middle" textAlign="center"
              onSync={(t: any) => overAll(t.material)}>{[...p.label.trim().toUpperCase()].join('\n')}</Text>
          </Billboard>
        </group>
      </group>
    </group>
  )
}

// The name written on the part's own two faces (front and back, or right and left), in the theme's ground-title face (Archivo Black where
// it names none): white capitals over a dark drop shadow (a copy in the part's colour, from the theme's zone palette, darkened, a hair
// lower and to one side, behind), which read on a part of any colour.
function SideText({ i, s }: { i: number; s: SideName }) {
  const th = useTheme()
  const shadow = mixc(th.tray.zones[i % th.tray.zones.length], '#000000', 0.72), d = s.size * 0.09
  const text = { font: fontOf(th.tray.groundFont ?? 'archivo'), fontSize: s.size, lineHeight: 1.1, textAlign: 'center' as const, anchorX: 'center' as const, anchorY: 'middle' as const, letterSpacing: 0.04, layers: TEXT_LAYER as any }
  return (
    <>
      {s.faces.map((f, k) => (
        <group key={k} position={f.at} rotation={[0, f.rot, 0]}>
          <Text {...text} color={shadow} position={[d, -d, -0.004]}>{s.lines.join('\n')}</Text>
          <Text {...text} color="#ffffff" position={[0, 0, 0.002]}>{s.lines.join('\n')}</Text>
        </group>
      ))}
    </>
  )
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
  // the model's own floor, stretched (the same mesh and material) to keep its even padding; as exported when it already has it
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
      <primitive object={data.model} />
      {data.parts.map((p, i) => {
        const side = data.sides?.[i] ?? null
        return (
          <group key={p.id}>
            {side && <SideText i={i} s={side} />}
            {/* too small to be named on its sides, or seen from above (flat), where its sides cannot be read: a floating name */}
            {(!side || mode === 'flat') && <FloatingName p={p} i={i} />}
          </group>
        )
      })}
    </group>
  )
}

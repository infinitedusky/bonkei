// The stage (BON-253): a loaded glTF scene drawn as it was exported, under the theme's lights, with a label over each named part.
import { useEffect } from 'react'
import * as THREE from 'three'
import type { StageLayout } from './stage.ts'
import { Label, type LabelMode } from './shapes'

export function StageScene({ data, labelMode }: { data: StageLayout; labelMode: LabelMode }) {
  // the model's geometry and materials are ours to free when the stage is replaced
  useEffect(() => () => {
    data.model.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry?.dispose()
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat?.dispose()
    })
  }, [data])
  return (
    <>
      <primitive object={data.model} />
      {data.parts.map(p => (
        <group key={p.id} position={[p.cx, p.top, p.cz]}>
          <Label text={p.label} mode={labelMode} y={0.08} size={0.36} maxWidth={Math.max(2.4, p.w / 40)} role="node" />
        </group>
      ))}
    </>
  )
}

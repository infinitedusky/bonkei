import * as THREE from 'three'
import { Line, Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { SeqLayout } from './seq'
import type { Box } from './model'
import { NodeBody, type LabelMode } from './shapes'
import { S } from './scale'
import { useTheme, fontUrl, Mat } from './look'
import { cursorFor, ALL_ON } from './controls'
import type { NodeClick } from './options'

const BLOCK_COL: Record<string, string> = { loop: '#3b6ea8', alt: '#a86b3b', opt: '#4f9a6a', par: '#8a5aa8' }
const LINE_Y = 0.42

function Arrow({ from, to, color, cross }: { from: THREE.Vector3; to: THREE.Vector3; color: string; cross?: boolean }) {
  const th = useTheme()
  const dir = new THREE.Vector3().subVectors(to, from).normalize()
  if (cross) {
    return (
      <group position={to}>
        {[Math.PI / 4, -Math.PI / 4].map(a => (
          <mesh key={a} rotation={[0, a, 0]}><boxGeometry args={[0.36, 0.05, 0.06]} /><meshBasicMaterial color={th.seq.cross} /></mesh>
        ))}
      </group>
    )
  }
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  return (
    <mesh position={to.clone().addScaledVector(dir, -0.2)} quaternion={q}>
      <coneGeometry args={[0.12, 0.4, 14]} /><meshBasicMaterial color={color} />
    </mesh>
  )
}

export function SeqScene({ data, labelMode, onNodeClick, hasClick = !!onNodeClick }: {
  data: SeqLayout; labelMode: LabelMode
  /** Called on a click (not a drag) on a participant box. */
  onNodeClick?: (node: NodeClick) => void
  /** Whether to show the pointer cursor over participants. Default: whether `onNodeClick` is given. */
  hasClick?: boolean
}) {
  const { gl } = useThree()
  const th = useTheme()
  const font = fontUrl(th)
  const W = data.width, H = data.height
  const wx = (x: number) => (x - W / 2) * S, wz = (y: number) => (y - H / 2) * S
  const top = labelMode === 'top'
  const txt = (extra: object) => ({ rotation: top ? ([-Math.PI / 2, 0, 0] as [number, number, number]) : ([0, 0, 0] as [number, number, number]), ...extra })
  return (
    <group>
      {data.parts.map(p => {
        const b: Box = { id: p.id, label: p.label, kind: 'node', shape: p.actor ? 'round' : 'rect', x: p.x, y: p.y, w: p.w, h: p.h, level: 0 }
        return (
          <group key={p.id} position={[wx(p.x) + (p.w * S) / 2, 0, wz(p.y) + (p.h * S) / 2]}
            onClick={e => { if (e.delta < 4) { e.stopPropagation(); onNodeClick?.({ id: p.id, label: p.label, kind: 'participant' }) } }}
            onPointerOver={e => { e.stopPropagation(); gl.domElement.style.cursor = cursorFor('participant', ALL_ON, hasClick) }}
            onPointerOut={() => { gl.domElement.style.cursor = '' }}>
            <NodeBody b={b} labelMode={labelMode} />
          </group>
        )
      })}
      {data.parts.map(p => (
        <Line key={'l' + p.id} points={[[wx(p.cx), 0.03, wz(p.y + p.h)], [wx(p.cx), 0.03, wz(data.lifeEnd)]]} color={th.seq.lifeline} lineWidth={1.5} dashed dashSize={0.25} gapSize={0.18} />
      ))}
      {data.blocks.map((b, i) => {
        const inset = b.level * 6
        const w = (b.x1 - b.x0 - inset * 2) * S, h = (b.y1 - b.y0 - inset) * S, t = 0.12
        const col = BLOCK_COL[b.kind] ?? '#667'
        const cxw = wx((b.x0 + b.x1) / 2), czw = wz((b.y0 + inset + b.y1) / 2)
        return (
          <group key={'b' + i}>
            <mesh position={[cxw, 0.02 + t / 2 + b.level * 0.02, czw]}>
              <boxGeometry args={[w, t, h]} /><Mat color={col} transparent opacity={0.22} depthWrite={false} />
            </mesh>
            <Text {...txt({ position: [wx(b.x0 + inset) + 0.1, 0.17 + b.level * 0.02, wz(b.y0 + inset) + 0.28] })} font={font} fontSize={0.3} anchorX="left" anchorY="middle" color={th.seq.blockText}>{`${b.kind}${b.label ? ' [' + b.label + ']' : ''}`}</Text>
            {b.divs.map((d, k) => (
              <group key={k}>
                <Line points={[[wx(b.x0 + inset), 0.18, wz(d.y)], [wx(b.x1 - inset), 0.18, wz(d.y)]]} color={col} lineWidth={1.5} dashed dashSize={0.2} gapSize={0.15} />
                <Text {...txt({ position: [wx(b.x0 + inset) + 0.1, 0.18, wz(d.y) + 0.26] })} font={font} fontSize={0.26} anchorX="left" color={th.seq.blockSub}>{d.label ? `[${d.label}]` : ''}</Text>
              </group>
            ))}
          </group>
        )
      })}
      {data.acts.map((a, i) => {
        const h = (a.y1 - a.y0) * S
        return (
          <mesh key={'a' + i} position={[wx(a.cx) + a.depth * 0.15, 0.3, wz((a.y0 + a.y1) / 2)]} castShadow={th.light.shadows} receiveShadow={th.light.shadows}>
            <boxGeometry args={[0.3, 0.6, Math.max(h, 0.2)]} /><Mat color={th.seq.activation} roughness={0.5} />
          </mesh>
        )
      })}
      {data.notes.map((n, i) => (
        <group key={'n' + i} position={[wx(n.x + n.w / 2), 0, wz(n.y + n.h / 2)]}>
          <mesh position={[0, 0.1, 0]} castShadow={th.light.shadows} receiveShadow={th.light.shadows}><boxGeometry args={[n.w * S, 0.2, n.h * S]} /><Mat color={th.seq.note} /></mesh>
          <Text {...txt({ position: [0, top ? 0.22 : 0.6, 0] })} font={font} fontSize={0.26} maxWidth={n.w * S - 0.2} color={th.seq.noteText} anchorX="center" anchorY="middle">{n.text}</Text>
        </group>
      ))}
      {data.msgs.map((m, i) => {
        const v = m.pts.map(([x, y]) => new THREE.Vector3(wx(x), LINE_Y, wz(y)))
        const n = v.length
        const dir = new THREE.Vector3().subVectors(v[n - 1], v[n - 2]).normalize()
        const end = v[n - 1].clone().addScaledVector(dir, m.head === 'cross' ? 0 : -0.3)
        const pts = [...v.slice(0, n - 1), end].map(p => p.toArray() as [number, number, number])
        return (
          <group key={'m' + i}>
            <Line points={pts} color={m.head === 'cross' ? th.seq.crossLine : th.edge.color} lineWidth={th.edge.width} dashed={m.dashed} dashSize={0.25} gapSize={0.15} />
            <Arrow from={v[n - 2]} to={v[n - 1]} color={th.edge.color} cross={m.head === 'cross'} />
            <Text {...txt({ position: [wx(m.lx), LINE_Y + (top ? 0.02 : 0.35), wz(m.ly) + (top ? 0 : 0.3)] })} font={font} fontSize={0.24} color={th.edge.label} anchorX={m.pts.length > 2 ? 'left' : 'center'} anchorY="middle" outlineWidth={0.015} outlineColor={th.edge.labelOutline}>{m.label}</Text>
          </group>
        )
      })}
    </group>
  )
}

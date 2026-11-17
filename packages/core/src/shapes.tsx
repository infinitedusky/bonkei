import * as THREE from 'three'
import { useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import type { Box, LabelMode } from './model'

export type { LabelMode }

import { S, TRAY, NODE_H, TEXT_LAYER } from './scale.ts'
import { slotShape } from './EdgeScene'
import { Mat, Ink, PlateText, useTheme, fontUrl, patternTexture, useFormTexture, FORM_ASPECT } from './look'
import type { Plate } from './theme'
export { S, TRAY, NODE_H }


function rounded(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
  return s
}
function geometry(shape: Box['shape'], w: number, h: number, height: number, bevel: number) {
  let g: THREE.BufferGeometry
  if (shape === 'cylinder') {
    g = new THREE.CylinderGeometry(0.5, 0.5, 1, 48).translate(0, 0.5, 0).scale(w, height, h)
    return g
  }
  let sh: THREE.Shape
  if (shape === 'diamond') {
    sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(0, -h / 2); sh.lineTo(w / 2, 0); sh.lineTo(0, h / 2); sh.closePath()
  } else sh = rounded(w, h, shape === 'round' ? Math.min(w, h) / 2 * 0.95 : 0.12)
  g = new THREE.ExtrudeGeometry(sh, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 })
  g.rotateX(-Math.PI / 2)
  return g
}

// A landscape form: a cut-out standing on the node's footprint, with the label in front of its foot. Both live in one billboard
// frame, so "above" and "in front" are screen directions in flat view too (where the camera looks straight down).
function Form({ shape, w, h, y, gap, label, plate, font, toward }: { shape: Box['shape']; w: number; h: number; y: number; gap: number; label: string; plate: Plate; font?: string; toward: number }) {
  const tex = useFormTexture(shape)
  const fw = Math.min(shape === 'diamond' ? 1.4 : 2.2, w * 0.8, h * 1.8), fh = fw * FORM_ASPECT[shape]
  return (
    <Billboard position={[0, y, 0]}>
      {tex && (
        <mesh position={[0, gap + fh / 2, 0]}>
          <planeGeometry args={[fw, fh]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.3} toneMapped={false} />
        </mesh>
      )}
      <group position={[0, 0.1, 0]}><PlateText text={label} plate={plate} font={font} fontSize={0.36} maxWidth={w - 0.3} toward={Math.max(toward, 0.7)} inFront /></group>
    </Billboard>
  )
}

/** The height a node's body stands (a landscape node: its plinth); the edge planner and the drag plane use the same. */
export const nodeHeight = (th: { node: { form: string; footprint: { height: number } } }, b: Box) => th.node.form === 'landscape' ? th.node.footprint.height : (b.height ?? NODE_H)

export function NodeBody({ b, hover = false, labelMode }: { b: Box; hover?: boolean; labelMode: LabelMode }) {
  const th = useTheme()
  const w = b.w * S, h = b.h * S
  const land = th.node.form === 'landscape'
  const height = nodeHeight(th, b)
  // a plinth is the surface the node stands on (its tray's top, or the ground), a step darker; level 2 stands on a darker tray, so on a darker plinth
  const plinth = useMemo(() => {
    const fp = th.node.footprint
    if (fp.color) return fp.color
    const under = b.level > 0 ? th.tray.colors[Math.min(b.level - 1, 2)] : th.ground.bg
    return '#' + new THREE.Color(under).multiplyScalar(fp.darken).getHexString()
  }, [th.node.footprint, th.tray.colors, th.ground.bg, b.level])
  const geo = useMemo(() => geometry(b.shape, land ? w * 0.9 : w, land ? h * 0.9 : h, height, th.node.bevel), [b.shape, w, h, height, land, th.node.bevel])
  return (
    <>
      {/* an inked node stands a hair above its surface so its bottom outline is not lost to the depth test against the tray top */}
      <mesh geometry={geo} position={[0, th.node.outline ? 0.012 : 0, 0]} castShadow={th.light.shadows} receiveShadow={th.light.shadows}>
        <Mat color={land ? plinth : th.node.colors[b.shape]} roughness={0.5} metalness={0.05} emissive={hover ? th.node.hover : '#000000'} emissiveIntensity={hover ? th.node.hoverIntensity : 0} />
        <Ink color={th.node.outline} width={th.node.outlineWidth} />
      </mesh>
      {land
        ? <Form shape={b.shape} w={w} h={h} y={height} gap={th.node.labelGap} label={b.label} plate={th.label.node} font={fontUrl(th)} toward={th.label.toward} />
        : <Label text={b.label} mode={labelMode} y={height + 0.08} size={0.36} maxWidth={w - 0.3} role="node" />}
    </>
  )
}

export function Label({ text, mode, y, size, maxWidth, left = false, role }: { text: string; mode: LabelMode; y: number; size: number; maxWidth: number; left?: boolean; role: 'node' | 'tray' }) {
  const th = useTheme()
  const plate = th.label[role], font = fontUrl(th)
  const body = <PlateText text={text} plate={plate} font={font} fontSize={size} maxWidth={maxWidth} left={left} outline={mode !== 'top' && plate.style === 'plain'} toward={mode !== 'top' && role === 'node' ? th.label.toward : 0} />
  if (mode === 'top') return <group rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>{body}</group>
  return <Billboard position={[0, y + 0.45, 0]}>{body}</Billboard>
}

export function Tray({ b, labelMode, hover = false, slots = [] }: { b: Box; labelMode: LabelMode; hover?: boolean; slots?: { x0: number; x1: number; z0: number; z1: number }[] }) {
  const th = useTheme()
  const w = b.w * S, h = b.h * S
  const lv = Math.min(b.level, 2)
  const T = th.tray.thickness
  const pat = th.tray.sides[lv]
  const side = useMemo(() => {
    const t = patternTexture(pat, th.tray.patternInk, th.tray.patternPaper, th.tray.outline ?? th.tray.patternInk)
    if (!t) return null
    const c = t.clone(); c.needsUpdate = true
    c.repeat.set(1 / T, 1 / T) // extruded side walls have world-unit UVs (v runs 1-T..1): one square tile is exactly the band's height
    c.offset.set(0, ((-(1 - T) / T) % 1 + 1) % 1)
    return c
  }, [pat, th.tray.patternInk, th.tray.patternPaper, T])
  // with tunnel slots (in tray-local x, z) the top is cut open, and a patterned side needs the extruded walls; otherwise a plain box
  const cut = useMemo(() => {
    if (!slots.length && !side) return null
    return new THREE.ExtrudeGeometry(slotShape(-w / 2, -h / 2, w / 2, h / 2, slots), { depth: T, bevelEnabled: false }).rotateX(-Math.PI / 2)
  }, [w, h, JSON.stringify(slots), !!side, T])
  const mat = (map: THREE.Texture | null | undefined, attach?: string) => <Mat attach={attach} color={map ? '#ffffff' : th.tray.colors[lv]} map={map} roughness={0.9} emissive={hover ? th.tray.hover : '#000'} emissiveIntensity={hover ? th.tray.hoverIntensity : 0} />
  return (
    <>
      <mesh key={cut ? 'cut' : 'box'} position={[0, cut ? 0 : T / 2, 0]} receiveShadow={th.light.shadows} geometry={cut ?? undefined}>
        {!cut && <boxGeometry args={[w, T, h]} />}
        {cut ? <>{mat(null, 'material-0')}{mat(side, 'material-1')}</> : mat(null)}
        <Ink color={th.tray.outline} width={th.node.outlineWidth} />
      </mesh>
      <group position={[-w / 2 + 0.25, 0, -h / 2 + 0.5]}>
        <Label text={b.label} mode={labelMode} y={T + 0.01} size={0.4} maxWidth={w - 0.5} left role="tray" />
      </group>
    </>
  )
}

// y of the surface a box sits on
export const baseOf = (b: Box, thickness = TRAY) => b.level * thickness

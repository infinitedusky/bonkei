// Cloud Cartography's node: a modelled icon by shape (inked meshes, so it turns with the view and is never a picture facing the camera)
// under a callout card on a dotted leader. Everything here reads tokens (theme.node.icon, theme.label.card); nothing checks a theme's name.
import * as THREE from 'three'
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Line, Text } from '@react-three/drei'
import type { Shape } from './model.ts'
import { ICON_TOP, TEXT_LAYER } from './scale.ts'
import { Ink, fontOf, useTheme } from './look'

const mix = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

function Part({ geo, color, at, rot, hover }: { geo: React.ReactNode; color: string; at: [number, number, number]; rot?: [number, number, number]; hover: boolean }) {
  const th = useTheme()
  return (
    <mesh position={at} rotation={rot}>
      {geo}
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} emissive={hover ? th.node.hover : '#000000'} emissiveIntensity={hover ? th.node.hoverIntensity : 0} />
      <Ink color={th.node.outline} width={th.node.outlineWidth} />
    </mesh>
  )
}

/** rect = server (a cube with drive bands and status dots), round = service (a hex puck), cylinder = storage (three discs), diamond = decision (plinth and pyramid). */
export function Icon({ shape, hover = false }: { shape: Shape; hover?: boolean }) {
  const th = useTheme()
  const c = th.node.colors[shape], { side, size } = th.node.icon
  const k = size / 1.2
  let body: React.ReactNode
  if (shape === 'rect') {
    body = <>
      <Part hover={hover} geo={<boxGeometry args={[1, 1.1, 1]} />} color={side} at={[0, 0.55, 0]} />
      {th.node.outline && [0.37, 0.73].map(h => <Line key={h} points={[[-0.501, h, 0.501], [0.501, h, 0.501], [0.501, h, -0.501]]} color={th.node.outline!} lineWidth={1.2} />)}
      {[0.18, 0.55, 0.92].map(h => <mesh key={h} position={[-0.3, h, 0.505]}><circleGeometry args={[0.055, 16]} /><meshBasicMaterial color={c} /></mesh>)}
      <Part hover={hover} geo={<boxGeometry args={[0.7, 0.03, 0.14]} />} color={c} at={[0, 1.115, 0]} />
    </>
  } else if (shape === 'round') {
    body = <>
      <Part hover={hover} geo={<cylinderGeometry args={[0.62, 0.62, 0.42, 6]} />} color={c} at={[0, 0.21, 0]} />
      <Part hover={hover} geo={<cylinderGeometry args={[0.3, 0.3, 0.2, 6]} />} color={side} at={[0, 0.52, 0]} />
    </>
  } else if (shape === 'cylinder') {
    body = <>{[0, 1, 2].map(i => <Part key={i} hover={hover} geo={<cylinderGeometry args={[0.55, 0.55, 0.24, 32]} />} color={i === 2 ? mix(c, '#ffffff', 0.2) : side} at={[0, i * 0.3 + 0.12, 0]} />)}</>
  } else {
    body = <>
      <Part hover={hover} geo={<boxGeometry args={[0.99, 0.16, 0.99]} />} color={side} at={[0, 0.08, 0]} rot={[0, Math.PI / 4, 0]} />
      <Part hover={hover} geo={<coneGeometry args={[0.5, 0.79, 4]} />} color={c} at={[0, 0.555, 0]} />
    </>
  }
  return <group scale={k}>{body}</group>
}

// A card's text and spacing, world units: the name's and the subtitle's size, the padding round them, the gap between the two lines.
const CARD = { title: 0.3, sub: 0.26, padX: 0.25, padY: 0.12, between: 0.05 }

/**
 * The callout card: the label on a white card with a border, on a dotted leader from the icon's top. It stands in the camera's frame
 * (Billboard), `gap` above the icon along the screen's up, so in flat view it sits towards the top of the screen and in iso and 3D above the icon.
 * It is drawn over everything (no depth test), so no icon hides it, and card by card, the nearest last, so two that overlap never mix their text.
 * A label written over two lines has its second line beneath, smaller and grey. A long one wraps at the card's widest (its box's width, at least 3).
 */
export function Card({ title, sub, shape, w: boxW }: { title: string; sub?: string; shape: Shape; w: number }) {
  const th = useTheme()
  const { sub: subColor, leader, gap, titleFont } = th.label.card
  const plate = th.label.node
  const tf = fontOf(titleFont)
  const top = ICON_TOP[shape] * (th.node.icon.size / 1.2) + 0.03
  const widest = Math.max(boxW, 3)
  // the text's measured size (troika's block bounds, once laid out); until then a guess from the length
  const [tb, setTb] = useState({ w: title.length * 0.2, h: CARD.title * 1.2 })
  const [sb, setSb] = useState({ w: (sub ?? '').length * 0.14, h: CARD.sub * 1.2 })
  const w = Math.min(Math.max(tb.w, sub ? sb.w : 0) + 2 * CARD.padX, widest)
  const h = 2 * CARD.padY + tb.h + (sub ? CARD.between + sb.h : 0)
  const lay = TEXT_LAYER as any
  const fit = (set: (b: { w: number; h: number }) => void) => (t: any) => { const r = t.textRenderInfo?.blockBounds; if (r) set({ w: r[2] - r[0], h: r[3] - r[1] }) }
  const order = useRef<THREE.Group>(null)
  useFrame(({ camera }) => { const g = order.current; if (g) g.renderOrder = CARD_ORDER - g.getWorldPosition(at).distanceTo(camera.position) })
  const textW = widest - 2 * CARD.padX
  return (
    <Billboard position={[0, top, 0]}>
      <group ref={order}>
        {leader && <Line points={[[0, 0, 0], [0, gap, 0]]} color={leader} lineWidth={1.4} dashed dashSize={0.06} gapSize={0.1} />}
        {leader && <mesh><sphereGeometry args={[0.05, 12, 8]} /><meshBasicMaterial color={leader} /></mesh>}
        <group position={[0, gap + h / 2, 0]}>
          <mesh layers={lay} renderOrder={0}><planeGeometry args={[w + 0.04, h + 0.04]} /><meshBasicMaterial color={plate.border} depthTest={false} transparent /></mesh>
          <mesh layers={lay} renderOrder={1}><planeGeometry args={[w, h]} /><meshBasicMaterial color={plate.plate} depthTest={false} transparent /></mesh>
          <Text layers={lay} renderOrder={2} material-depthTest={false} font={tf} position={[-w / 2 + CARD.padX, h / 2 - CARD.padY, 0.01]} anchorX="left" anchorY="top" fontSize={CARD.title} maxWidth={textW} color={plate.text} onSync={fit(setTb)}>{title}</Text>
          {sub && <Text layers={lay} renderOrder={2} material-depthTest={false} position={[-w / 2 + CARD.padX, h / 2 - CARD.padY - tb.h - CARD.between, 0.01]} anchorX="left" anchorY="top" fontSize={CARD.sub} maxWidth={textW} color={subColor} onSync={fit(setSb)}>{sub}</Text>}
        </group>
      </group>
    </Billboard>
  )
}
// Cards are drawn after the rest of the transparent pass (its groups have order 0): this, less the card's distance from the camera.
const CARD_ORDER = 1e6
const at = new THREE.Vector3()

// The theme as the scene uses it: the context, materials, ink outlines, label plates, patterns and landscape forms.
// Everything here reads tokens from the Theme; nothing checks a theme's name.
import * as THREE from 'three'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Edges, Text } from '@react-three/drei'
import type { Shape } from './model.ts'
import { CLASSIC, inkPx, type Pattern, type Plate, type Theme } from './theme.ts'
import { FONTS } from './fonts.ts'
import { TEXT_LAYER } from './scale.ts'
import { MAT_DEFAULTS } from './mat.ts'

const Ctx = createContext<Theme>(CLASSIC)

// ---- ink: line widths that follow the drawing's scale ----
/** The view's scale (px per world unit), per canvas; the render loop sets it, label borders and landscape forms read it. */
export class InkStore {
  ppu = 30
  bucket = 0
  private subs = new Set<() => void>()
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f) } }
  getBucket = () => this.bucket
  setBucket(b: number) { if (b !== this.bucket) { this.bucket = b; this.subs.forEach(f => f()) } }
}
export const InkCtx = createContext<InkStore>(new InkStore())
export const ThemeProvider = ({ theme, children }: { theme: Theme; children: ReactNode }) => <Ctx.Provider value={theme}>{children}</Ctx.Provider>
export const useTheme = () => useContext(Ctx)
/** Tone mapping from the theme. Set here rather than with Canvas's `flat` prop, which is read once when the canvas is made (the theme can arrive after, from the frontmatter). */
export function ToneSetup() {
  const th = useTheme()
  const gl = useThree(s => s.gl)
  useLayoutEffect(() => { gl.toneMapping = th.light.toneMapping ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping }, [gl, th.light.toneMapping])
  return null
}
export const fontUrl = (t: Theme) => (t.label.font ? FONTS[t.label.font] : undefined)

// ---- materials ----
const grads = new Map<number, THREE.DataTexture>()
function gradient(tones: number) {
  let g = grads.get(tones)
  if (!g) {
    const lv = tones <= 2 ? [150, 255] : [110, 190, 255]
    g = new THREE.DataTexture(new Uint8Array(lv), lv.length, 1, THREE.RedFormat)
    g.minFilter = g.magFilter = THREE.NearestFilter
    g.needsUpdate = true
    grads.set(tones, g)
  }
  return g
}

interface MatProps { attach?: string; color?: string; map?: THREE.Texture | null; emissive?: string; emissiveIntensity?: number; roughness?: number; metalness?: number; side?: THREE.Side; transparent?: boolean; opacity?: number; depthWrite?: boolean }
/** The surface material the theme asks for: lit standard, or flat steps (toon). */
export function Mat({ roughness = MAT_DEFAULTS.roughness, metalness = MAT_DEFAULTS.metalness, ...p }: MatProps) {
  const th = useTheme()
  if (th.light.shading === 'toon') return <meshToonMaterial {...p} gradientMap={gradient(th.light.tones)} />
  return <meshStandardMaterial {...p} roughness={roughness} metalness={metalness} />
}

/** Ink outline round the parent mesh's sharp edges; nothing when the token is null. */
export function Ink({ color, width }: { color: string | null; width: number }) {
  if (!color) return null
  // polygon offset: the outline along a node's bottom lies in its tray's top plane, and would lose the depth test to it (the node then looks sunk in)
  return <Edges threshold={25} color={color} lineWidth={width} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
}

// ---- tray side patterns, drawn on a canvas (no image files) ----
// One square tile is exactly the height of the tray's side band: a single bold motif filling the band, an ink line along the top and the bottom.
const pats = new Map<string, THREE.CanvasTexture>()
export function patternTexture(kind: Pattern, ink: string, paper: string, line: string): THREE.Texture | null {
  if (kind === 'plain') return null
  const key = `${kind}|${ink}|${paper}|${line}`
  let t = pats.get(key)
  if (t) return t
  const N = 128, c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  const bar = N * 0.07, m = N / 2
  if (kind === 'hishi') {
    g.fillStyle = paper; g.fillRect(0, 0, N, N)
    g.fillStyle = ink
    const r = N / 2 - bar - 2
    g.beginPath(); g.moveTo(m, m - r); g.lineTo(m + r, m); g.lineTo(m, m + r); g.lineTo(m - r, m); g.closePath(); g.fill()
    g.fillStyle = paper; g.beginPath(); g.moveTo(m, m - r * 0.4); g.lineTo(m + r * 0.4, m); g.lineTo(m, m + r * 0.4); g.lineTo(m - r * 0.4, m); g.closePath(); g.fill()
  } else if (kind === 'flower') {
    g.fillStyle = paper; g.fillRect(0, 0, N, N)
    g.fillStyle = ink
    const pr = N * 0.17, d = N * 0.2
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { g.beginPath(); g.arc(m + dx * d, m + dy * d, pr, 0, 7); g.fill() }
    g.fillStyle = paper; g.beginPath(); g.arc(m, m, N * 0.1, 0, 7); g.fill()
  } else { // stone: dark ground with wavy veins
    g.fillStyle = '#5f5850'; g.fillRect(0, 0, N, N)
    g.strokeStyle = '#4a443d'; g.lineWidth = N * 0.06; g.lineCap = 'round'
    for (const y of [0.3, 0.55, 0.8]) { g.beginPath(); g.moveTo(0, N * y); g.bezierCurveTo(N * 0.25, N * (y - 0.14), N * 0.5, N * (y + 0.14), N, N * y); g.stroke() }
  }
  g.fillStyle = line
  g.fillRect(0, 0, N, bar); g.fillRect(0, N - bar, N, bar)
  t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  pats.set(key, t)
  return t
}

// ---- paper grain: noise on the ground colour, tiled ----
const grains = new Map<string, THREE.CanvasTexture>()
export function grainTexture(bg: string, amount: number): THREE.Texture {
  const key = bg + amount
  let t = grains.get(key)
  if (t) return t
  const N = 256, c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  g.fillStyle = bg; g.fillRect(0, 0, N, N)
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 3500; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(120,95,55,${0.02 + rnd() * 0.07 * amount})` : `rgba(255,250,235,${0.02 + rnd() * 0.08 * amount})`
    g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 1.5, 1 + rnd() * 1.5)
  }
  t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.repeat.set(1 / 8, 1 / 8) // the ground's UVs are world units: one tile per 8
  grains.set(key, t)
  return t
}

// ---- label plates ----
/** Text, and behind it a cartouche (border and plate sized to the text) when the plate token asks for one. Lies in its parent's XY plane. */
export function PlateText({ text, plate, font, fontSize, maxWidth, left = false, right = false, outline = false, toward = 0, inFront = false }: { text: string; plate: Plate; font?: string; fontSize: number; maxWidth: number; left?: boolean; right?: boolean; outline?: boolean; toward?: number; inFront?: boolean }) {
  const [b, setB] = useState<[number, number, number, number] | null>(null)
  const cart = plate.style === 'cartouche'
  const pad = fontSize * 0.28
  const th = useTheme(), ink = useContext(InkCtx)
  const border = useRef<THREE.Mesh>(null!)
  // the cartouche's border is ink: its width follows the same rule as the outlines (a world-space border would swamp a small label)
  useFrame(() => {
    if (!border.current || !b) return
    const bw = th.ink.ref === null ? fontSize * 0.09 : inkPx(th, th.node.outlineWidth, ink.ppu) / ink.ppu
    border.current.scale.set(b[2] - b[0] + 2 * (pad + bw), b[3] - b[1] + 2 * (pad * 0.6 + bw), 1)
  })
  // inFront (a landscape label): the plates join the transparent pass, which draws by renderOrder first, so they come after
  // every landscape form (renderOrder 0, no depth written): a label is never hidden behind another node's form
  const mat = { depthWrite: true, transparent: inFront, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }
  return (
    <group position={[0, 0, toward]}>
      {cart && b && (
        <group position={[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0]}>
          <mesh ref={border} layers={TEXT_LAYER as any} renderOrder={1}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={plate.border} {...mat} />
          </mesh>
          <mesh layers={TEXT_LAYER as any} renderOrder={2} position={[0, 0, 0.01]}>
            <planeGeometry args={[b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad * 0.6]} />
            <meshBasicMaterial color={plate.plate} {...mat} />
          </mesh>
        </group>
      )}
      <Text layers={TEXT_LAYER as any} renderOrder={3} position={[0, 0, cart ? 0.02 : 0]} depthOffset={cart || inFront ? -12 : 0} font={font} fontSize={fontSize} maxWidth={maxWidth} color={plate.text}
        anchorX={left ? 'left' : right ? 'right' : 'center'} anchorY="middle" textAlign={left ? 'left' : right ? 'right' : 'center'}
        outlineWidth={outline ? 0.03 : 0} outlineColor="#000"
        onSync={cart ? (t: any) => { const r = t.textRenderInfo?.blockBounds; if (r) setB(p => (p && p[0] === r[0] && p[1] === r[1] && p[2] === r[2] && p[3] === r[3] ? p : [r[0], r[1], r[2], r[3]])) } : undefined}>{text}</Text>
    </group>
  )
}

// ---- landscape forms: billboarded cut-outs drawn from SVG, rasterised once per shape ----
const INK = '#2A2622', AI = '#24508F', IND = '#23345A'
function pad(x0: number, x1: number, y: number, h: number) {
  const w = x1 - x0, P = (fx: number, fy: number) => `${x0 + w * fx} ${y - h * fy}`
  return `<path d='M${x0} ${y} Q${x0 - 0.5} ${y - h * 0.55} ${P(0.18, 0.75)} Q${P(0.3, 1.15)} ${P(0.52, 1)} Q${P(0.72, 1.2)} ${P(0.9, 0.75)} Q${x1 + 0.5} ${y - h * 0.35} ${x1} ${y} Q${x0 + w / 2} ${y + h * 0.18} ${x0} ${y} Z'/>`
}
export const FORM_ASPECT: Record<Shape, number> = { rect: 43 / 60, round: 57 / 60, cylinder: 51 / 60, diamond: 36 / 40 }
const FORM_SVG: Record<Shape, string> = {
  rect: `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='258' viewBox='0 0 60 43'>
      <path d='M8 22 H52 V41 H8 Z' fill='#efe6d0' stroke='${INK}' stroke-width='1.6'/>
      <path d='M4 23 L14 8 H46 L56 23 Z' fill='${AI}' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>
      <path d='M14 8 H46' stroke='${IND}' stroke-width='3'/>
      <path d='M26 41 V30 H34 V41' fill='#8C7E6E' stroke='${INK}' stroke-width='1.3'/></svg>`,
  round: `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='342' viewBox='0 0 60 57'>
      <path d='M24 32 Q19 31.6 15 33' fill='none' stroke='${INK}' stroke-width='3' stroke-linecap='round'/>
      <path d='M24 56 C21 50 29 46 27.5 41 C26.5 37 29 33 34 31 L36 34 C32 36 31.5 38.5 32 41 C33.5 46 30 50 34 56 Z' fill='#6b5544' stroke='${INK}' stroke-width='1.5' stroke-linejoin='round'/>
      <g fill='#3F6B4E' stroke='${INK}' stroke-width='1.5' stroke-linejoin='round'>${[[4, 26, 35, 7], [30, 54, 28, 8], [18, 40, 19, 8]].map(([a, b, y, h]) => pad(a, b, y, h)).join('')}</g></svg>`,
  cylinder: `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='306' viewBox='0 0 60 51'>
      <path d='M4 50 L10 30 L18 26 L22 12 L32 6 L40 16 L47 18 L52 34 L57 50 Z' fill='#8C7E6E' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>
      <path d='M22 12 L32 6 L36 12 L28 22 Z' fill='#C9A24A' stroke='${INK}' stroke-width='1.2' stroke-linejoin='round'/>
      <path d='M37 22 V50' stroke='#9fc7d6' stroke-width='4'/><path d='M37 22 V50' stroke='${INK}' stroke-width='.8' stroke-dasharray='3 4'/></svg>`,
  diamond: `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='324' viewBox='0 0 40 36'>
      <path d='M2 35 L20 3 L38 35 Z' fill='#C9A24A' stroke='${INK}' stroke-width='1.6' stroke-linejoin='round'/>
      <path d='M14 14 L20 3 L26 14 L22 12 L20 15 L17 12 Z' fill='#f4efe3' stroke='${INK}' stroke-width='1.1' stroke-linejoin='round'/></svg>`,
}
// The ink strokes are scaled by k (1 = as drawn: about 2 px on a form at the reference scale), so the forms' ink can match the mesh outlines at any zoom.
// k comes in steps (a quarter of an octave) and a texture is made once per shape and step.
const forms = new Map<string, THREE.Texture>()
const pending = new Map<string, Promise<THREE.Texture>>()
const stroked = (svg: string, k: number) => k === 1 ? svg : svg.replace(/(stroke='#2A2622' stroke-width=')([\d.]+)(')/g, (_m, a, w, c) => a + (+w * k).toFixed(3) + c)
function loadForm(shape: Shape, step: number): Promise<THREE.Texture> {
  const key = shape + step
  let p = pending.get(key)
  if (!p) {
    p = new Promise(res => {
      const img = new Image()
      img.onload = () => {
        const t = new THREE.Texture(img)
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true
        forms.set(key, t); res(t)
      }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stroked(FORM_SVG[shape], 2 ** (step / 4)))
    })
    pending.set(key, p)
  }
  return p
}
/** The form's texture at the ink step the view asks for; the previous one stays up until the new one has loaded. */
export function useFormTexture(shape: Shape) {
  const ink = useContext(InkCtx)
  const step = useSyncExternalStore(ink.subscribe, ink.getBucket)
  const [t, setT] = useState<THREE.Texture | null>(forms.get(shape + step) ?? null)
  useEffect(() => { let on = true; loadForm(shape, step).then(x => on && setT(x)); return () => { on = false } }, [shape, step])
  return t
}

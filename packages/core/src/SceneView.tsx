import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { Box, LayoutResult, Route } from './model'
import { reroute, PAD } from './layout'
import { loadAvoid, routerFor, type EdgeRouter, type AvoidCrossings } from './avoid.ts'
import { measureRoutes, type RouteQuality } from './routeMetrics.ts'
import { instant } from './telemetry'
import { createCamera, type Camera, type Mode } from './camera'
import { SeqScene } from './SeqScene'
import type { SeqLayout } from './seq'
import { NodeBody, Tray, baseOf, type LabelMode } from './shapes'
import { Mat, ThemeProvider, useTheme, grainTexture } from './look'
import { CLASSIC, type Theme } from './theme'
import { Edge, Trench, PortalSystem, slotShape, stadium } from './EdgeScene'
import { planEdges, type Body, type CrossingStyle, type Slot, type Stats } from './edges3d.ts'
import { S, NODE_H, TEXT_LAYER } from './scale'
import { ALL_ON, WHEEL_IDLE_MS, cursorFor, dragAction, gesture, wheelAction } from './controls'
import type { NodeClick, ResolvedControls } from './options'

const LIGHT_TILTED = new THREE.Vector3(10, 18, 7) // iso and 3D
const LIGHT_FLAT = new THREE.Vector3(21.8 * Math.sin(Math.PI / 36), 21.8 * Math.cos(Math.PI / 36), 0) // flat: 5 degrees off straight overhead, same distance

type Ovr = Record<string, { x: number; y: number }>

// `live` are the router's routes while a node is dragged; without a router (the wasm did not load) a moved node's lines take the cheap Manhattan route.
function effective(data: LayoutResult, ovr: Ovr, live: Route[] | null) {
  const boxes = new Map<string, Box>()
  for (const b of data.boxes) boxes.set(b.id, ovr[b.id] ? { ...b, ...ovr[b.id] } : b)
  const routes: Route[] = live ?? data.routes.map(r =>
    ovr[r.from] || ovr[r.to] ? { ...r, points: reroute(boxes.get(r.from)!, boxes.get(r.to)!) } : r)
  return { boxes, routes }
}

function Rig({ cam, fpsRef }: { cam: Camera; fpsRef: React.RefObject<HTMLDivElement> }) {
  const acc = useRef({ t: 0, n: 0 })
  useFrame(({ camera, size }, dt) => {
    cam.aspect = size.width / size.height
    const c = cam.cur, g = cam.goal, k = 1 - Math.exp(-6 * Math.min(dt, 0.1))
    for (const key of ['tx', 'tz', 'yaw', 'pitch'] as const) c[key] += (g[key] - c[key]) * k
    for (const key of ['H', 'fov'] as const) c[key] = Math.exp(Math.log(c[key]) + (Math.log(g[key]) - Math.log(c[key])) * k)
    const p = camera as THREE.PerspectiveCamera
    const d = c.H / 2 / Math.tan((c.fov * Math.PI) / 360)
    p.fov = c.fov
    p.near = Math.max(0.1, d - 120); p.far = d + 120
    p.position.set(c.tx + d * Math.sin(c.yaw) * Math.cos(c.pitch), d * Math.sin(c.pitch), c.tz + d * Math.cos(c.yaw) * Math.cos(c.pitch))
    p.lookAt(c.tx, 0, c.tz)
    p.updateProjectionMatrix()
    acc.current.t += dt; acc.current.n++
    if (acc.current.t > 0.5 && fpsRef.current) {
      fpsRef.current.textContent = `${Math.round(acc.current.n / acc.current.t)} fps`
      acc.current = { t: 0, n: 0 }
    }
  })
  return null
}

const NO_SLOTS: Slot[] = []
function Env({ cam, children, controls, slots = NO_SLOTS }: { cam: Camera; children: React.ReactNode; controls: ResolvedControls; slots?: Slot[] }) {
  const masks = useMemo(() => slots.map(s => new THREE.ShapeGeometry(stadium(s, new THREE.Shape()) as THREE.Shape, 16)), [slots])
  const groundGeo = useMemo(() => new THREE.ShapeGeometry(slotShape(-200, -200, 200, 200, slots)), [slots])
  const { gl } = useThree()
  const th = useTheme()
  const grain = useMemo(() => (th.ground.grain > 0 ? grainTexture(th.ground.bg, th.ground.grain) : null), [th.ground.bg, th.ground.grain])
  // Flat view: the light is almost overhead (5 degrees off), so shadows are short. It eases between the two like the camera does.
  const light = useRef<THREE.DirectionalLight>(null!)
  const lightAt = useRef(new THREE.Vector3(10, 18, 7))
  useFrame((_, dt) => {
    const to = cam.mode === 'flat' ? LIGHT_FLAT : LIGHT_TILTED
    lightAt.current.lerp(to, 1 - Math.exp(-6 * Math.min(dt, 0.1)))
    light.current?.position.copy(lightAt.current)
  })
  const startCamDrag = (e: ThreeEvent<PointerEvent>) => {
    const action = dragAction(controls, cam.mode, e.nativeEvent.button)
    if (action === 'none') return
    let lx = e.nativeEvent.clientX, ly = e.nativeEvent.clientY
    const orbit = action === 'orbit'
    const span = gesture(action)
    const move = (ev: PointerEvent) => {
      span.touch()
      const dx = ev.clientX - lx, dy = ev.clientY - ly
      lx = ev.clientX; ly = ev.clientY
      const g = cam.goal, c = cam.cur
      if (orbit) {
        g.yaw -= dx * 0.005; g.pitch = Math.min(1.5, Math.max(0.15, g.pitch + dy * 0.005))
      } else {
        const upp = c.H / gl.domElement.clientHeight
        const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw)
        const mx = -dx * upp * cy + dy * upp * (-sy) / Math.sin(c.pitch)
        const mz = dx * upp * sy + dy * upp * (-cy) / Math.sin(c.pitch)
        g.tx += mx; g.tz += mz; c.tx += mx; c.tz += mz
      }
    }
    const up = () => { span.end(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  useEffect(() => {
    const el = gl.domElement
    const span = gesture('zoom', WHEEL_IDLE_MS)
    // zoom off: leave the event alone so an embedding page scrolls over the scene
    const wheel = (e: WheelEvent) => {
      if (wheelAction(controls) === 'pass') return
      e.preventDefault()
      span.touch()
      cam.goal.H = Math.min(200, Math.max(3, cam.goal.H * Math.exp(e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('wheel', wheel); span.end() }
  }, [cam, gl, controls])


  return (
    <>
      <ambientLight intensity={th.light.ambient} />
      <hemisphereLight args={[th.light.sky, th.light.floor, th.light.hemi]} />
      <directionalLight ref={light} position={[10, 18, 7]} intensity={th.light.sun} castShadow={th.light.shadows} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-near={1} shadow-camera-far={80} shadow-bias={-0.0004} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} onPointerDown={startCamDrag} receiveShadow={th.light.shadows} geometry={groundGeo}>
        {th.ground.lit ? <meshStandardMaterial color={th.ground.bg} roughness={1} /> : <meshBasicMaterial color={grain ? '#ffffff' : th.ground.bg} map={grain} />}
      </mesh>
      {/* the grid is masked out over a tunnel's slot (stencil), so no grid line floats across it */}
      {th.ground.grid && slots.map((_, i) => (
        <mesh key={i} geometry={masks[i]} position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
          <meshBasicMaterial colorWrite={false} depthWrite={false} stencilWrite stencilRef={1} stencilFunc={THREE.AlwaysStencilFunc} stencilZPass={THREE.ReplaceStencilOp} />
        </mesh>
      ))}
      {th.ground.grid && <gridHelper key={slots.length ? 'masked' : 'plain'} args={[200, 200, ...th.ground.grid]} position={[0, -0.01, 0]} renderOrder={1}
        material-stencilWrite={slots.length > 0} material-stencilRef={1} material-stencilFunc={THREE.NotEqualStencilFunc} />}
      {children}
    </>
  )
}

function Scene({ cam, data, labelMode, onDrill, controls, onNodeClick, hasClick, crossings, avoidCrossings, onEdgeStats }: {
  cam: Camera; data: LayoutResult; labelMode: LabelMode; onDrill: (cx: number, cz: number, X: number, Z: number) => void
  controls: ResolvedControls; onNodeClick?: (n: NodeClick) => void; hasClick: boolean
  crossings: CrossingStyle; avoidCrossings: AvoidCrossings; onEdgeStats?: (s: EdgeStats) => void
}) {
  const { camera, gl, raycaster } = useThree()
  const th = useTheme()
  // per canvas, so instances on one page never touch each other's cursor
  const setCursor = (c: string) => { gl.domElement.style.cursor = c }
  const [ver, setVer] = useState(0)
  const ovr = useRef<Ovr>({})
  const [hover, setHover] = useState<string | null>(null)
  // the router that routed this layout (or one made from it), kept alive across drag frames
  const router = useRef<EdgeRouter | null>(null)
  const live = useRef<Route[] | null>(null)
  const moveMs = useRef(0)
  const [wasm, setWasm] = useState(0)
  useEffect(() => { loadAvoid().then(() => setWasm(v => v + 1), () => {}) }, [])
  useEffect(() => {
    router.current?.reset()
    // the layout's own router when its level matches, else the lines are routed again at this level (null until the wasm loads)
    const t0 = performance.now()
    const r = routerFor(data, avoidCrossings)
    router.current = r
    // routed again at another crossing level than the layout's: one span, so the cost of a toolbar switch shows in traces
    if (r && r.routes !== data.routes) instant('bonkei.reroute', { 'bonkei.avoid_crossings': r.level, 'bonkei.route_ms': performance.now() - t0, 'bonkei.unroutable': r.stats.failed.length }, Date.now() - (performance.now() - t0))
    live.current = r && r.routes !== data.routes ? r.routes : null
    ovr.current = {}; setVer(v => v + 1)
  }, [data, wasm, avoidCrossings])
  const { boxes, routes } = useMemo(() => effective(data, ovr.current, live.current), [data, ver])
  const W = data.width, H = data.height
  const wx = (x: number) => (x - W / 2) * S, wz = (y: number) => (y - H / 2) * S
  // steps and crossings, recomputed whenever a box moves (the drag path) or the style changes
  const quality = useMemo<RouteQuality>(() => measureRoutes([...boxes.values()], routes), [boxes, routes])
  const { plans, stats, slots, ms } = useMemo(() => {
    const t0 = performance.now()
    const bodies: Body[] = [...boxes.values()].map(b => ({ id: b.id, kind: b.kind, x0: wx(b.x), z0: wz(b.y), x1: wx(b.x + b.w), z1: wz(b.y + b.h), level: b.level, parent: b.parent, height: b.height }))
    const r = planEdges(bodies, routes.map(r => ({ id: r.id, from: r.from, to: r.to, points: r.points.map(([x, y]) => [wx(x), wz(y)] as [number, number]) })), crossings)
    return { ...r, ms: performance.now() - t0 }
  }, [boxes, routes, crossings, W, H])
  const groundSlots = useMemo(() => slots.filter(s => !s.tray), [slots])
  const portalList = useMemo(() => [...plans.values()].flatMap(p => p.portals), [plans])
  useEffect(() => { camera.layers.enable(TEXT_LAYER) }, [camera])
  const statsCb = useRef(onEdgeStats)
  statsCb.current = onEdgeStats
  useEffect(() => {
    const rs = data.stats?.route
    statsCb.current?.({
      ...stats, trayDocks: data.stats?.trayDocks ?? 0, recomputeMs: ms,
      routeMs: rs?.ms ?? 0, routerBuildMs: rs?.buildMs ?? 0, unroutable: rs?.failed.length ?? 0, routingError: rs?.error ?? null, dragMs: moveMs.current, avoidCrossings: router.current?.level ?? 'off', quality,
    })
  }, [stats, ms, data, quality])

  const groundPoint = (cx: number, cy: number, planeY: number) => {
    const r = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera)
    const out = new THREE.Vector3()
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), out) ? out : null
  }

  const startNodeDrag = (e: ThreeEvent<PointerEvent>, id: string) => {
    e.stopPropagation()
    const b = boxes.get(id)!
    const planeY = baseOf(b) + (b.height ?? NODE_H)
    const p0 = groundPoint(e.nativeEvent.clientX, e.nativeEvent.clientY, planeY)
    if (!p0) return
    const gx = p0.x / S + W / 2 - b.x, gy = p0.z / S + H / 2 - b.y
    const parent = b.parent ? data.boxes.find(x => x.id === b.parent) : undefined
    setCursor('grabbing')
    const span = gesture('move')
    const move = (ev: PointerEvent) => {
      span.touch()
      const p = groundPoint(ev.clientX, ev.clientY, planeY)
      if (!p) return
      let x = p.x / S + W / 2 - gx, y = p.z / S + H / 2 - gy
      if (parent) { // keep inside parent tray
        x = Math.min(Math.max(x, parent.x + PAD.side), parent.x + parent.w - b.w - PAD.side)
        y = Math.min(Math.max(y, parent.y + PAD.top), parent.y + parent.h - b.h - PAD.side)
      }
      const r = router.current
      if (r) { const at = r.at(id); live.current = r.move(id, x - at.x, y - at.y); moveMs.current = r.stats.moveMs }
      ovr.current = { ...ovr.current, [id]: { x, y } }
      setVer(v => v + 1)
    }
    const up = () => { span.end(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setCursor(cursorFor('node', controls, hasClick)) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  return (
    <>
      <Env cam={cam} controls={controls} slots={groundSlots}>
      {[...boxes.values()].map(b => {
        const w = b.w * S, h = b.h * S
        const pos: [number, number, number] = [wx(b.x) + w / 2, baseOf(b), wz(b.y) + h / 2]
        if (b.kind === 'group') {
          return (
            <group key={b.id} position={pos}
              onClick={e => {
                if (e.delta >= 4) return
                e.stopPropagation()
                onNodeClick?.({ id: b.id, label: b.label, kind: 'group' })
                if (controls.drillIn) onDrill(pos[0], pos[2], w, h)
              }}
              onPointerOver={e => { e.stopPropagation(); setHover(b.id); setCursor(cursorFor('group', controls, hasClick)) }}
              onPointerOut={() => { setHover(null); setCursor('') }}>
              <Tray b={b} labelMode={labelMode} hover={hover === b.id} slots={slots.filter(s => s.tray === b.id).map(s => ({ x0: s.x0 - pos[0], x1: s.x1 - pos[0], z0: s.z0 - pos[2], z1: s.z1 - pos[2] }))} />
            </group>
          )
        }
        return <NodeLift key={b.id} pos={pos} hover={hover === b.id}
          onDown={e => { if (controls.move) startNodeDrag(e, b.id) }}
          onClick={e => { if (e.delta < 4) { e.stopPropagation(); onNodeClick?.({ id: b.id, label: b.label, kind: 'node' }) } }}
          onOver={() => { setHover(b.id); setCursor(cursorFor('node', controls, hasClick)) }}
          onOut={() => { setHover(null); setCursor('') }}>
          <NodeBody b={b} hover={hover === b.id} labelMode={labelMode} />
        </NodeLift>
      })}
      {routes.map(r => plans.get(r.id) ? <Edge key={r.id} plan={plans.get(r.id)!} label={r.label} labelMode={labelMode} /> : null)}
      {slots.map((s, i) => <Trench key={i} slot={s} color={s.tray ? th.tray.colors[Math.min(boxes.get(s.tray)!.level, 2)] : th.ground.bg} y={s.tray ? 0 : -0.02} />)}
      {portalList.length > 0 && <PortalSystem pairs={portalList} deps={[plans, hover]} />}
      </Env>
    </>
  )
}

function NodeLift({ pos, hover, children, onDown, onClick, onOver, onOut }: { pos: [number, number, number]; hover: boolean; children: React.ReactNode; onDown: (e: ThreeEvent<PointerEvent>) => void; onClick: (e: ThreeEvent<MouseEvent>) => void; onOver: () => void; onOut: () => void }) {
  const ref = useRef<THREE.Group>(null!)
  const lift = useRef(0)
  useFrame((_, dt) => {
    lift.current += ((hover ? 0.18 : 0) - lift.current) * (1 - Math.exp(-14 * dt))
    ref.current.position.set(pos[0], pos[1] + lift.current, pos[2])
  })
  return (
    <group ref={ref} onPointerDown={onDown} onClick={onClick} onPointerOver={e => { e.stopPropagation(); onOver() }} onPointerOut={onOut}>
      {children}
    </group>
  )
}

// On the first frame drawn with each new `data`: fit with the real aspect (known only once the
// canvas has a size), snap there if this view has never shown a layout, then report it once.
function FirstFrame({ cam, data, onFirstFrame }: { cam: Camera; data: LayoutResult | SeqLayout | null; onFirstFrame?: () => void }) {
  const seen = useRef<LayoutResult | SeqLayout | null>(null)
  const laidOut = useRef(false)
  const cb = useRef(onFirstFrame)
  cb.current = onFirstFrame
  useFrame(({ size }) => {
    if (!data || seen.current === data) return
    seen.current = data
    if (size.width > 0 && size.height > 0) cam.aspect = size.width / size.height
    cam.fit(data.width, data.height)
    if (!laidOut.current) { cam.snap(); laidOut.current = true }
    cb.current?.()
  })
  return null
}

/**
 * What an embedding app would want to watch: `routeMs` and `routerBuildMs` (time to route every line at layout; routeMs includes loading the wasm),
 * `dragMs` (re-route of the last drag frame), `unroutable` (lines libavoid could not route or that still cross an obstacle),
 * `routingError` (why the lines fell back to ELK's routes, e.g. the wasm failed to load; null otherwise), `recomputeMs` (steps and crossings),
 * and the crossings found (`crossings`, `touching`) and drawn per style (`bridge`, `tunnel`, `portal`; `skipped` had no room).
 */
export interface EdgeStats extends Stats { trayDocks: number; recomputeMs: number; routeMs: number; routerBuildMs: number; unroutable: number; routingError: string | null; dragMs: number; avoidCrossings: AvoidCrossings; quality: RouteQuality }

export interface SceneViewProps {
  data: LayoutResult | SeqLayout | null
  labelMode: LabelMode
  mode: Mode
  /** Camera state. Pass one to control the view from outside; otherwise each SceneView owns its own. */
  camera?: Camera
  /** Show the fps counter bottom-right. Default true. */
  showFps?: boolean
  /** The reader's controls. Default all on. */
  controls?: ResolvedControls
  /** Called on a click (not a drag) on a node, a group or a sequence participant, whatever the controls. */
  onNodeClick?: (node: NodeClick) => void
  /** Whether to show the pointer cursor for clicks. Default: whether `onNodeClick` is given. */
  hasClick?: boolean
  /** Called once per `data`, on the first frame drawn with it (after the fit). */
  onFirstFrame?: () => void
  /** How crossing lines get past each other: not at all (default), by a bridge, a tunnel or portals. Steps between heights are always on. */
  crossings?: CrossingStyle
  /** How hard the router tries to keep lines from crossing (off, some, strong). Changing it routes the lines again. Default some. */
  avoidCrossings?: AvoidCrossings
  /** Called whenever the edges are planned (a new layout, a drag frame, a new style) with counts and the time it took. */
  onEdgeStats?: (s: EdgeStats) => void
  /** The look: tokens for colours, materials, labels and lines. Default Classic. */
  theme?: Theme
}

export function SceneView({ data, labelMode, mode, camera, showFps = true, controls, onNodeClick, hasClick = !!onNodeClick, onFirstFrame, crossings = 'none', avoidCrossings = 'some', onEdgeStats, theme = CLASSIC }: SceneViewProps) {
  const fpsRef = useRef<HTMLDivElement>(null)
  const [own] = useState(createCamera)
  const c = camera ?? own
  const ctl = controls ?? ALL_ON
  useEffect(() => { if (c.mode !== mode) c.setMode(mode) }, [c, mode])
  return (
    <>
      <Canvas shadows={theme.light.shadows} flat={!theme.light.toneMapping} dpr={[1, 2]} camera={{ fov: 1, near: 1, far: 5000, position: [0, 100, 0] }} gl={{ antialias: true, stencil: true }}>
        <color attach="background" args={[theme.ground.bg]} />
        <ThemeProvider theme={theme} key={theme.name + JSON.stringify(theme).length}>
        <FirstFrame cam={c} data={data} onFirstFrame={onFirstFrame} />
        <Rig cam={c} fpsRef={fpsRef} />
        {data && ('kind' in data
          ? <Env cam={c} controls={ctl}><SeqScene data={data} labelMode={labelMode} onNodeClick={onNodeClick} hasClick={hasClick} /></Env>
          : <Scene cam={c} data={data} labelMode={labelMode} onDrill={c.focusOn} controls={ctl} onNodeClick={onNodeClick} hasClick={hasClick} crossings={crossings} avoidCrossings={avoidCrossings} onEdgeStats={onEdgeStats} />)}
        </ThemeProvider>
      </Canvas>
      {showFps && <div ref={fpsRef} style={{ position: 'absolute', right: 12, bottom: 10, color: '#7f8aa3', font: '12px monospace' }} />}
    </>
  )
}

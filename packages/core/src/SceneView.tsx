import * as THREE from 'three'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { Box, LayoutResult, Route } from './model'
import { reroute, PAD } from './layout'
import { loadAvoid, routerFor, type EdgeRouter, type AvoidCrossings } from './avoid.ts'
import { measureRoutes, type RouteQuality } from './routeMetrics.ts'
import { instant } from './telemetry'
import { createCamera, biggestTray, contentOf, frameOf, PRESET, type Camera, type Mode } from './camera'
import { SeqScene } from './SeqScene'
import type { SeqLayout } from './seq'
import { NodeBody, Tray, baseOf, nodeHeight, type LabelMode } from './shapes'
import { ThemeProvider, ToneSetup, InkStore, InkCtx, useTheme, grainTexture } from './look'
import { CLASSIC, inkPx, type Theme } from './theme'
import { Edge, Trench, PortalSystem, slotShape, stadium, drawnParts } from './EdgeScene'
import { Optics, beamColours } from './Optics'
import { laserColours, roles } from './lasers.ts'
import { planEdges, type Body, type CrossingStyle, type Slot, type Stats } from './edges3d.ts'
import { S, NODE_H, TEXT_LAYER } from './scale'
import { UI } from './palette'
import { ALL_ON, TURN_PER_PX, WHEEL_IDLE_MS, chipAt, cursorFor, dragAction, gesture, hintText, holdable, isPinch, isSwapped, modKey, pairOf, settleYaw, swipeLatch, twoFingers, wheelAction, wheelInput, wheelPan, wheelPx, wheelTurn, wheelZoom, type Input, type Pair, type Radii } from './controls'
import { Gate, HINT_MS, clipRadii, inScroller } from './hold'
import type { NodeClick, ResolvedControls } from './options'

const LIGHT_TILTED = new THREE.Vector3(10, 18, 7) // iso and 3D
const LIGHT_FLAT = new THREE.Vector3(21.8 * Math.sin(Math.PI / 36), 21.8 * Math.cos(Math.PI / 36), 0) // flat: 5 degrees off straight overhead, same distance

type Ovr = Record<string, { x: number; y: number }>

// The diagram's hold gate (hold.ts), for the scene's gesture handlers inside the canvas.
const GateCtx = createContext<Gate | null>(null)
const MOD = modKey(typeof navigator !== 'undefined' ? navigator.platform : '')

// `live` are the router's routes while a node is dragged; without a router (the wasm did not load) a moved node's lines take the cheap Manhattan route.
function effective(data: LayoutResult, ovr: Ovr, live: Route[] | null) {
  const boxes = new Map<string, Box>()
  for (const b of data.boxes) boxes.set(b.id, ovr[b.id] ? { ...b, ...ovr[b.id] } : b)
  const routes: Route[] = live ?? data.routes.map(r =>
    ovr[r.from] || ovr[r.to] ? { ...r, points: reroute(boxes.get(r.from)!, boxes.get(r.to)!) } : r)
  return { boxes, routes }
}

function Rig({ cam, fpsRef }: { cam: Camera; fpsRef: React.RefObject<HTMLDivElement | null> }) {
  const acc = useRef({ t: 0, n: 0 })
  const th = useTheme()
  const ink = useContext(InkCtx)
  const inkSeen = useRef({ ppu: 0, frame: 0 })
  const base = useRef(new WeakMap<object, { base: number; set: number }>())
  // labels live on TEXT_LAYER (left out of portal views); the main camera shows it for every diagram, a sequence one included
  const { camera: main } = useThree()
  useEffect(() => { main.layers.enable(TEXT_LAYER) }, [main])
  useFrame(({ camera, size, scene }, dt) => {
    cam.aspect = size.width / size.height
    cam.frameH = size.height
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
    // Ink follows the drawing's scale (theme.ink): the line materials get their width for this zoom, the landscape forms a matching step.
    const ppu = size.height / c.H
    ink.ppu = ppu
    if (th.ink.ref !== null) {
      const seen = inkSeen.current
      if (Math.abs(ppu - seen.ppu) > seen.ppu * 0.004 || ++seen.frame % 30 === 0) {
        seen.ppu = ppu
        scene.traverse((o: any) => {
          const m = o.material
          if (!m || !m.isLineMaterial) return
          let e = base.current.get(m)
          if (!e || m.linewidth !== e.set) { e = { base: m.linewidth, set: m.linewidth }; base.current.set(m, e) } // React set a new width: that is the new base
          const w = inkPx(th, e.base, ppu)
          if (m.linewidth !== w) { m.linewidth = w; e.set = w }
        })
        ink.setBucket(Math.round(Math.log2(inkPx(th, th.node.outlineWidth, ppu) / th.node.outlineWidth) * 4))
      }
    }
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
  const major = Math.round(Number(th.ground.major) || 0) // a hand-made theme from before the heavier line has none
  // Flat view: the light is almost overhead (5 degrees off), so shadows are short. It eases between the two like the camera does.
  const light = useRef<THREE.DirectionalLight>(null!)
  const lightAt = useRef(new THREE.Vector3(10, 18, 7))
  useFrame((_, dt) => {
    const to = cam.mode === 'flat' ? LIGHT_FLAT : LIGHT_TILTED
    lightAt.current.lerp(to, 1 - Math.exp(-6 * Math.min(dt, 0.1)))
    light.current?.position.copy(lightAt.current)
  })
  const gate = useContext(GateCtx)!
  // move the view by a screen offset in px, the way a drag would
  const panBy = (dx: number, dy: number) => {
    const g = cam.goal, c = cam.cur
    const upp = c.H / gl.domElement.clientHeight
    const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw)
    const mx = -dx * upp * cy + dy * upp * (-sy) / Math.sin(c.pitch)
    const mz = dx * upp * sy + dy * upp * (-cy) / Math.sin(c.pitch)
    g.tx += mx; g.tz += mz; c.tx += mx; c.tz += mz
  }
  const zoomBy = (f: number) => { cam.goal.H = Math.min(200, Math.max(3, cam.goal.H * f)) }
  // flat and iso turn about the vertical only; 3D tilts too
  const turnBy = (dyaw: number, dpitch: number) => {
    const g = cam.goal
    g.yaw += dyaw
    if (cam.mode === '3d') g.pitch = Math.min(1.5, Math.max(0.15, g.pitch + dpitch))
  }
  const settle = () => { cam.goal.yaw = settleYaw(cam.mode, cam.goal.yaw, PRESET[cam.mode].yaw) }

  const startCamDrag = (e: ThreeEvent<PointerEvent>) => {
    const ne = e.nativeEvent
    if (ne.pointerType === 'touch') {
      // one finger in a page that scrolls is the page's (with a hint); two fingers are handled below
      if (!gate.engaged()) { gate.hint(); return }
      if (gate.fingers > 1) return
    }
    const action = dragAction(controls, cam.mode, ne.button, ne.shiftKey, ne.pointerType)
    if (action === 'none') return
    let lx = ne.clientX, ly = ne.clientY
    const span = gesture(action, { via: ne.pointerType === 'touch' ? 'touch' : 'drag', mode: () => cam.mode, swapped: ne.pointerType !== 'touch' && isSwapped(ne.button, ne.shiftKey) })
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== ne.pointerId) return
      const dx = ev.clientX - lx, dy = ev.clientY - ly
      lx = ev.clientX; ly = ev.clientY
      if (gate.fingers > 1) return // a second finger is down: the two-finger gesture has the view
      span.touch()
      if (action === 'turn') turnBy(-dx * TURN_PER_PX, dy * TURN_PER_PX)
      else panBy(dx, dy)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== ne.pointerId) return
      if (action === 'turn') settle()
      span.end()
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }

  useEffect(() => {
    const el = gl.domElement
    const mode = () => cam.mode
    const wheelSpan = {
      zoom: gesture('zoom', { idleMs: WHEEL_IDLE_MS, mode }),
      pinch: gesture('zoom', { idleMs: WHEEL_IDLE_MS, via: 'pinch', mode }),
      pan: gesture('pan', { idleMs: WHEEL_IDLE_MS, mode }),
      turn: gesture('turn', { idleMs: WHEEL_IDLE_MS, mode, swapped: true }),
    }
    const touchSpan = { zoom: gesture('zoom', { via: 'touch', mode }), turn: gesture('turn', { via: 'touch', mode }), pan: gesture('pan', { via: 'touch', mode }) }

    // a page that scrolls keeps one finger for its own scrolling until the diagram is held
    const touchAction = () => { el.style.touchAction = gate.engaged() ? 'none' : 'pan-x pan-y' }
    touchAction()

    const latch = swipeLatch()
    const wheel = (e: WheelEvent) => {
      gate.setInput(wheelInput(e))
      const a = latch(wheelAction(controls, e, gate.engaged(), cam.mode), e.timeStamp)
      if (a === 'pass') return
      if (a === 'hint') { gate.hint(); return }
      // every other wheel is stopped from its first event: the browser decides on a sideways swipe's Back from the first ones
      e.preventDefault()
      if (a === 'block') { gate.hint(); return }
      const { dx, dy } = wheelPx(e, el.clientHeight)
      if (a === 'zoom') {
        // a trackpad pinch is a ctrl wheel in small steps; cmd/ctrl + a mouse wheel is the key form
        if (isPinch(e)) wheelSpan.pinch.touch(); else wheelSpan.zoom.touch()
        zoomBy(wheelZoom(dy))
      } else if (a === 'turn') {
        wheelSpan.turn.touch()
        turnBy(...wheelTurn(dx, dy))
      } else {
        wheelSpan.pan.touch()
        panBy(...wheelPan(dx, dy, e.shiftKey))
      }
    }

    // two fingers on a touch screen: pinch zooms, a twist turns, the middle moves the view (in 3D, up and down tilts)
    const touches = new Map<number, { x: number; y: number; x0: number; y0: number }>()
    let last: Pair | null = null
    const pair = () => { const [p, q] = [...touches.values()]; return pairOf(p, q) }
    const take = (how: 'click' | 'touch') => { if (holdable(controls)) gate.hold(true, how) }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') {
        gate.setInput(gate.input === 'touch' ? 'mouse' : gate.input)
        take('click')
        return
      }
      gate.setInput('touch')
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
      gate.fingers = touches.size
      if (touches.size === 2) { take('touch'); last = pair() }
    }
    const tmove = (e: PointerEvent) => {
      const t = touches.get(e.pointerId)
      if (!t) return
      t.x = e.clientX; t.y = e.clientY
      if (touches.size !== 2 || !last) return
      const now = pair()
      const m = twoFingers(last, now, cam.mode)
      // every part moves the view; a part is only counted (a span) once it is more than a finger's jitter
      if (controls.zoom) { zoomBy(m.zoom); if (Math.abs(m.zoom - 1) > 0.004) touchSpan.zoom.touch() }
      if (controls.pan) {
        turnBy(m.yaw, m.pitch); if (Math.abs(m.yaw) > 0.004 || Math.abs(m.pitch) > 0.004) touchSpan.turn.touch()
        panBy(...m.pan); if (Math.hypot(...m.pan) > 1) touchSpan.pan.touch()
      }
      last = now
    }
    const tup = (e: PointerEvent) => {
      const t = touches.get(e.pointerId)
      if (!t) return
      touches.delete(e.pointerId)
      // a tap (no second finger, hardly moved, not taken by the page's scrolling) takes hold
      if (e.type === 'pointerup' && !last && touches.size === 0 && Math.hypot(t.x - t.x0, t.y - t.y0) < 10) take('touch')
      gate.fingers = touches.size
      if (touches.size < 2 && last) { last = null; touchSpan.zoom.end(); touchSpan.turn.end(); touchSpan.pan.end(); settle() }
    }
    // let go on Esc or a press outside the diagram
    const outside = (e: PointerEvent) => { if (gate.el && !gate.el.contains(e.target as Node)) gate.hold(false, 'outside') }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') gate.hold(false, 'esc') }

    // the wheel over the whole diagram (its fps readout and overlays too), so no part of it hands a swipe to the page
    const area = el.closest<HTMLElement>('[data-bonkei-scene]') ?? el
    gate.listeners.add(touchAction)
    area.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', tmove)
    window.addEventListener('pointerup', tup); window.addEventListener('pointercancel', tup)
    window.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', esc)
    window.addEventListener('resize', touchAction); window.addEventListener('scroll', touchAction, { passive: true })
    return () => {
      gate.listeners.delete(touchAction)
      area.removeEventListener('wheel', wheel); el.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', tmove)
      window.removeEventListener('pointerup', tup); window.removeEventListener('pointercancel', tup)
      window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', esc)
      window.removeEventListener('resize', touchAction); window.removeEventListener('scroll', touchAction)
      for (const g of [...Object.values(wheelSpan), ...Object.values(touchSpan)]) g.end()
    }
  }, [cam, gl, controls, gate])

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
      {/* ground.major: a heavier line every `major` squares (whole squares), a second grid in its own colour over the fine one. Its lines lie
          exactly on fine ones, centred like them, and are drawn after them (the default depth test passes an equal depth), so the heavier
          colour shows without flicker */}
      {th.ground.grid && major > 0 && <gridHelper key={`major${major}${slots.length ? 'masked' : 'plain'}`} args={[2 * Math.floor(100 / major) * major, 2 * Math.floor(100 / major), th.ground.majorColor, th.ground.majorColor]} position={[0, -0.01, 0]} renderOrder={2}
        material-stencilWrite={slots.length > 0} material-stencilRef={1} material-stencilFunc={THREE.NotEqualStencilFunc} />}
      {children}
    </>
  )
}

function Scene({ cam, data, labelMode, onDrill, controls, onNodeClick, hasClick, crossings, avoidCrossings, onEdgeStats }: {
  cam: Camera; data: LayoutResult; labelMode: LabelMode; onDrill: (cx: number, cz: number, X: number, Z: number, id?: string) => void
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
  const bodies = useMemo<Body[]>(() => [...boxes.values()].map(b => ({ id: b.id, kind: b.kind, x0: wx(b.x), z0: wz(b.y), x1: wx(b.x + b.w), z1: wz(b.y + b.h), level: b.level, parent: b.parent, height: b.kind === 'node' ? nodeHeight(th, b) : b.height, tray: th.tray.thickness })), [boxes, W, H, th.tray.thickness, th.node.form, th.node.footprint.height])
  const { plans, stats, slots, ms } = useMemo(() => {
    const t0 = performance.now()
    const r = planEdges(bodies, routes.map(r => ({ id: r.id, from: r.from, to: r.to, points: r.points.map(([x, y]) => [wx(x), wz(y)] as [number, number]) })), crossings)
    return { ...r, ms: performance.now() - t0 }
  }, [bodies, routes, crossings, W, H])
  // Lazers: each node's laser colour (from the text, else automatic), its role from its edges, and every drawn line for the mirrors
  const beams = !!th.edge.beam?.on
  const edgesKey = routes.map(r => `${r.from}>${r.to}`).join(',') + '|' + [...boxes.values()].map(b => b.color ?? '').join(',')
  const laser = useMemo(() => {
    if (!beams) return null
    const given: Record<string, string> = {}
    for (const b of boxes.values()) if (b.color) given[b.id] = b.color
    return { ...laserColours(routes, given, th.node.lasers), given: Object.keys(given).length }
  }, [beams, edgesKey, th.node.lasers])
  const devices = useMemo(() => {
    if (th.node.form !== 'device') return null
    const r = roles([...boxes.keys()], routes)
    const caught = new Map<string, string>()
    for (const e of routes) if (!caught.has(e.to)) caught.set(e.to, laser?.colours.get(e.from) ?? th.edge.color)
    return { roles: r, caught }
  }, [th.node.form, edgesKey, laser])
  const pals = useMemo(() => {
    const bm = th.edge.beam
    return routes.map(r => beamColours(laser?.colours.get(r.from) ?? th.edge.color, bm?.centre ?? 0.85, bm?.halo ?? null))
  }, [routes, laser, th.edge.beam, th.edge.color])
  const optLines = useMemo(() => {
    if (!th.edge.optics?.on) return null
    return routes.flatMap((r, ci) => {
      const p = plans.get(r.id)
      return p ? drawnParts(p, th.edge.flat, bodies).map(part => ({ ci, pts: part.map(q => q.toArray() as [number, number, number]) })) : []
    })
  }, [plans, routes, bodies, th.edge.optics, th.edge.flat])
  const lazerCounts = useRef<{ mirrors: number; periscopes: number; halves: number; prisms: number; prismKinds: Record<string, number> } | null>(null)
  useEffect(() => {
    if (!laser && !lazerCounts.current) return
    const c = lazerCounts.current
    ;(gl.domElement as unknown as { __lazers?: unknown }).__lazers = { ...c, colours_text: laser?.given ?? 0, colours_auto: laser?.auto ?? 0 }
    instant('bonkei.lazers', { 'bonkei.lazers.mirrors': c?.mirrors ?? 0, 'bonkei.lazers.periscopes': c?.periscopes ?? 0, 'bonkei.lazers.half_mirrors': c?.halves ?? 0, 'bonkei.lazers.prisms': c?.prisms ?? 0, 'bonkei.lazers.colours_text': laser?.given ?? 0, 'bonkei.lazers.colours_auto': laser?.auto ?? 0 })
  }, [laser, optLines === null ? 0 : optLines.length])
  const groundSlots = useMemo(() => slots.filter(s => !s.tray), [slots])
  const portalList = useMemo(() => [...plans.values()].flatMap(p => p.portals), [plans])
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

  const gate = useContext(GateCtx)!
  const startNodeDrag = (e: ThreeEvent<PointerEvent>, id: string) => {
    const ne = e.nativeEvent
    // a right-drag or Shift + drag over a node turns (or moves) the view like one on the background; one finger in a page that scrolls is the page's
    if (ne.button !== 0 || ne.shiftKey || (ne.pointerType === 'touch' && !gate.engaged())) return
    e.stopPropagation()
    const b = boxes.get(id)!
    const planeY = baseOf(b, th.tray.thickness) + nodeHeight(th, b)
    const p0 = groundPoint(e.nativeEvent.clientX, e.nativeEvent.clientY, planeY)
    if (!p0) return
    const gx = p0.x / S + W / 2 - b.x, gy = p0.z / S + H / 2 - b.y
    const parent = b.parent ? data.boxes.find(x => x.id === b.parent) : undefined
    setCursor('grabbing')
    const span = gesture('move', { via: ne.pointerType === 'touch' ? 'touch' : 'drag', mode: () => cam.mode })
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== ne.pointerId || gate.fingers > 1) return // two fingers: the view's pinch and twist, not the node
      span.touch()
      const p = groundPoint(ev.clientX, ev.clientY, planeY)
      if (!p) return
      let x = p.x / S + W / 2 - gx, y = p.z / S + H / 2 - gy
      if (parent) { // keep inside parent tray (with its title off the tray, the top keeps only the side's room, as the layout did)
        x = Math.min(Math.max(x, parent.x + PAD.side), parent.x + parent.w - b.w - PAD.side)
        y = Math.min(Math.max(y, parent.y + (data.titleRoom ? PAD.side : PAD.top)), parent.y + parent.h - b.h - PAD.side)
      }
      const r = router.current
      if (r) { const at = r.at(id); live.current = r.move(id, x - at.x, y - at.y); moveMs.current = r.stats.moveMs }
      ovr.current = { ...ovr.current, [id]: { x, y } }
      setVer(v => v + 1)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== ne.pointerId) return
      span.end(); setCursor(cursorFor('node', controls, hasClick))
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }

  return (
    <>
      <Env cam={cam} controls={controls} slots={groundSlots}>
      {[...boxes.values()].map(b => {
        const w = b.w * S, h = b.h * S
        const pos: [number, number, number] = [wx(b.x) + w / 2, baseOf(b, th.tray.thickness), wz(b.y) + h / 2]
        if (b.kind === 'group') {
          return (
            <group key={b.id} position={pos}
              onClick={e => {
                if (e.delta >= 4) return
                e.stopPropagation()
                onNodeClick?.({ id: b.id, label: b.label, kind: 'group' })
                if (controls.drillIn) onDrill(pos[0], pos[2], w, h, b.id)
              }}
              onPointerOver={e => { e.stopPropagation(); setHover(b.id); setCursor(cursorFor('group', controls, hasClick)) }}
              onPointerOut={() => { setHover(null); setCursor('') }}>
              <Tray b={b} labelMode={labelMode} hover={hover === b.id} kids={th.tray.titles === 'free' ? [...boxes.values()].filter(k => k.parent === b.id).map(k => ({ x0: wx(k.x) - pos[0], x1: wx(k.x + k.w) - pos[0], z0: wz(k.y) - pos[2], z1: wz(k.y + k.h) - pos[2] })) : undefined} slots={slots.filter(s => s.tray === b.id).map(s => ({ x0: s.x0 - pos[0], x1: s.x1 - pos[0], z0: s.z0 - pos[2], z1: s.z1 - pos[2] }))} />
            </group>
          )
        }
        return <NodeLift key={b.id} pos={pos} hover={hover === b.id}
          onDown={e => { if (controls.move) startNodeDrag(e, b.id) }}
          onClick={e => { if (e.delta < 4) { e.stopPropagation(); onNodeClick?.({ id: b.id, label: b.label, kind: 'node' }) } }}
          onOver={() => { setHover(b.id); setCursor(cursorFor('node', controls, hasClick)) }}
          onOut={() => { setHover(null); setCursor('') }}>
          <NodeBody b={b} hover={hover === b.id} labelMode={labelMode} device={devices ? { role: devices.roles.get(b.id) ?? 'idle', caught: devices.caught.get(b.id) ?? null, fires: laser?.colours.get(b.id) ?? null } : undefined} />
        </NodeLift>
      })}
      {routes.map(r => plans.get(r.id) ? <Edge key={r.id} plan={plans.get(r.id)!} label={r.label} labelMode={labelMode} bodies={bodies} color={laser?.colours.get(r.from)} /> : null)}
      {optLines && <Optics lines={optLines} pals={pals} onCount={c => { lazerCounts.current = c }} />}
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

// On the first frame drawn with each new `data`. The camera's first layout ever is framed (with the real aspect, known only once
// the canvas has a size) and snapped to. Every later one (a new source, a new theme, another avoid-crossings level) keeps the view:
// same pose, same tray flown into, lined up on what is on screen (camera.relayout, BON-195). Then it is reported once.
function FirstFrame({ cam, data, onFirstFrame }: { cam: Camera; data: LayoutResult | SeqLayout | null; onFirstFrame?: () => void }) {
  const seen = useRef<LayoutResult | SeqLayout | null>(null)
  const cb = useRef(onFirstFrame)
  cb.current = onFirstFrame
  useFrame(({ size }) => {
    if (!data || seen.current === data) return
    seen.current = data
    if (size.width > 0 && size.height > 0) { cam.aspect = size.width / size.height; cam.frameH = size.height }
    cam.content = 'boxes' in data ? contentOf(data.boxes, data.width, data.height) : []
    if (!cam.layout) {
      cam.whole = false
      cam.fit(data.width, data.height, 'boxes' in data && cam.minLabel > 0 ? biggestTray(data.boxes, data.width, data.height) : undefined)
      cam.adopt(frameOf(data))
      cam.snap()
    } else {
      const kept = cam.relayout(frameOf(data))
      instant('bonkei.relayout_kept_view', {
        'bonkei.view.anchor': kept.anchor, 'bonkei.view.tray': kept.tray,
        'bonkei.view.shift': Math.hypot(kept.shiftX, kept.shiftZ), 'bonkei.view.edits': cam.edits, 'bonkei.mode': cam.mode,
      })
    }
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
  /** Called once per `data`, on the first frame drawn with it (after the camera has framed it, or kept its view for a later one). */
  onFirstFrame?: () => void
  /** How crossing lines get past each other: not at all (default), by a bridge, a tunnel or portals. Steps between heights are always on. */
  crossings?: CrossingStyle
  /** How hard the router tries to keep lines from crossing (off, some, strong). Changing it routes the lines again. Default some. */
  avoidCrossings?: AvoidCrossings
  /** Called whenever the edges are planned (a new layout, a drag frame, a new style) with counts and the time it took. */
  onEdgeStats?: (s: EdgeStats) => void
  /** The look: tokens for colours, materials, labels and lines. Default Classic. */
  theme?: Theme
  /** Called when the reader switches input (a trackpad, a mouse wheel, a touch screen), for the gesture card (BON-78). */
  onInput?: (input: Input) => void
}

export function SceneView({ data, labelMode, mode, camera, showFps = true, controls, onNodeClick, hasClick = !!onNodeClick, onFirstFrame, crossings = 'none', avoidCrossings = 'some', onEdgeStats, theme = CLASSIC, onInput }: SceneViewProps) {
  const fpsRef = useRef<HTMLDivElement>(null)
  const [inkStore] = useState(() => new InkStore())
  const [own] = useState(createCamera)
  const c = camera ?? own
  const ctl = controls ?? ALL_ON
  useEffect(() => { if (c.mode !== mode) c.setMode(mode) }, [c, mode])
  const themeKey = useMemo(() => JSON.stringify(theme), [theme])

  // BON-78: whether the diagram has the gestures (hold.ts), the hint, and the ring while it is held
  const [gate] = useState(() => new Gate())
  const box = useRef<HTMLDivElement>(null)
  const [held, setHeld] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [radii, setRadii] = useState<Radii>([0, 0, 0, 0])
  const inputCb = useRef(onInput)
  inputCb.current = onInput
  useEffect(() => {
    // the diagram's whole box (the component's, toolbar included): a press there does not let go
    gate.el = box.current?.closest<HTMLElement>('[data-bonkei]') ?? box.current
    gate.mode = () => c.mode
    gate.onInput = i => inputCb.current?.(i)
    let t = 0
    const onHold = () => {
      const show = gate.held && inScroller(gate.el)
      if (show && box.current) setRadii(clipRadii(box.current))
      setHeld(show)
      if (gate.held) { clearTimeout(t); setHint(null) }
    }
    gate.listeners.add(onHold)
    gate.onHint = () => {
      setHint(hintText(gate.input, ctl.zoom, MOD))
      clearTimeout(t); t = window.setTimeout(() => setHint(null), HINT_MS)
    }
    return () => { clearTimeout(t); gate.listeners.delete(onHold); gate.onHint = () => {} }
  }, [gate, c, ctl.zoom])
  const [chipX, chipY] = chipAt(radii)

  return (
    // no browser menu over the diagram: a right-drag (or Ctrl-click on a Mac) is a gesture here; a swipe that reaches its edge
    // does not chain to the page (only the diagram's own box: the host page's html and body are not ours)
    <div ref={box} data-bonkei-scene="" onContextMenu={e => e.preventDefault()} style={{ position: 'relative', width: '100%', height: '100%', overscrollBehavior: 'none' }}>
      <Canvas shadows={theme.light.shadows} dpr={[1, 2]} camera={{ fov: 1, near: 1, far: 5000, position: [0, 100, 0] }} gl={{ antialias: true, stencil: true }}>
        <color attach="background" args={[theme.ground.bg]} />
        <FirstFrame cam={c} data={data} onFirstFrame={onFirstFrame} />
        {/* A new look mounts the scene afresh (keyed by the whole token object): the ink pass rescales line widths in place,
            and a remount is what gives every line its token width back. The camera and the first-frame fit stay outside, so the view keeps its place. */}
        <GateCtx.Provider value={gate}><InkCtx.Provider value={inkStore}><ThemeProvider theme={theme} key={themeKey}>
          <ToneSetup />
          <Rig cam={c} fpsRef={fpsRef} />
          {data && ('kind' in data
            ? <Env cam={c} controls={ctl}><SeqScene data={data} labelMode={labelMode} onNodeClick={onNodeClick} hasClick={hasClick} /></Env>
            : <Scene cam={c} data={data} labelMode={labelMode} onDrill={c.focusOn} controls={ctl} onNodeClick={onNodeClick} hasClick={hasClick} crossings={crossings} avoidCrossings={avoidCrossings} onEdgeStats={onEdgeStats} />)}
        </ThemeProvider></InkCtx.Provider></GateCtx.Provider>
      </Canvas>
      {held && (
        // the ring follows the corners of whatever clips the diagram; the chip keeps clear of a big rounded corner
        <div data-bonkei-held="" style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 2px ${UI.on}`, borderRadius: radii.map(r => r + 'px').join(' '), pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: chipX, top: chipY, padding: '3px 8px', borderRadius: 6, background: UI.panel, color: UI.muted, font: '12px system-ui, sans-serif' }}>Esc to let go</div>
        </div>
      )}
      <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, display: hint ? 'grid' : 'none', placeItems: 'center', background: 'rgba(0, 0, 0, 0.55)', color: UI.text, font: '15px system-ui, sans-serif', pointerEvents: 'none' }}>{hint}</div>
      {showFps && <div ref={fpsRef} style={{ position: 'absolute', right: 12, bottom: 10, color: '#7f8aa3', font: '12px monospace' }} />}
    </div>
  )
}

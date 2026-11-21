// A stage from a glTF model (BON-253): load it, find its named parts, lay it out for the camera. No React here.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import * as THREE from 'three'
import type { Span } from '@opentelemetry/api'
import type { BonkeiError, BonkeiWarning } from './options.ts'
import { S } from './scale.ts'
import { withSpan } from './telemetry.ts'

import { normaliseName } from './names.ts'
export { normaliseName }

/** A named top-level object of the model, as laid out: `x`, `y`, `w`, `h` are its footprint in layout px (top-left, like a box), `top` its height in world units. */
/** The part's body: its mesh of the largest volume (the grill's counter, not the hood over it; the exchange's walls, not its roof), where a name written on the part's own sides goes. */
export interface PartBody { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }
export interface StagePart { id: string; label: string; x: number; y: number; w: number; h: number; top: number; cx: number; cz: number; pieces: number; body: PartBody; solids: PartBody[] }
export interface StageLayout {
  kind: 'stage'; width: number; height: number
  model: THREE.Object3D // the scene, its footprint centred on the origin
  parts: StagePart[]
  blockers?: { x0: number; x1: number; z0: number; z1: number; h: number; part: number }[] // what stands on the floor (parts and unnamed objects over 0.3 high): world footprints, their height, and the part's index (-1: unnamed). Zones keep off them and a name keeps out of the floor they hide
  floor?: { group: THREE.Object3D; rect: { x0: number; x1: number; z0: number; z1: number } } | null // the model's own floor (its largest flat mesh at ground level), under a group the scene moves and stretches to grow it; null: the model has none
  floorTo?: { x0: number; x1: number; z0: number; z1: number } | null // the floor as grown to hold the zones (stageZones.ts framed); null: as it is
  zones?: (import('./stageZones.ts').Zone | null)[] // each part's zone under the label mode; null: it has none
  sides?: (import('./stageZones.ts').SideName | null)[] // a part whose name is not on its floor: the name written on its own sides, if it fits there
  base?: { x0: number; x1: number; z0: number; z1: number } | null // a floor in the theme's style, only for a model with no floor of its own, when a zone runs past the model
  reach?: number // how high the tallest floating name reaches, world units (stageZones.ts framed)
  ox?: number; oz?: number // where the model and its names are moved to centre the whole on the origin
  tall: number // how high the model stands, world units: the camera's fit leaves room for it
  url: string
}
/** What an embedder is told about a stage's parts (ReadyInfo.stage). */
export interface StageInfo { url: string; parts: { name: string; pieces: number }[] }

const fail = (message: string): BonkeiError => ({ kind: 'stage', message })
const COMPRESSION: Record<string, string> = {
  KHR_draco_mesh_compression: 'Draco compression', EXT_meshopt_compression: 'meshopt compression', KHR_texture_basisu: 'KTX2 (Basis) textures',
}
const nameOf = (o: THREE.Object3D) => {
  const n = (o.userData as { name?: unknown }).name // the glTF node's own name; object.name is sanitised ("prep line" -> "prep_line")
  return typeof n === 'string' && n.trim() ? n.trim() : undefined
}
const namedBelow = (o: THREE.Object3D) => { let n = 0; o.traverse(c => { if (c !== o && nameOf(c)) n++ }); return n }

/** Which of the scene's objects are parts: the named ones directly under it; a lone wrapper node is looked through. */
export function findParts(scene: THREE.Object3D): { parts: { name: string; object: THREE.Object3D; pieces: number }[]; others: THREE.Object3D[]; warnings: string[]; skipped: number } {
  let top = scene.children
  if (top.length === 1 && top[0].children.length) top = top[0].children
  const parts = top.flatMap(object => { const name = nameOf(object); return name ? [{ name, object, pieces: namedBelow(object) }] : [] })
  const seen = new Map<string, number>()
  for (const p of parts) { const k = normaliseName(p.name); seen.set(k, (seen.get(k) ?? 0) + 1) }
  const warnings = [...seen].filter(([, n]) => n > 1).map(([k]) => `two parts are named "${parts.find(p => normaliseName(p.name) === k)!.name}"; a script pointing at it will use the first`)
  return { parts, others: top.filter(o => !nameOf(o)), warnings, skipped: parts.reduce((n, p) => n + p.pieces, 0) }
}

/** Reads the JSON of a .glb or .gltf; throws a stage error when it is neither. */
export function sniff(buf: ArrayBuffer, what: string): { extensionsUsed?: string[]; extensionsRequired?: string[] } {
  const dv = new DataView(buf)
  let text: string
  if (buf.byteLength >= 20 && dv.getUint32(0, true) === 0x46546c67) { // 'glTF'
    const len = dv.getUint32(12, true)
    text = new TextDecoder().decode(new Uint8Array(buf, 20, Math.min(len, buf.byteLength - 20)))
  } else text = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 50_000_000)))
  let json: any
  try { json = JSON.parse(text) } catch { throw fail(`${what} isn't a glTF file (it is not a .glb or a .gltf)`) }
  if (!json || typeof json !== 'object' || !json.asset) throw fail(`${what} isn't a glTF file (no "asset" in it)`)
  return json
}

type Gltf = { scene: THREE.Group; scenes: THREE.Group[] }
let loaderLoad: Promise<{ parse(data: ArrayBuffer, path: string, ok: (g: Gltf) => void, bad: (e: unknown) => void): void }> | null = null
// three's own GLTFLoader, fetched on the first stage (like ELK), so a diagram with no stage loads none of it. Its own span.
function getLoader(parent?: Span) {
  loaderLoad ??= withSpan('bonkei.stage.loader.load', {}, async () => {
    const m = await import('three/examples/jsm/loaders/GLTFLoader.js')
    return new m.GLTFLoader() as any
  }, parent).catch(e => { loaderLoad = null; throw e })
  return loaderLoad
}

const host = (url: string) => { try { return new URL(url, typeof location !== 'undefined' ? location.href : undefined).host } catch { return '' } }
const fileOf = (url: string) => url.split(/[?#]/)[0].split('/').pop() || url

/** Fetches, checks and reads the model at `url`, and lays its parts out. Rejects with a `stage` BonkeiError. */
export async function loadStage(url: string, parent?: Span, fetcher: typeof fetch = fetch): Promise<{ layout: StageLayout; warnings: BonkeiWarning[]; info: StageInfo }> {
  return withSpan('bonkei.stage.load', { 'bonkei.stage.host': host(url) }, async span => {
    const t0 = performance.now()
    const name = fileOf(url)
    try {
      let res: Response
      try { res = await fetcher(url) } catch { throw fail(`the stage ${url} couldn't be fetched; the site may not allow other pages to load it (CORS), or it is unreachable`) }
      if (res.status === 404 || /text\/html/.test(res.headers.get('content-type') ?? '')) throw fail(`the stage ${url} wasn't found (${res.status === 404 ? '404' : 'the server sent a web page'})`)
      if (!res.ok) throw fail(`the stage ${url} couldn't be loaded (HTTP ${res.status})`)
      const buf = await res.arrayBuffer()
      span.setAttribute('bonkei.stage.bytes', buf.byteLength)
      const json = sniff(buf, name)
      for (const ext of [...(json.extensionsRequired ?? []), ...(json.extensionsUsed ?? [])]) {
        if (COMPRESSION[ext]) throw fail(`${name} uses ${COMPRESSION[ext]} (${ext}), which Bonkei can't read yet.\nExport again with compression off.`)
      }
      const loader = await getLoader(span)
      const gltf = await new Promise<Gltf>((ok, bad) => loader.parse(buf, url.replace(/[^/]*$/, ''), ok, bad)).catch(e => { throw fail(`${name} couldn't be read as a glTF: ${e instanceof Error ? e.message : String(e)}`) })
      const scene = gltf.scene ?? gltf.scenes?.[0]
      if (!scene) throw fail(`${name} has no scene in it`)
      scene.updateMatrixWorld(true)
      const found = findParts(scene)
      if (!found.parts.length) throw fail(`${name} loaded, but none of its top-level objects has a name.\nName them in your 3D tool (grill, register…) and export again.`)
      // the footprint of the whole model, centred on the origin and standing on the floor
      const all = new THREE.Box3().setFromObject(scene)
      const centre = all.getCenter(new THREE.Vector3())
      scene.position.set(-centre.x, -all.min.y, -centre.z)
      scene.updateMatrixWorld(true)
      const size = all.getSize(new THREE.Vector3())
      const width = size.x / S, height = size.z / S
      const parts = found.parts.map((p, i): StagePart => {
        const b = new THREE.Box3().setFromObject(p.object)
        const c = b.getCenter(new THREE.Vector3())
        const solids: PartBody[] = []
        let body: PartBody = { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, y0: b.min.y, y1: b.max.y }, bodyArea = -1
        p.object.traverse(m => {
          if (!(m as THREE.Mesh).isMesh) return
          const mb = new THREE.Box3().setFromObject(m)
          solids.push({ x0: mb.min.x, x1: mb.max.x, z0: mb.min.z, z1: mb.max.z, y0: mb.min.y, y1: mb.max.y })
          const area = (mb.max.x - mb.min.x) * (mb.max.z - mb.min.z) * (mb.max.y - mb.min.y)
          if (area > bodyArea + 1e-6) { bodyArea = area; body = { x0: mb.min.x, x1: mb.max.x, z0: mb.min.z, z1: mb.max.z, y0: mb.min.y, y1: mb.max.y } }
        })
        return { id: `${i}:${p.name}`, label: p.name, x: b.min.x / S, y: b.min.z / S, w: (b.max.x - b.min.x) / S, h: (b.max.z - b.min.z) / S, top: b.max.y, cx: c.x, cz: c.z, pieces: p.pieces, body, solids }
      })
      // frameOf wants x, y in the layout's own corner-origin px: shift world coords by half the footprint
      for (const p of parts) { p.x += width / 2; p.y += height / 2 }
      const objects = [...found.parts.map((p, i) => [p.object, i] as const), ...found.others.map(o => [o, -1] as const)]
      const blockers = objects.flatMap(([o, part]) => {
        const b = new THREE.Box3().setFromObject(o)
        return b.max.y - b.min.y >= 0.3 ? [{ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, h: b.max.y - b.min.y, part }] : []
      })
      // the model's own floor: the largest flat mesh standing at ground level among the unnamed objects, if it covers half the footprint; it goes under a group so it can be grown
      let floor: StageLayout['floor'] = null
      let best: THREE.Mesh | null = null, bestArea = 0
      for (const o of found.others) o.traverse(m => {
        if (!(m as THREE.Mesh).isMesh) return
        const b = new THREE.Box3().setFromObject(m)
        const area = (b.max.x - b.min.x) * (b.max.z - b.min.z)
        if (b.max.y - b.min.y <= 0.3 && b.min.y <= 0.1 && area > bestArea) { best = m as THREE.Mesh; bestArea = area }
      })
      if (best && bestArea >= 0.5 * size.x * size.z) {
        const b = new THREE.Box3().setFromObject(best)
        const group = new THREE.Group()
        scene.add(group)
        group.attach(best)
        floor = { group, rect: { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z } }
      }
      const warnings = found.warnings.map((message): BonkeiWarning => ({ kind: 'stage', message, line: 0 }))
      span.setAttributes({ 'bonkei.stage.ms': performance.now() - t0, 'bonkei.stage.parts': parts.length, 'bonkei.stage.pieces_skipped': found.skipped, 'bonkei.stage.duplicates': warnings.length })
      return { layout: { kind: 'stage', width, height, model: scene, parts, blockers, floor, tall: size.y, url }, warnings, info: { url, parts: parts.map(p => ({ name: p.label, pieces: p.pieces })) } }
    } catch (e) {
      const err = (e as BonkeiError).kind === 'stage' ? e as BonkeiError : fail(`the stage ${url} couldn't be loaded: ${e instanceof Error ? e.message : String(e)}`)
      span.setAttribute('bonkei.error.kind', 'stage')
      span.setAttribute('bonkei.stage.error', err.message.split('\n')[0].slice(0, 120))
      throw err
    }
  }, parent)
}

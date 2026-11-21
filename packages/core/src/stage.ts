// A stage from a glTF model (BON-253): load it, find its named parts, lay it out for the camera. No React here. This module and what
// it imports beyond the main chunk are a chunk of their own, fetched with the first stage (diagram.ts imports it dynamically); it
// fetches the drawing (StageScene.tsx), a chunk of its own too, alongside the model.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import * as THREE from 'three'
import type { ComponentType } from 'react'
import { SpanStatusCode, type Span } from '@opentelemetry/api'
import type { BonkeiError, BonkeiWarning, Frontmatter } from './options.ts'
import type { Drawn } from './diagram.ts'
import type { Mode, Upright } from './camera.ts'
import { S } from './scale.ts'
import { withSpan } from './telemetry.ts'
import { normaliseName } from './names.ts'
import { framed, type SideName, type Zone } from './stageZones.ts'

export { framed }

/** A box in world units: a part's body or one of its meshes. */
export interface PartBody { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }
/**
 * A named top-level object of the model, as laid out: `x`, `y`, `w`, `h` its footprint in layout px (top-left, like a box), `cx`, `cz` its
 * centre and `top` its height in world units, `pieces` how many named objects it holds, `body` its mesh of the largest volume (the grill's
 * counter, not the hood over it: where a name written on its sides goes) and `solids` all its meshes.
 */
export interface StagePart { id: string; label: string; x: number; y: number; w: number; h: number; top: number; cx: number; cz: number; pieces: number; body: PartBody; solids: PartBody[] }
export interface StageLayout {
  kind: 'stage'; width: number; height: number
  model: THREE.Object3D // the scene, its footprint centred on the origin, standing on y = 0
  parts: StagePart[]
  blockers?: { x0: number; x1: number; z0: number; z1: number; h: number; part: number }[] // what stands on the floor (parts, and each mesh of an unnamed object, 0.3 high or more): world footprints, height, and the part's index (-1: unnamed)
  floor?: { group: THREE.Object3D; rect: { x0: number; x1: number; z0: number; z1: number } } | null // the model's own floor (its largest flat mesh at ground level), under a group the scene stretches to grow it; null: the model has none
  floorTo?: { x0: number; x1: number; z0: number; z1: number } | null // the floor as grown to hold the zones (stageZones.ts framed); null: as it is
  zones?: (Zone | null)[] // each part's zone; null: no clear place for one
  sides?: (SideName | null)[] // a part whose name is not on its zone: the name written on its own sides, if it fits there
  base?: { x0: number; x1: number; z0: number; z1: number } | null // a floor in the theme's style, only for a model with no floor of its own, when a zone runs past the model
  reach?: number // how high the model and its tallest floating name reach, world units
  upright?: Upright[] // each floating name's column of letters, which faces the camera: where it stands and how tall it is (stageZones.ts framed)
  ox?: number; oz?: number // where the model and its names are moved to centre the whole on the origin
  tall: number // how high the model stands, world units
  url: string
  Scene: ComponentType<{ data: StageLayout; mode: Mode }> // what draws it (StageScene.tsx), given by drawStage; SceneView renders it
}
/** A stage as loadStage lays it out, before drawStage gives it its drawing. */
export type StageModel = Omit<StageLayout, 'Scene'>
/** What an embedder is told about a stage's parts (ReadyInfo.stage): the named top-level objects of the model, as written, and how many named pieces each holds. */
export interface StageInfo { url: string; parts: { name: string; pieces: number }[] }

/** Why a stage could not be shown, as telemetry records it (`bonkei.stage.error`): a fixed word, never the address or the file's name. */
export type StageFailure = 'fetch' | 'not_found' | 'http' | 'not_gltf' | 'compressed' | 'unreadable' | 'no_scene' | 'no_parts'
type StageError = BonkeiError & { reason: StageFailure }
const fail = (reason: StageFailure, message: string): StageError => ({ kind: 'stage', message, reason })

const COMPRESSION: Record<string, string> = {
  KHR_draco_mesh_compression: 'Draco compression', EXT_meshopt_compression: 'meshopt compression', KHR_texture_basisu: 'KTX2 (Basis) textures',
}
const nameOf = (o: THREE.Object3D) => {
  const n = (o.userData as { name?: unknown }).name // the glTF node's own name; object.name is sanitised ("prep line" -> "prep_line")
  return typeof n === 'string' && n.trim() ? n.trim() : undefined
}
const namedBelow = (o: THREE.Object3D) => { let n = 0; o.traverse(c => { if (c !== o && nameOf(c)) n++ }); return n }

// the names exporters give the one node they wrap a whole model in (three.js editor and Spline "Scene", Sketchfab, SketchUp, FBX converters' "RootNode")
const WRAPPERS = new Set(['scene', 'root', 'rootnode', 'root node', 'sketchfab model', 'sketchup', 'sketchup model', 'model', 'gltf scenerootnode', 'auxscene'])
/**
 * Whether the scene's one top-level object wraps the model rather than being a part of it: it has no name, or an exporter's wrapper name,
 * or something under it holds named pieces of its own (parts inside). A lone named object whose pieces are plain (the grill: Cube.003, hood) is a part.
 */
const wraps = (o: THREE.Object3D) => {
  const name = nameOf(o)
  return !name || WRAPPERS.has(normaliseName(name)) || o.children.some(c => nameOf(c) && namedBelow(c) > 0)
}

/** Which of the scene's objects are parts: the named ones directly under it; a lone wrapper node is looked through. */
export function findParts(scene: THREE.Object3D): { parts: { name: string; object: THREE.Object3D; pieces: number }[]; others: THREE.Object3D[]; warnings: string[]; skipped: number } {
  let top = scene.children
  if (top.length === 1 && top[0].children.length && wraps(top[0])) top = top[0].children
  const parts = top.flatMap(object => { const name = nameOf(object); return name ? [{ name, object, pieces: namedBelow(object) }] : [] })
  const seen = new Map<string, string[]>()
  for (const p of parts) { const k = normaliseName(p.name); seen.set(k, [...(seen.get(k) ?? []), p.name]) }
  const warnings = [...seen.values()].filter(ns => ns.length > 1).map(ns => `${ns.length} parts are named alike (${ns.map(n => `"${n}"`).join(', ')}); a script pointing at that name will use the first`)
  return { parts, others: top.filter(o => !nameOf(o)), warnings, skipped: parts.reduce((n, p) => n + p.pieces, 0) }
}

/** Reads the JSON of a .glb or .gltf; throws a stage error when it is neither. */
export function sniff(buf: ArrayBuffer, what: string): { extensionsUsed?: string[]; extensionsRequired?: string[] } {
  const dv = new DataView(buf)
  let text: string
  if (buf.byteLength >= 20 && dv.getUint32(0, true) === 0x46546c67) { // 'glTF'
    const len = dv.getUint32(12, true)
    text = new TextDecoder().decode(new Uint8Array(buf, 20, Math.min(len, buf.byteLength - 20)))
  } else text = new TextDecoder().decode(new Uint8Array(buf))
  let json: unknown
  try { json = JSON.parse(text) } catch { throw fail('not_gltf', `${what} isn't a glTF file (it is not a .glb or a .gltf)`) }
  if (!json || typeof json !== 'object' || !('asset' in json)) throw fail('not_gltf', `${what} isn't a glTF file (no "asset" in it)`)
  return json as { extensionsUsed?: string[]; extensionsRequired?: string[] }
}

type Gltf = { scene?: THREE.Group; scenes?: THREE.Group[] }
type Loader = { parse(data: ArrayBuffer, path: string, ok: (g: Gltf) => void, bad: (e: unknown) => void): void }
let loaderLoad: Promise<Loader> | null = null
// three's own GLTFLoader, fetched on the first stage (like ELK), so a diagram with no stage loads none of it. Its own span; a failed fetch is tried again next time.
function getLoader(parent?: Span) {
  loaderLoad ??= withSpan('bonkei.stage.loader.load', {}, async () => {
    const m = await import('three/examples/jsm/loaders/GLTFLoader.js')
    return new m.GLTFLoader() as unknown as Loader
  }, parent).catch(e => { loaderLoad = null; throw e })
  return loaderLoad
}

const host = (url: string) => { try { return new URL(url, typeof location !== 'undefined' ? location.href : undefined).host } catch { return '' } }
const fileOf = (url: string) => url.split(/[?#]/)[0].split('/').pop() || url
// an object's box; one with no shape (a named empty node) is the point where it stands
const box = (o: THREE.Object3D): PartBody => {
  const b = new THREE.Box3().setFromObject(o)
  if (b.isEmpty()) { const at = o.getWorldPosition(new THREE.Vector3()); b.set(at, at.clone()) }
  return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, y0: b.min.y, y1: b.max.y } }
const volume = (b: PartBody) => (b.x1 - b.x0) * (b.z1 - b.z0) * (b.y1 - b.y0)
/** A model larger than this across, world units (metres in glTF), was exported in smaller units (centimetres, millimetres); it is shown scaled down by tens to fit within it. */
export const LARGEST = 100
const meshesOf = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse(m => { if ((m as THREE.Mesh).isMesh) out.push(m as THREE.Mesh) }); return out }

/** Fetches, checks and reads the model at `url`, and lays its parts out. Rejects with a `stage` BonkeiError. */
export async function loadStage(url: string, parent?: Span, fetcher: typeof fetch = fetch): Promise<{ layout: StageModel; warnings: BonkeiWarning[]; info: StageInfo }> {
  // a failure is returned out of the span, not thrown through it, so the span's status says only the reason, never the address in the message
  const out = await withSpan('bonkei.stage.load', { 'bonkei.stage.host': host(url) }, async span => {
    const t0 = performance.now()
    const name = fileOf(url)
    try {
      let res: Response
      try { res = await fetcher(url) } catch { throw fail('fetch', `the stage ${url} couldn't be fetched; the site may not allow other pages to load it (CORS), or it is unreachable`) }
      span.setAttribute('bonkei.stage.status', res.status)
      // a server that answers a missing file with a web page (a single-page app's fallback) has not found it either
      if (res.status === 404 || /text\/html/.test(res.headers.get('content-type') ?? '')) throw fail('not_found', `the stage ${url} wasn't found (${res.status === 404 ? '404' : 'the server sent a web page'})`)
      if (!res.ok) throw fail('http', `the stage ${url} couldn't be loaded (HTTP ${res.status})`)
      const buf = await res.arrayBuffer()
      span.setAttribute('bonkei.stage.bytes', buf.byteLength)
      const json = sniff(buf, name)
      for (const ext of [...(json.extensionsRequired ?? []), ...(json.extensionsUsed ?? [])]) {
        if (COMPRESSION[ext]) throw fail('compressed', `${name} uses ${COMPRESSION[ext]} (${ext}), which Bonkei can't read yet.\nExport again with compression off.`)
      }
      const loader = await getLoader(span)
      const gltf = await new Promise<Gltf>((ok, bad) => loader.parse(buf, url.replace(/[^/]*$/, ''), ok, bad))
        .catch(e => { throw fail('unreadable', `${name} couldn't be read as a glTF: ${e instanceof Error ? e.message : String(e)}`) })
      const scene = gltf.scene ?? gltf.scenes?.[0]
      if (!scene) throw fail('no_scene', `${name} has no scene in it`)
      scene.updateMatrixWorld(true)
      const found = findParts(scene)
      if (!found.parts.length) throw fail('no_parts', `${name} loaded, but none of its top-level objects has a name.\nName them in your 3D tool (grill, register…) and export again.`)
      if (!meshesOf(scene).length) throw fail('no_scene', `${name} loaded, but it has nothing to show: none of its objects has a shape.\nExport the model with its meshes.`)
      // the whole model, its parts with no shape counted where they stand
      const extent = () => found.parts.map(p => box(p.object)).reduce((all, b) => all.expandByPoint(new THREE.Vector3(b.x0, b.y0, b.z0)), new THREE.Box3().setFromObject(scene))
      let all = extent()
      const across = Math.max(all.max.x - all.min.x, all.max.z - all.min.z)
      if (across > LARGEST) {
        scene.scale.multiplyScalar(10 ** -Math.ceil(Math.log10(across / LARGEST)))
        scene.updateMatrixWorld(true)
        all = extent()
      }
      // the footprint of the whole model, centred on the origin and standing on the floor
      const centre = all.getCenter(new THREE.Vector3())
      scene.position.set(-centre.x, -all.min.y, -centre.z)
      scene.updateMatrixWorld(true)
      const size = all.getSize(new THREE.Vector3())
      const width = size.x / S, height = size.z / S
      const parts = found.parts.map((p, i): StagePart => {
        const b = box(p.object)
        const solids = meshesOf(p.object).map(box)
        const body = solids.reduce<PartBody>((best, s) => (volume(s) > volume(best) + 1e-6 ? s : best), solids[0] ?? b)
        const w = (b.x1 - b.x0) / S, h = (b.z1 - b.z0) / S
        // x, y in the layout's own corner-origin px, as frameOf wants them
        return { id: `${i}:${p.name}`, label: p.name, x: b.x0 / S + width / 2, y: b.z0 / S + height / 2, w, h, top: b.y1, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, pieces: p.pieces, body, solids }
      })
      // each part is one blocker; an unnamed object is one per mesh (the house's walls are one group, whose box would cover the rooms inside it)
      const objects = [...found.parts.map((p, i) => [p.object, i] as const), ...found.others.flatMap(o => meshesOf(o).map(m => [m, -1] as const))]
      const blockers = objects.flatMap(([o, part]) => {
        const b = box(o)
        return b.y1 - b.y0 >= 0.3 ? [{ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: b.y1 - b.y0, part }] : []
      })
      // the model's own floor: the largest flat mesh standing at ground level among the unnamed objects, if it covers half the footprint; it goes under a group so it can be grown
      let floor: StageLayout['floor'] = null
      let best: THREE.Mesh | null = null, bestArea = 0
      for (const m of found.others.flatMap(meshesOf)) {
        const b = box(m), area = (b.x1 - b.x0) * (b.z1 - b.z0)
        if (b.y1 - b.y0 <= 0.3 && b.y0 <= 0.1 && area > bestArea) { best = m; bestArea = area }
      }
      if (best && bestArea >= 0.5 * size.x * size.z) {
        const b = box(best)
        const group = new THREE.Group()
        scene.add(group)
        group.attach(best)
        floor = { group, rect: { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 } }
      }
      const warnings = found.warnings.map((message): BonkeiWarning => ({ kind: 'stage', message, line: 0 }))
      span.setAttributes({ 'bonkei.stage.ms': performance.now() - t0, 'bonkei.stage.parts': parts.length, 'bonkei.stage.pieces_skipped': found.skipped, 'bonkei.stage.duplicates': warnings.length, 'bonkei.stage.floor': !!floor })
      return { ok: { layout: { kind: 'stage' as const, width, height, model: scene, parts, blockers, floor, tall: size.y, url }, warnings, info: { url, parts: parts.map(p => ({ name: p.label, pieces: p.pieces })) } } }
    } catch (e) {
      const err: StageError = (e as StageError)?.kind === 'stage' ? e as StageError : fail('unreadable', `the stage ${url} couldn't be loaded: ${e instanceof Error ? e.message : String(e)}`)
      span.setAttribute('bonkei.error.kind', 'stage')
      span.setAttribute('bonkei.stage.error', err.reason)
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.reason })
      const { reason: _, ...plain } = err
      return { error: plain as BonkeiError }
    }
  }, parent)
  if ('error' in out) throw out.error
  return out.ok
}

/**
 * A stage drawn for prepare (diagram.ts): the model at `url`, its parts named (stageZones.ts). `fm` is the frontmatter of a text source
 * (absent: a graph source); `src` that text when the address came from its frontmatter, so a failure names the stage line. Only the
 * stage is drawn: a diagram written beside it (a graph always is) is not, and says so in a warning.
 */
export async function drawStage(url: string, warnings: BonkeiWarning[], span: Span, fm?: Frontmatter, src?: string): Promise<[Drawn, number]> {
  span.setAttribute('bonkei.diagram', 'stage')
  const beside = !fm ? 0 : fm.body.trim() ? fm.lineOffset + 1 : null
  if (beside !== null) warnings.push({ kind: 'stage', message: 'a diagram drawn on a stage is not supported yet; showing the stage alone', line: beside })
  const at = src === undefined || !fm ? -1 : src.split('\n').slice(0, fm.lineOffset).findIndex(l => /^\s*stage\s*:/.test(l))
  const t0 = performance.now()
  // the drawing is fetched alongside the model; a model that cannot be shown says so first
  const [loaded, drawing] = await Promise.allSettled([loadStage(url, span), import('./StageScene.tsx')])
  if (loaded.status === 'rejected') throw at < 0 ? loaded.reason : { ...loaded.reason, line: at + 1 }
  if (drawing.status === 'rejected') throw { kind: 'stage', message: `the stage's drawing couldn't be fetched: ${drawing.reason instanceof Error ? drawing.reason.message : String(drawing.reason)}` } satisfies BonkeiError
  const s = loaded.value
  warnings.push(...s.warnings)
  return [{ data: { ...framed(s.layout), Scene: drawing.value.StageScene }, stage: s.info, options: fm?.options ?? {}, theme: fm?.theme ?? {}, nodes: s.layout.parts.length, edges: 0, dropped: [], arcs: false }, performance.now() - t0]
}

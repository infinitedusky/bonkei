// Writes the sample stages (BON-253) as binary glTF by hand, so they are reproducible and need no 3D tool:
//   node apps/playground/scripts/make-stages.mjs
// Output: apps/playground/public/stages/*.glb (served by the playground) and packages/core/src/fixtures/stages/*.glb (the core tests').
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outs = [join(here, '../public/stages'), join(here, '../../../packages/core/src/fixtures/stages')]

const STEEL = '#b8c0c8', DARK = '#2b2f36'
// a piece: a box (x, z centre on the floor plan, w d h size, y its bottom); a part: a named group of pieces; no name: an unnamed object
const KITCHEN = {
  floor: { w: 11, d: 7.4, color: '#d9d2c3' },
  parts: [
    { name: 'grill', pieces: [
      { name: 'Cube.003', x: -3.6, z: -2.4, w: 3, d: 1.4, h: 0.9, color: STEEL },
      { name: 'griddle', x: -3.6, z: -2.4, w: 2.8, d: 1.2, h: 0.06, y: 0.9, color: DARK },
      { name: 'patty', x: -4.3, z: -2.5, w: 0.4, d: 0.4, h: 0.08, y: 0.96, color: '#6b3b22' },
      { name: 'patty.001', x: -3.7, z: -2.3, w: 0.4, d: 0.4, h: 0.08, y: 0.96, color: '#6b3b22' },
      { name: 'flue', x: -3.6, z: -2.9, w: 0.4, d: 0.4, h: 1.1, y: 0.9, color: STEEL }, // holds the hood up: it stands on the grill
      { name: 'hood', x: -3.6, z: -2.9, w: 3.2, d: 0.6, h: 0.3, y: 2.0, color: STEEL },
    ] },
    { name: 'prep line', pieces: [
      { x: 0.9, z: -2.4, w: 3.6, d: 1.4, h: 0.9, color: STEEL },
      { name: 'lettuce bin', x: -0.2, z: -2.4, w: 0.7, d: 0.8, h: 0.12, y: 0.9, color: '#5cae4a' },
      { name: 'tomato bin', x: 0.6, z: -2.4, w: 0.7, d: 0.8, h: 0.12, y: 0.9, color: '#d8463a' },
      { name: 'bun rack', x: 2.2, z: -2.4, w: 0.7, d: 0.8, h: 0.4, y: 0.9, color: '#e0b06a' },
    ] },
    { name: 'wrap station', pieces: [
      { x: 4.0, z: -0.4, w: 1.4, d: 2.6, h: 0.9, color: STEEL },
      { name: 'paper', x: 4.0, z: -0.9, w: 1.0, d: 0.9, h: 0.04, y: 0.9, color: '#f3efe6' },
    ] },
    { name: 'register', pieces: [
      { x: 1.0, z: 2.4, w: 3.2, d: 1.0, h: 1.05, color: '#d7302c' },
      { name: 'screen', x: 0.4, z: 2.4, w: 0.7, d: 0.1, h: 0.5, y: 1.05, color: DARK },
    ] },
    { pieces: [{ x: -4.6, z: 1.6, w: 1.4, d: 1.4, h: 2.2, color: '#e6e8ea' }] }, // the fridge: nobody named it
  ],
}
const HOUSE = {
  floor: { w: 22, d: 9, color: '#9cc27a' },
  parts: [
    { name: 'phone', pieces: [{ name: 'sofa', x: -9.3, z: 0.6, w: 1.6, d: 0.7, h: 0.5, color: '#7a5c9e' }, { name: 'Screen.001', x: -9.3, z: 0.1, w: 0.25, d: 0.12, h: 0.42, y: 0.5, color: DARK }] },
    { name: 'router', pieces: [{ name: 'shelf', x: -7.6, z: -1.2, w: 1, d: 0.5, h: 0.7, color: '#c89b6a' }, { name: 'Box', x: -7.6, z: -1.2, w: 0.6, d: 0.35, h: 0.14, y: 0.7, color: '#f2f2f2' }] },
    { name: 'telephone pole', pieces: [{ name: 'Cylinder.002', x: -4.2, z: -2.6, w: 0.25, d: 0.25, h: 4.2, color: '#7a5434' }, { name: 'crossarm', x: -4.2, z: -2.6, w: 1.4, d: 0.15, h: 0.15, y: 3.8, color: '#7a5434' }] },
    { name: 'exchange', pieces: [{ x: 1.5, z: -1.8, w: 3.4, d: 2.6, h: 2.2, color: '#c9b79c' }, { name: 'Roof', x: 1.5, z: -1.8, w: 3.6, d: 2.8, h: 0.2, y: 2.2, color: '#6e6a64' }] },
    { name: 'server', pieces: [{ name: 'datacentre', x: 8, z: -1, w: 4.4, d: 3.6, h: 2.6, color: '#d6dbe2' }, { name: 'rack', x: 7.2, z: 1.0, w: 0.7, d: 0.5, h: 1.8, color: DARK }] },
    { pieces: [ // the house walls: unnamed
      { x: -8.4, z: -0.3, w: 4.2, d: 3.6, h: 0.08, color: '#e8dcc6' }, { x: -8.4, z: -2.1, w: 4.2, d: 0.12, h: 2.3, color: '#f1ebe0' },
      { x: -10.5, z: -0.3, w: 0.12, d: 3.6, h: 2.3, color: '#f1ebe0' }, { x: -6.3, z: -0.3, w: 0.12, d: 3.6, h: 2.3, color: '#f1ebe0' } ] },
    { pieces: [{ x: 0, z: 3.4, w: 22, d: 1.6, h: 0.03, color: '#4a4d52' }] }, // the road: unnamed
  ],
}
// the kitchen with nothing named at the top (the pieces keep their names: only top-level names make parts)
const BLOB = { floor: KITCHEN.floor, parts: KITCHEN.parts.map(p => ({ pieces: p.pieces })) }
// a model in a wrapper node, as Blender and SketchUp often export: look through it
const WRAPPED = { ...HOUSE, wrapper: 'Sketchup_model' }
// two parts with one name
const DUPLICATE = { floor: KITCHEN.floor, parts: [KITCHEN.parts[0], { ...KITCHEN.parts[1], name: 'Grill' }, KITCHEN.parts[3]] }

const hex = c => [1, 3, 5].map(i => Math.pow(parseInt(c.slice(i, i + 2), 16) / 255, 2.2)).concat(1)

function build(model, extra = {}) {
  const colors = [], mat = c => { let i = colors.indexOf(c); if (i < 0) i = colors.push(c) - 1; return i }
  const nodes = [], boxNode = (p, material) => nodes.push({ ...(p.name ? { name: p.name } : {}), mesh: material, translation: [p.x, (p.y ?? 0) + p.h / 2, p.z], scale: [p.w, p.h, p.d] }) - 1
  const floorOf = model.floor
  const top = []
  for (const part of model.parts) {
    const kids = part.pieces.map(p => boxNode(p, mat(p.color)))
    top.push(nodes.push({ ...(part.name ? { name: part.name } : {}), children: kids }) - 1)
  }
  // the floor is one unnamed top-level slab under everything (a model with a floor of its own)
  top.push(boxNode({ x: 0, z: 0, w: floorOf.w, d: floorOf.d, h: 0.05, y: -0.05 }, mat(floorOf.color)))
  let roots = top
  if (model.wrapper) roots = [nodes.push({ name: model.wrapper, children: top }) - 1]
  // one unit cube shared by every box
  const P = [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]
  const N = [[0,0,1],[0,0,-1],[-1,0,0],[1,0,0],[0,1,0],[0,-1,0]].flatMap(n => [n, n, n, n])
  const idx = [...Array(6).keys()].flatMap(f => [0, 1, 2, 0, 2, 3].map(i => f * 4 + i))
  const pos = new Float32Array(P.flat()), nor = new Float32Array(N.flat()), ind = new Uint16Array(idx)
  const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(nor.buffer), Buffer.from(ind.buffer)])
  const meshes = colors.map((_, i) => ({ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i }] }))
  const json = {
    asset: { version: '2.0', generator: 'bonkei make-stages.mjs' },
    scene: 0, scenes: [{ nodes: roots }], nodes,
    meshes, materials: colors.map(c => ({ pbrMetallicRoughness: { baseColorFactor: hex(c), metallicFactor: 0.1, roughnessFactor: 0.8 } })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-.5, -.5, -.5], max: [.5, .5, .5] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 288, target: 34962 }, { buffer: 0, byteOffset: 288, byteLength: 288, target: 34962 }, { buffer: 0, byteOffset: 576, byteLength: 72, target: 34963 }],
    buffers: [{ byteLength: bin.length }],
    ...extra,
  }
  return glb(json, bin)
}
const pad = (b, ch) => { const n = (4 - (b.length % 4)) % 4; return Buffer.concat([b, Buffer.alloc(n, ch)]) }
function glb(json, bin) {
  const j = pad(Buffer.from(JSON.stringify(json)), 0x20), b = pad(bin, 0)
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8)
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8)
  jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([head, jh, j, bh, b])
}

const files = {
  'kitchen.glb': build(KITCHEN), 'house.glb': build(HOUSE), 'blob.glb': build(BLOB), 'wrapped.glb': build(WRAPPED), 'duplicate.glb': build(DUPLICATE),
  'kitchen-draco.glb': build(KITCHEN, { extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'] }),
  'kitchen-ktx2.glb': build(KITCHEN, { extensionsUsed: ['KHR_texture_basisu'] }),
  'not-a-model.glb': Buffer.from('This is a text file, not a glTF.\n'),
}
for (const dir of outs) {
  mkdirSync(dir, { recursive: true })
  for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), data)
}
console.log('wrote', Object.keys(files).join(', '))

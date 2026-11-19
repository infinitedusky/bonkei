import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { MAT_DEFAULTS } from './mat.ts'

test("Mat's lit defaults are three's MeshStandardMaterial defaults, so Classic draws as it did before Mat", () => {
  const m = new THREE.MeshStandardMaterial()
  assert.deepEqual(MAT_DEFAULTS, { roughness: m.roughness, metalness: m.metalness })
})

test('Mat takes its defaults from MAT_DEFAULTS', () => {
  const src = readFileSync(new URL('./look.tsx', import.meta.url), 'utf8')
  assert.match(src, /export function Mat\(\{ roughness = MAT_DEFAULTS\.roughness, metalness = MAT_DEFAULTS\.metalness,/)
})

test("Classic sequence blocks and notes name no roughness, so they get three's 1; activations keep their 0.5, as on main", () => {
  const src = readFileSync(new URL('./SeqScene.tsx', import.meta.url), 'utf8')
  const mats = [...src.matchAll(/<Mat [^>]*\/>/g)].map(m => m[0])
  assert.equal(mats.length, 3)
  const [block, act, note] = mats
  assert.doesNotMatch(block, /roughness/)
  assert.match(act, /roughness=\{0\.5\}/)
  assert.doesNotMatch(note, /roughness/)
})

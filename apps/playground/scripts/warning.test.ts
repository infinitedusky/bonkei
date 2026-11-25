// Which warning stays on screen when the playground's source changes: a theme-menu warning stays, a source's goes.
//   pnpm --filter @bonkei/playground test
import test from 'node:test'
import assert from 'node:assert/strict'
import { keptOnNewSource } from '../src/warning.ts'

test('a stage warning (line 0) goes with its source', () => {
  assert.equal(keptOnNewSource({ kind: 'stage', message: 'two parts are named grill and Grill', line: 0 }), null)
})

test('a diagram-beside-the-stage warning goes with its source', () => {
  assert.equal(keptOnNewSource({ kind: 'stage', message: 'a diagram drawn on a stage is not supported yet', line: 4 }), null)
})

test("the theme menu's warning (line 0) outlives a new source", () => {
  const w = { kind: 'theme' as const, message: 'unknown theme "nope"', line: 0 }
  assert.equal(keptOnNewSource(w), w)
})

test("a source's theme warning (its frontmatter line) goes with it", () => {
  assert.equal(keptOnNewSource({ kind: 'theme', message: 'unknown theme "nope"', line: 2 }), null)
})

test('no warning stays none', () => {
  assert.equal(keptOnNewSource(null), null)
})

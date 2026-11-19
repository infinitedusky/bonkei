// The docs smoke's diagram rule (diagram-rule.mjs): a declared interactive demo passes beside the page's fences; a stray diagram, a demo
// the .md has no heading for, an untitled demo and a demo with a second diagram fail.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headings, judgeDiagrams } from './diagram-rule.mjs'

const md = '# Edge styles\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n### The trench light {#trench}\n\nTry it.\n'
const demo = { title: 'The trench light', diagrams: 1 }

test('a declared demo beside the fences passes, and is not counted as a fence', () => {
  assert.deepEqual(judgeDiagrams({ total: 2, fences: 1, demos: [demo], md }), { good: true, drawn: 1, undeclared: [] })
})

test('a page with no demo is judged as before: its diagrams are its fences', () => {
  assert.equal(judgeDiagrams({ total: 1, fences: 1, demos: [], md }).good, true)
  assert.equal(judgeDiagrams({ total: 1, fences: 0, demos: [], md }).good, false)
  assert.equal(judgeDiagrams({ total: 0, fences: 1, demos: [], md }).good, false)
})

test('a bare diagram beside a demo fails', () => {
  assert.deepEqual(judgeDiagrams({ total: 3, fences: 1, demos: [demo], md }), { good: false, drawn: 2, undeclared: [] })
})

test('a demo the .md has no heading for, an untitled demo and a demo with a second diagram fail and are named', () => {
  assert.deepEqual(judgeDiagrams({ total: 2, fences: 1, demos: [{ title: 'Other', diagrams: 1 }], md }).undeclared, ['Other'])
  assert.deepEqual(judgeDiagrams({ total: 2, fences: 1, demos: [{ title: '', diagrams: 1 }], md }).undeclared, ['(untitled)'])
  const two = judgeDiagrams({ total: 3, fences: 1, demos: [{ ...demo, diagrams: 2 }], md })
  assert.equal(two.good, false); assert.deepEqual(two.undeclared, ['The trench light'])
  assert.equal(judgeDiagrams({ total: 1, fences: 1, demos: [{ ...demo, diagrams: 0 }], md }).good, false)
})

test('headings: only real headings count, not lines inside a code fence; a {#anchor} is dropped', () => {
  assert.deepEqual(headings(md), ['Edge styles', 'The trench light'])
  const inFence = '````md\n### The trench light\n````\n'
  assert.deepEqual(headings(inFence), [])
  assert.equal(judgeDiagrams({ total: 1, fences: 0, demos: [demo], md: inFence }).good, false)
})

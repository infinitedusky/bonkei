import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFish, parseFish, layoutFish } from './fish.ts'
import { prepare } from './diagram.ts'

const BLURRY = `ishikawa-beta
    Blurry Photo
    Process
        Out of focus
    User
        Shaky hands
    Equipment
        LENS
            Inappropriate lens
            Damaged lens
                Bad case
            Dirty lens
        SENSOR
            Damaged sensor
    Environment
        Too dark`

test('the keyword is ishikawa-beta or ishikawa', () => {
  assert.equal(isFish('ishikawa-beta\n  x'), true)
  assert.equal(isFish('ishikawa\n  x'), true)
  assert.equal(isFish('flowchart TD\n a-->b'), false)
})

test('parses effect, categories and causes at any depth', () => {
  const d = parseFish(BLURRY)
  assert.equal(d.effect, 'Blurry Photo')
  assert.deepEqual(d.cats.map(c => c.label), ['Process', 'User', 'Equipment', 'Environment'])
  assert.equal(d.cats[2].kids[0].kids[1].kids[0].label, 'Bad case')
  assert.equal(d.dropped.length, 0)
})

test('layout: first categories nearest the head; LENS causes far to near: Inappropriate, Damaged, Bad case, Dirty', () => {
  const l = layoutFish(parseFish(BLURRY))
  const at = (s: string) => l.pieces.find(p => p.label === s)!
  assert.ok(at('Process').x > at('Equipment').x)
  const lens = [at('Inappropriate lens'), at('Damaged lens'), at('Bad case'), at('Dirty lens')]
  const dist = lens.map(p => Math.abs(p.y - l.head.y))
  assert.deepEqual([...dist].sort((a, b) => b - a), dist)
  assert.ok(Math.abs(at('LENS').y - l.head.y) < dist[3])
  assert.ok(l.rods.every(r => r.a[0] !== r.b[0] || r.a[1] !== r.b[1]))
})

test('unreadable lines are dropped with their line number; nothing throws', async () => {
  const p = await prepare('ishikawa-beta\n  Effect\n  Cat\n\t\tbad\n Less\n    Cause')
  assert.deepEqual(p.warnings.map(w => w.line), [4, 5])
  assert.equal((p.data as { kind: string }).kind, 'fish')
})

test('keyword only warns, does not throw', async () => {
  const p = await prepare('ishikawa-beta')
  assert.equal(p.warnings.length, 1)
})

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

test('below the spine Mermaid reads top to bottom too: the first cause is nearest the spine, its causes hang below it', () => {
  const l = layoutFish(parseFish('ishikawa-beta\n  E\n  Top\n    T1\n    T2\n  Bottom\n    B1\n      B1a\n      B1b\n    B2'))
  const at = (s: string) => l.pieces.find(p => p.label === s)!
  assert.ok(at('T1').y < at('T2').y && at('T2').y < l.head.y)
  assert.ok(l.head.y < at('B1').y && at('B1').y < at('B2').y)
  assert.ok(at('B1').y < at('B1a').y && at('B1a').y < at('B1b').y)
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

// every line segment against every block and pill (the effect's box too): no line passes through one
const BUSY = `ishikawa-beta
    Churn up 4%
    Price
        Increase in March
        Annual plan removed
    Product
        Slow search
        Missing export
            CSV only
            No API
    Support
        Long waits
    Onboarding
        No tour
    Billing
        Card failures
            Expired cards
    Competition
        Cheaper rival
    Marketing
        Wrong audience
    Season
        Summer dip`
const DEEPER = BLURRY.replace('Out of focus', 'Out of focus\n        Shutter speed too slow').replace('Too dark', 'Too dark\n        Subject moved too quickly')

// Liang–Barsky: does segment a->b cross the open rectangle?
function crosses(a: [number, number], b: [number, number], r: { x0: number; x1: number; y0: number; y1: number }) {
  let t0 = 0, t1 = 1
  const dx = b[0] - a[0], dy = b[1] - a[1]
  for (const [p, q] of [[-dx, a[0] - r.x0], [dx, r.x1 - a[0]], [-dy, a[1] - r.y0], [dy, r.y1 - a[1]]]) {
    if (p === 0) { if (q <= 0) return false; continue }
    const t = q / p
    if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t) } else { if (t < t0) return false; t1 = Math.min(t1, t) }
  }
  return t1 - t0 > 1e-6
}

for (const [name, src] of [['Blurry Photo', BLURRY], ['fourth level', DEEPER], ['eight categories', BUSY]] as const) {
  test(`no line passes through a block or pill: ${name}`, () => {
    const l = layoutFish(parseFish(src))
    const boxes = [...l.pieces.map(p => ({ id: p.label, x: p.x, y: p.y, w: p.w, h: p.h })), { id: 'effect', x: l.head.x, y: l.head.y, w: l.head.w, h: l.head.h }]
    const hits: string[] = []
    for (const r of l.rods) for (const b of boxes) {
      const e = 2 // touching an edge (a line leaving its own pill's front) is not passing through
      if (crosses(r.a, r.b, { x0: b.x - b.w / 2 + e, x1: b.x + b.w / 2 - e, y0: b.y - b.h / 2 + e, y1: b.y + b.h / 2 - e })) hits.push(`${r.a}->${r.b} through ${b.id}`)
    }
    assert.deepEqual(hits, [])
  })
  test(`every line is level or slants the bones' way, never the other diagonal: ${name}`, () => {
    const l = layoutFish(parseFish(src))
    for (const r of l.rods.filter(r => r.depth > 0)) {
      const dx = r.b[0] - r.a[0], dy = r.b[1] - r.a[1]
      assert.ok(dy === 0 || dx > 0, `${r.a}->${r.b} runs backward`)
    }
  })
}

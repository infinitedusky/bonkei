import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickCorner, titleRect, titleWidth, CORNERS } from './titles.ts'

const tray = { w: 10, h: 6 }, tw = 2.5, th = 0.7, G = { x0: 0.5, x1: 0.5, z0: 0.5, z1: 0.5 }

test('an empty tray keeps its title back-left, where Classic puts it', () => {
  assert.equal(pickCorner(tray.w, tray.h, tw, th, [], G), 'bl')
})

test('a node on the back-left corner moves the title to a free corner', () => {
  const onBl = { x0: -4.5, x1: -2.5, z0: -2.7, z1: -1.7 }
  const c = pickCorner(tray.w, tray.h, tw, th, [onBl], G)
  assert.notEqual(c, 'bl')
  const t = titleRect(c, tray.w, tray.h, tw, th)
  assert.ok(t.x1 <= tray.w / 2 && t.x0 >= -tray.w / 2 && t.z0 >= -tray.h / 2 && t.z1 <= tray.h / 2) // inside the tray
})

test('a form standing behind its footprint hides the corner too (the footprint is grown)', () => {
  // the footprint stops short of the back-left title, but its form stands up the screen over it
  const near = { x0: -4.5, x1: -2.5, z0: -1.6, z1: -0.6 }
  assert.equal(pickCorner(tray.w, tray.h, tw, th, [near], { x0: 0, x1: 0, z0: 0, z1: 0 }), 'bl')
  assert.notEqual(pickCorner(tray.w, tray.h, tw, th, [near], { x0: 1, x1: 0.3, z0: 1.9, z1: 0.3 }), 'bl')
})

test('the previous corner is kept while it stays free, so a title does not jump during a drag', () => {
  assert.equal(pickCorner(tray.w, tray.h, tw, th, [{ x0: -4.6, x1: -1.6, z0: -2.8, z1: -1.8 }], G, 'br'), 'br')
})

test('every corner covered: the least covered one, never an exception', () => {
  const all = [{ x0: -5, x1: 5, z0: -3, z1: 3 }]
  assert.ok(CORNERS.includes(pickCorner(tray.w, tray.h, tw, th, all, G)))
})

test('a longer title is wider', () => {
  assert.ok(titleWidth('Billing and payments', 0.4) > titleWidth('Data', 0.4))
})

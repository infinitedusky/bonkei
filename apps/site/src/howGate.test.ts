// BON-209: the home page's live diagrams load onto an empty stage and fade in; the saved pictures are only for devices
// that can't draw them. These are the decisions Hero.tsx and How.tsx paint from.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { heroFallsBack, heroGateOf, heroPathAttrs, heroShows, howShows, type Gate } from './howGate.ts'
import { track } from './track.ts'

const exporter = new InMemorySpanExporter()
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }))
beforeEach(() => exporter.reset())

test('the hero asks the browser only when the page does not force a path', () => {
  let asked = 0
  const probe = (g: Gate) => () => { asked++; return g }
  assert.equal(heroGateOf(undefined, probe('live')), 'live')
  assert.equal(heroGateOf(undefined, probe('phone')), 'phone')
  assert.equal(heroGateOf(undefined, probe('no-webgl2')), 'no-webgl2')
  assert.equal(asked, 3)
  assert.equal(heroGateOf(true, probe('no-webgl2')), 'live')
  assert.equal(heroGateOf(false, probe('live')), 'forced')
  assert.equal(asked, 3)
})

test('a desktop that goes live never gets the poster: it gets the live scene (on an empty stage until its first frame)', () => {
  assert.equal(heroShows('live', false), 'live')
})

test('the poster is only for a device that cannot go live, a forced poster, or a scene chunk that failed', () => {
  assert.equal(heroShows('phone', false), 'poster')
  assert.equal(heroShows('no-webgl2', false), 'poster')
  assert.equal(heroShows('forced', false), 'poster')
  assert.equal(heroShows('live', true), 'poster')
})

test('Keep the text on a desktop: the shell before the section is near, then the scene; never the still', () => {
  assert.equal(howShows('live', false, false), 'shell')
  assert.equal(howShows('live', false, true), 'scene')
})

test('Keep the text shows the still on a phone, without WebGL 2, and when the scene failed', () => {
  assert.equal(howShows('phone', false, false), 'still')
  assert.equal(howShows('phone', false, true), 'still')
  assert.equal(howShows('no-webgl2', false, true), 'still')
  assert.equal(howShows('live', true, true), 'still')
  assert.equal(howShows('live', true, false), 'still')
})

test('site.hero.path says which path the visitor got, and for the poster why (states only)', async () => {
  await track('site.hero.path', heroPathAttrs('live'))
  await track('site.hero.path', heroPathAttrs('no-webgl2'))
  await track('site.hero.path', heroPathAttrs('phone'))
  await track('site.hero.path', heroPathAttrs('forced'))
  const spans = exporter.getFinishedSpans()
  assert.deepEqual(spans.map(s => s.name), ['site.hero.path', 'site.hero.path', 'site.hero.path', 'site.hero.path'])
  assert.deepEqual(spans.map(s => s.attributes), [
    { 'site.hero.path': 'live' },
    { 'site.hero.path': 'poster', 'site.hero.reason': 'no-webgl2' },
    { 'site.hero.path': 'poster', 'site.hero.reason': 'phone' },
    { 'site.hero.path': 'poster', 'site.hero.reason': 'forced' },
  ])
})

test('the hero falls back to the poster when its scene reports an error before its first frame, or drawing broke after it', () => {
  // the probe passed, then the scene could not make its own WebGL context: <Bonkei> reports it and never draws
  assert.equal(heroFallsBack(false, { kind: 'render', message: 'WebGL is unavailable (Error creating WebGL context.)' }), true)
  assert.equal(heroFallsBack(false, { kind: 'parse', message: 'x' }), true)
  assert.equal(heroFallsBack(true, { kind: 'render', message: 'x' }), true)
  // after a frame, anything but drawing breaking leaves the drawn diagram up
  assert.equal(heroFallsBack(true, { kind: 'layout', message: 'x' }), false)
  assert.equal(heroShows('live', heroFallsBack(false, { kind: 'render', message: 'x' })), 'poster')
})

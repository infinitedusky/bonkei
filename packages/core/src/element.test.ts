import test from 'node:test'
import assert from 'node:assert/strict'

// A bare-bones DOM: just what the element touches.
class FakeHTMLElement {
  attrs = new Map<string, string>(); textContent: string | null = ''; style: Record<string, string> = {}; isConnected = false; clientHeight = 300
  getAttribute(n: string) { return this.attrs.get(n) ?? null }
  dispatchEvent() { return true }
}
Object.assign(globalThis, {
  HTMLElement: FakeHTMLElement,
  document: { readyState: 'complete', addEventListener() {} },
  getComputedStyle: () => ({ display: 'block', height: '300px' }),
  CustomEvent: class {},
})
const { makeElement } = await import('./elementClass.ts')

test('a theme attribute change keeps the view: same handle, setTheme, no destroy or redraw', () => {
  const calls: string[] = []
  let draws = 0
  const handle = { update() {}, setMode() {}, fit() {}, destroy: () => calls.push('destroy'), setTheme: (t: unknown) => calls.push('theme:' + String(t)) }
  const El = makeElement((() => { draws++; return handle }) as never)
  const el = new El() as unknown as FakeHTMLElement & { connectedCallback(): void; attributeChangedCallback(n: string, o: string | null, v: string | null): void }
  el.textContent = 'flowchart TD\n A-->B'; el.isConnected = true
  el.connectedCallback()
  assert.equal(draws, 1)
  el.attributeChangedCallback('theme', null, 'bonkei')
  el.attributeChangedCallback('theme', 'bonkei', null)
  assert.deepEqual(calls, ['theme:bonkei', 'theme:undefined'])
  assert.equal(draws, 1)
  el.attributeChangedCallback('mode', null, '3d') // a mode change still draws afresh
  assert.deepEqual(calls.slice(2), ['destroy'])
  assert.equal(draws, 2)
})

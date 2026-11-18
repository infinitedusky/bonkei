// What a reader does on the docs, and what can fail there, as OpenTelemetry spans (BON-178). Through @opentelemetry/api, like bonkei and
// @bonkei/vitepress: a no-op unless the site registers an SDK. Bonkei's own spans (bonkei.render, bonkei.layout, …) and the plugin's
// bonkei.vitepress.load come on top of these.
//   bonkei.docs.playground.edit  one per edit the playground draws: ends when the diagram is drawn, or with status ERROR and the problem
//   bonkei.docs.copy_markdown    the Copy page button (or its View / Open in menu) was pressed; attribute bonkei.docs.action
//   bonkei.docs.script_tag.load  the script-tag demo loading bonkei.global.js; status ERROR when it could not
import { SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api'

const tracer = () => trace.getTracer('bonkei-docs')
const page = () => (typeof location === 'undefined' ? '' : location.pathname)

export function start(name: string, attrs: Attributes = {}): Span {
  return tracer().startSpan(name, { attributes: { 'bonkei.docs.page': page(), ...attrs } })
}
export function fail(span: Span, message: string): void {
  span.setStatus({ code: SpanStatusCode.ERROR, message })
  span.end()
}
export function instant(name: string, attrs: Attributes = {}): void {
  start(name, attrs).end()
}

// The Copy page buttons are vitepress-plugin-llms' component: one listener on the document sees its clicks without changing it.
export function watchCopyButtons(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('click', e => {
    const b = (e.target as Element | null)?.closest?.('.markdown-copy-buttons button')
    if (!b) return
    const action = b.classList.contains('copy-page') ? 'copy' : b.classList.contains('download-btn') ? 'download' : b.classList.contains('dropdown-item') ? 'menu' : 'open-menu'
    instant('bonkei.docs.copy_markdown', { 'bonkei.docs.action': action })
  }, { capture: true })
}

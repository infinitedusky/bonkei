// The site has no telemetry channel of its own (core's telemetry.ts is OpenTelemetry spans inside the scene).
// Hook points call this: a DOM event `site:track` an analytics script can listen to. Counts and states only.
export function track(name: string, attrs: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('site:track', { detail: { name, ...attrs } }))
  if (import.meta.env.DEV) console.debug('[site:track]', name, attrs)
}

// The site's telemetry: OpenTelemetry spans through @opentelemetry/api, as core does (packages/core/src/telemetry.ts).
// A no-op unless the page registers an SDK. The API is imported on first use, so the page's entry chunk does not
// carry it; the scene's chunk shares the same copy. Counts and states only, never the text a visitor typed.
import type { Attributes } from '@opentelemetry/api'

export const TRACER = 'bonkei-site'

let api: Promise<typeof import('@opentelemetry/api')> | undefined

/** One span for something that happened at one moment. `error` sets status ERROR with that message. Resolves once the span has ended. */
export function track(name: string, attrs: Attributes = {}, error?: string): Promise<void> {
  api ??= import('@opentelemetry/api')
  return api.then(({ trace, SpanStatusCode }) => {
    const span = trace.getTracer(TRACER).startSpan(name, { attributes: attrs })
    if (error !== undefined) span.setStatus({ code: SpanStatusCode.ERROR, message: error })
    span.end()
  }, () => {}) // telemetry never breaks the page
}

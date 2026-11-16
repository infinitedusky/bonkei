// Tracing through @opentelemetry/api: a no-op unless the embedder registers an SDK.
import { trace, context, SpanStatusCode, type Attributes, type Span } from '@opentelemetry/api'

export const VERSION = '0.0.0' // keep in step with package.json

export const tracer = trace.getTracer('bonkei', VERSION)

// Runs `fn` inside a span and ends it. A throw (or rejection) sets status ERROR and is rethrown.
// `parent` links the span explicitly, so nesting holds without an async context manager.
export async function withSpan<T>(name: string, attrs: Attributes, fn: (span: Span) => T | Promise<T>, parent?: Span): Promise<T> {
  const ctx = parent ? trace.setSpan(context.active(), parent) : context.active()
  const span = tracer.startSpan(name, { attributes: attrs }, ctx)
  try {
    return await context.with(trace.setSpan(ctx, span), () => fn(span))
  } catch (e) {
    const message = typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e)
    span.setStatus({ code: SpanStatusCode.ERROR, message })
    throw e
  } finally {
    span.end()
  }
}

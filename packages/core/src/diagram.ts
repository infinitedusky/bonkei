// One step from a source to something drawable: frontmatter, parse, layout. No React here.
// Decisions: LOG.md, "Diagram options and errors (BON-51)".
import type { Span } from '@opentelemetry/api'
import type { Dropped, Graph, GraphInput, LayoutResult } from './model.ts'
import { parse } from './parser.ts'
import { layout, type LayoutOptions } from './layout.ts'
import { isSeq, parseSeq, layoutSeq, type SeqLayout } from './seq.ts'
import { readFrontmatter, type BonkeiError, type BonkeiWarning, type DiagramOptions, type Ready } from './options.ts'
import { withSpan } from './telemetry.ts'

export interface Prepared {
  data: LayoutResult | SeqLayout
  options: DiagramOptions // from the frontmatter; merge with props via mergeOptions
  warnings: BonkeiWarning[] // frontmatter problems first, then dropped lines in line order
  ready: Ready
}

// What `prepare` rejects with: the error itself (so it can go straight to `onError`), carrying
// the warnings found before the failure (so they can still go to `onWarning`).
export type PrepareError = BonkeiError & { warnings: BonkeiWarning[] }

const ERROR_KINDS: readonly BonkeiError['kind'][] = ['parse', 'layout', 'graph', 'render']

export function isBonkeiError(x: unknown): x is BonkeiError {
  return typeof x === 'object' && x !== null
    && typeof (x as BonkeiError).message === 'string'
    && ERROR_KINDS.includes((x as BonkeiError).kind)
}

function fail(kind: BonkeiError['kind'], message: string, line?: number, text?: string): BonkeiError {
  const e: BonkeiError = { kind, message }
  if (line !== undefined) e.line = line
  if (text !== undefined) e.text = text
  return e
}

const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e)

// What a source turned into, before it becomes a `Prepared`.
interface Drawn {
  data: LayoutResult | SeqLayout
  options: DiagramOptions
  nodes: number
  edges: number
  dropped: Dropped[]
}

function finish(result: Drawn, warnings: BonkeiWarning[], t: number): Prepared {
  const all = [...warnings, ...result.dropped.map((d): BonkeiWarning => ({ kind: 'dropped', message: d.reason, line: d.line, text: d.text }))]
  return {
    data: result.data,
    options: result.options,
    warnings: all,
    ready: { layoutMs: t, nodes: result.nodes, edges: result.edges, dropped: result.dropped.length },
  }
}

// Nothing readable: the error names the first line we could not use.
function nothingRead(what: 'nodes' | 'participants', dropped: Dropped[]): BonkeiError {
  const first = dropped[0]
  if (!first) return fail('parse', `no ${what} found`)
  return fail('parse', `no ${what} found; first unreadable line: ${first.line}: ${first.text}`, first.line, first.text)
}

// Times the layout alone, in its own `bonkei.layout` span; a throw becomes a `layout` error.
async function timedLayout<T>(parent: Span, run: () => T | Promise<T>): Promise<[T, number]> {
  try {
    return await withSpan('bonkei.layout', {}, async () => {
      const t0 = performance.now()
      const value = await run()
      return [value, performance.now() - t0] as [T, number]
    }, parent)
  } catch (e) {
    throw fail('layout', `layout failed: ${messageOf(e)}`)
  }
}

async function fromText(src: string, warnings: BonkeiWarning[], span: Span, lo: LayoutOptions): Promise<[Drawn, number]> {
  if (!src.trim()) throw fail('parse', 'the diagram is empty')
  const fm = readFrontmatter(src)
  for (const w of fm.warnings) {
    warnings.push(w)
    span.addEvent('bonkei.frontmatter_warning', { 'bonkei.line': w.line, 'bonkei.message': w.message })
  }
  if (!fm.body.trim()) throw fail('parse', 'the diagram is empty after its frontmatter')
  if (isSeq(fm.body)) {
    span.setAttribute('bonkei.diagram', 'sequence')
    const doc = parseSeq(fm.body, fm.lineOffset)
    if (!doc.parts.length) throw nothingRead('participants', doc.dropped)
    const [data, t] = await timedLayout(span, () => layoutSeq(doc))
    return [{ data, options: fm.options, nodes: doc.parts.length, edges: data.msgs.length, dropped: doc.dropped }, t]
  }
  span.setAttribute('bonkei.diagram', 'flowchart')
  const g = parse(fm.body, fm.lineOffset)
  const dropped = g.dropped ?? []
  if (!g.nodes.length) throw nothingRead('nodes', dropped)
  const [data, t] = await timedLayout(span, () => layout(g, { avoidCrossings: lo.avoidCrossings ?? fm.options.avoidCrossings, span }))
  return [{ data, options: fm.options, nodes: g.nodes.length, edges: g.edges.length, dropped }, t]
}

async function fromGraph(input: GraphInput, span: Span, lo: LayoutOptions): Promise<[Drawn, number]> {
  span.setAttribute('bonkei.diagram', 'flowchart')
  if (typeof input !== 'object' || input === null) throw fail('graph', 'source must be Mermaid text or a graph')
  if (!Array.isArray(input.nodes) || !input.nodes.length) throw fail('graph', 'the graph has no nodes')
  const groups = input.groups ?? []
  const edges = input.edges ?? []
  if (!Array.isArray(groups)) throw fail('graph', 'graph.groups must be an array')
  if (!Array.isArray(edges)) throw fail('graph', 'graph.edges must be an array')
  for (const [i, n] of input.nodes.entries()) if (typeof n?.id !== 'string' || !n.id) throw fail('graph', `node ${i} has no id`)
  const ids = new Set([...input.nodes.map(n => n.id), ...groups.map(x => x.id)])
  for (const e of edges) {
    for (const end of [e.from, e.to]) if (!ids.has(end)) throw fail('graph', `edge ${e.id ?? `${e.from} -> ${e.to}`} points at unknown id ${JSON.stringify(end)}`)
  }
  const g: Graph = { ...input, direction: input.direction ?? 'TD', groups, edges, dropped: input.dropped ?? [] }
  const [data, t] = await timedLayout(span, () => layout(g, { ...lo, span }))
  return [{ data, options: {}, nodes: g.nodes.length, edges: g.edges.length, dropped: g.dropped! }, t]
}

function countReasons(dropped: Dropped[]) {
  const counts: Record<string, number> = {}
  for (const d of dropped) {
    const key = `bonkei.dropped.${d.reason.replace(/\W+/g, '_')}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

// Mermaid text or a hand-built graph -> a laid-out diagram with its warnings. Never throws:
// it resolves to `Prepared` or rejects with a `PrepareError`.
// `lo` are the routing options from props; the frontmatter's fill in what they leave out.
export async function prepare(source: string | GraphInput, lo: LayoutOptions = {}): Promise<Prepared> {
  const warnings: BonkeiWarning[] = []
  const input = typeof source === 'string' ? 'mermaid' : 'graph'
  return withSpan('bonkei.prepare', { 'bonkei.input': input }, async span => {
    try {
      const [drawn, t] = typeof source === 'string' ? await fromText(source, warnings, span, lo) : await fromGraph(source, span, lo)
      span.setAttributes({
        'bonkei.nodes': drawn.nodes,
        'bonkei.edges': drawn.edges,
        'bonkei.dropped': drawn.dropped.length,
        'bonkei.layout_ms': t,
      })
      if (drawn.dropped.length) span.addEvent('bonkei.dropped_lines', countReasons(drawn.dropped))
      return finish(drawn, warnings, t)
    } catch (e) {
      const err = isBonkeiError(e) ? e : fail(input === 'mermaid' ? 'parse' : 'graph', messageOf(e))
      span.setAttribute('bonkei.error.kind', err.kind)
      if (err.line !== undefined) span.setAttribute('bonkei.error.line', err.line)
      const rejection: PrepareError = { ...err, warnings }
      throw rejection
    }
  })
}

import { parse } from './parser.ts'
import { layout } from './layout.ts'
import { isSeq, parseSeq, layoutSeq, type SeqLayout } from './seq.ts'
import type { Dropped, Graph, LayoutResult } from './model.ts'
import { readFrontmatter, type BonkeiError, type DiagramOptions, type BonkeiReady } from './options.ts'

export interface Prepared {
  data: LayoutResult | SeqLayout
  options: DiagramOptions
  /** Things that did not stop the diagram being drawn: dropped lines, bad frontmatter values. */
  warnings: BonkeiError[]
  ready: BonkeiReady
}

const dropWarnings = (dropped: Dropped[], offset: number): BonkeiError[] =>
  dropped.map(d => ({ severity: 'warning', kind: 'parse', message: d.reason, line: d.line + offset, text: d.text }))

/**
 * Source text -> something the scene can draw. Never throws: rejects with a BonkeiError.
 * "Cannot be drawn" means: no nodes (or participants) were read, or layout failed. Dropped lines are warnings.
 */
export async function prepare(source: string | Graph): Promise<Prepared> {
  const t0 = performance.now()
  if (typeof source !== 'string') return prepareGraph(source, t0)
  const fm = readFrontmatter(source)
  const off = fm.lineOffset
  try {
    if (isSeq(fm.body)) {
      const doc = parseSeq(fm.body)
      const warnings = [...fm.warnings, ...dropWarnings(doc.dropped, off)]
      if (!doc.parts.length) throw nothing(doc.dropped, off, 'participants')
      const data = layoutSeq(doc)
      return { data, options: fm.options, warnings, ready: { layoutMs: Math.round(performance.now() - t0), nodes: doc.parts.length, edges: doc.items.length, dropped: doc.dropped.length } }
    }
    const g = parse(fm.body)
    const warnings = [...fm.warnings, ...dropWarnings(g.dropped, off)]
    if (!g.nodes.length) throw nothing(g.dropped, off, 'nodes')
    const data = await layout(g)
    return { data, options: fm.options, warnings, ready: { layoutMs: Math.round(performance.now() - t0), nodes: g.nodes.length, edges: g.edges.length, dropped: g.dropped.length } }
  } catch (e) {
    if (isBonkeiError(e)) throw e
    throw { severity: 'error', kind: 'layout', message: e instanceof Error ? e.message : String(e) } satisfies BonkeiError
  }
}

const nothing = (dropped: Dropped[], off: number, what: string): BonkeiError => {
  const d = dropped[0]
  return { severity: 'error', kind: 'parse', message: d ? `no ${what} found; first unreadable line: ${d.reason}` : `no ${what} found`, line: d ? d.line + off : undefined, text: d?.text }
}
const isBonkeiError = (e: unknown): e is BonkeiError => !!e && typeof e === 'object' && 'severity' in e && 'kind' in e

/** A graph built by the caller (no Mermaid): validated, then laid out. */
async function prepareGraph(g: Graph, t0: number): Promise<Prepared> {
  try {
    if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw { severity: 'error', kind: 'parse', message: 'graph needs nodes and edges' } satisfies BonkeiError
    if (!g.nodes.length) throw { severity: 'error', kind: 'parse', message: 'graph has no nodes' } satisfies BonkeiError
    const ids = new Set([...g.nodes.map(n => n.id), ...(g.groups ?? []).map(x => x.id)])
    const bad = g.edges.find(e => !ids.has(e.from) || !ids.has(e.to))
    if (bad) throw { severity: 'error', kind: 'parse', message: `edge ${bad.id} points at a node that is not in the graph` } satisfies BonkeiError
    const full: Graph = { direction: g.direction ?? 'TD', nodes: g.nodes, groups: g.groups ?? [], edges: g.edges, dropped: [] }
    const data = await layout(full)
    return { data, options: {}, warnings: [], ready: { layoutMs: Math.round(performance.now() - t0), nodes: full.nodes.length, edges: full.edges.length, dropped: 0 } }
  } catch (e) {
    if (isBonkeiError(e)) throw e
    throw { severity: 'error', kind: 'layout', message: e instanceof Error ? e.message : String(e) } satisfies BonkeiError
  }
}

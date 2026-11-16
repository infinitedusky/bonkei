import { REASON, type Graph, type GNode, type GGroup, type Shape, type Dropped } from './model.ts'

const OPEN: Record<string, [Shape, string]> = {
  '[(': ['cylinder', ')]'], '((': ['round', '))'], '([': ['round', '])'],
  '[': ['rect', ']'], '(': ['round', ')'], '{': ['diamond', '}'],
}
// An id may hold '-', but not the '-' that starts an arrow (A-->B, A-.->B).
const NODE_RE = /^([A-Za-z_](?:\w|-(?![-.>]))*)(?:(\[\(|\(\(|\(\[|\[|\(|\{)(.*?)(\)\]|\)\)|\]\)|\]|\)|\}))?(?::::\w+)?/
const ARROW_RE = /^\s*(?:--\s+([^>]*?)\s+-->|-\.->|-->|---|==>|-\.-|===)(?:\s*\|([^|]*)\|)?\s*/
const HEAD_RE = /^(?:flowchart|graph)(?:\s+(TD|TB|LR|RL|BT))?$/
// Mermaid statements we read but do not draw yet.
const UNSUPPORTED_RE = /^(?:(?:classDef|class|style|linkStyle|click|direction)\s|(?:accTitle|accDescr)\s*[:{])/

const unq = (s: string) => s.trim().replace(/^["']|["']$/g, '').replace(/<br\s*\/?>/g, ' ')

// `lineOffset` is the number of source lines before `src` (a frontmatter block), so the line
// numbers in `dropped` count the source as the author gave it.
export function parse(src: string, lineOffset = 0): Graph {
  const g: Graph = { direction: 'TD', nodes: [], groups: [], edges: [], dropped: [] }
  const dropped: Dropped[] = []
  const nodes = new Map<string, GNode>()
  const groups = new Map<string, GGroup>()
  const stack: { id: string; line: number; text: string }[] = []
  const top = () => stack[stack.length - 1]?.id

  const ref = (id: string, label?: string, shape?: Shape) => {
    if (groups.has(id)) return
    let n = nodes.get(id)
    if (!n) {
      n = { id, label: id, shape: 'rect', parent: top() }
      nodes.set(id, n)
    }
    if (label !== undefined) n.label = label
    if (shape) n.shape = shape
  }

  src.split('\n').forEach((raw, i) => {
    const lineNo = i + 1 + lineOffset
    const text = raw.trim()
    const line = text.replace(/;+$/, '').trimEnd()
    const drop = (reason: string) => { dropped.push({ line: lineNo, text, reason }) }
    if (!line || line.startsWith('%%')) return
    const head = line.match(HEAD_RE)
    if (head) { g.direction = head[1] === 'LR' || head[1] === 'RL' ? 'LR' : 'TD'; return }
    if (UNSUPPORTED_RE.test(line)) return drop(REASON.unsupported)
    if (line === 'end') { if (!stack.pop()) drop(REASON.strayEnd); return }
    const sg = line.match(/^subgraph\s+([\w-]+)(?:\s*\[(.*)\])?\s*$/) || line.match(/^subgraph\s+(.+)$/)
    if (sg) {
      const id = sg[1].trim()
      const label = sg[2] !== undefined ? unq(sg[2]) : id
      groups.set(id, { id, label, parent: top() })
      stack.push({ id, line: lineNo, text })
      return
    }
    // statement: node (arrow node)*
    let rest = line
    const first = rest.match(NODE_RE)
    if (!first) return drop(REASON.statement)
    if (first[2]) ref(first[1], unq(first[3]), OPEN[first[2]][0]); else ref(first[1])
    rest = rest.slice(first[0].length)
    let last = first[1]
    for (;;) {
      const a = rest.match(ARROW_RE)
      if (!a) break
      rest = rest.slice(a[0].length)
      const n = rest.match(NODE_RE)
      if (!n) break
      if (n[2]) ref(n[1], unq(n[3]), OPEN[n[2]][0]); else ref(n[1])
      g.edges.push({ id: `e${g.edges.length}`, from: last, to: n[1], label: (a[1] ?? a[2])?.trim() || undefined })
      rest = rest.slice(n[0].length)
      last = n[1]
    }
  })
  for (const s of stack) dropped.push({ line: s.line, text: s.text, reason: REASON.unclosed })
  g.nodes = [...nodes.values()]
  g.groups = [...groups.values()]
  g.dropped = dropped.sort((a, b) => a.line - b.line)
  return g
}

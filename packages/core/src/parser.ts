import { REASON, type Graph, type GNode, type GGroup, type Shape, type Dropped } from './model.ts'

const OPEN: Record<string, [Shape, string]> = {
  '[(': ['cylinder', ')]'], '((': ['round', '))'], '([': ['round', '])'],
  '[': ['rect', ']'], '(': ['round', ')'], '{': ['diamond', '}'],
}
// An id may hold '-', but not the '-' that starts an arrow (A-->B, A-.->B).
const NODE_RE = /^([A-Za-z_](?:\w|-(?![-.>]))*)(?:(\[\(|\(\(|\(\[|\[|\(|\{)(.*?)(\)\]|\)\)|\]\)|\]|\)|\}))?(?::::(\w+))?/
const ARROW_RE = /^\s*(?:--\s+([^>]*?)\s+-->|-\.->|-->|---|==>|-\.-|===)(?:\s*\|([^|]*)\|)?\s*/
const HEAD_RE = /^(?:flowchart|graph)(?:\s+(TD|TB|LR|RL|BT))?$/
// Mermaid statements we read but do not draw yet.
const UNSUPPORTED_RE = /^(?:(?:linkStyle|click|direction)\s|(?:accTitle|accDescr)\s*[:{])/

// A fill colour as the diagram's text may give it: #rgb, #rrggbb, rgb() or hsl() (a name needs a table, left out).
const COLOUR_RE = /^(?:#(?:[\da-f]{3}|[\da-f]{6})|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(?:,\s*[\d.]+\s*)?\))$/i
const STYLE_RE = /^style\s+([\w,-]+)\s+(.*)$/
const CLASSDEF_RE = /^classDef\s+([\w,-]+)\s+(.*)$/
const CLASS_RE = /^class\s+([\w,-]+)\s+(\w+)\s*$/
// the fill of a `fill:#abc,stroke:#000` list: undefined if there is none, null if it is not a colour
const fillOf = (props: string): string | null | undefined => {
  const m = props.match(/(?:^|,)\s*fill\s*:\s*([^,]*)/)
  if (!m) return undefined
  const c = m[1].trim()
  return COLOUR_RE.test(c) ? c : null
}

const unq = (s: string) => s.trim().replace(/^["']|["']$/g, '').replace(/<br\s*\/?>/g, ' ')

// `lineOffset` is the number of source lines before `src` (a frontmatter block), so the line
// numbers in `dropped` count the source as the author gave it.
export function parse(src: string, lineOffset = 0): Graph {
  const g: Graph = { direction: 'TD', nodes: [], groups: [], edges: [], dropped: [] }
  const dropped: Dropped[] = []
  const nodes = new Map<string, GNode>()
  const groups = new Map<string, GGroup>()
  const stack: { id: string; line: number; text: string }[] = []
  const styled = new Map<string, string>() // style <id> fill:..
  const defs = new Map<string, string>() // classDef <name> fill:..
  const classed: [string, string][] = [] // class <ids> <name>, applied once every classDef is known
  const tagged = (id: string, cls: string | undefined) => { if (cls) classed.push([id, cls]) }
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
    // colours from the text (Mermaid's way): only a node's fill is read, the rest of the style is not drawn
    const sty = line.match(STYLE_RE), cdef = line.match(CLASSDEF_RE), cls = line.match(CLASS_RE)
    if (sty || cdef) {
      const m = (sty ?? cdef)!, f = fillOf(m[2])
      if (f === null) return drop(REASON.colour)
      if (f !== undefined) for (const id of m[1].split(',')) (sty ? styled : defs).set(id, f)
      return
    }
    if (cls) { for (const id of cls[1].split(',')) classed.push([id, cls[2]]); return }
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
    tagged(first[1], first[5])
    rest = rest.slice(first[0].length)
    let last = first[1]
    for (;;) {
      const a = rest.match(ARROW_RE)
      if (!a) break
      rest = rest.slice(a[0].length)
      const n = rest.match(NODE_RE)
      if (!n) break
      if (n[2]) ref(n[1], unq(n[3]), OPEN[n[2]][0]); else ref(n[1])
      tagged(n[1], n[5])
      g.edges.push({ id: `e${g.edges.length}`, from: last, to: n[1], label: (a[1] ?? a[2])?.trim() || undefined })
      rest = rest.slice(n[0].length)
      last = n[1]
    }
  })
  for (const s of stack) dropped.push({ line: s.line, text: s.text, reason: REASON.unclosed })
  for (const [id, c] of classed) { const n = nodes.get(id), f = defs.get(c); if (n && f) n.color = f }
  for (const [id, f] of styled) { const n = nodes.get(id); if (n) n.color = f }
  g.nodes = [...nodes.values()]
  g.groups = [...groups.values()]
  g.dropped = dropped.sort((a, b) => a.line - b.line)
  return g
}

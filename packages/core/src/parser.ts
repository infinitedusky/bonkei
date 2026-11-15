import type { Graph, GNode, GGroup, Shape } from './model.ts'

const OPEN: Record<string, [Shape, string]> = {
  '[(': ['cylinder', ')]'], '((': ['round', '))'], '([': ['round', '])'],
  '[': ['rect', ']'], '(': ['round', ')'], '{': ['diamond', '}'],
}
const NODE_RE = /^([A-Za-z_][\w-]*)(?:(\[\(|\(\(|\(\[|\[|\(|\{)(.*?)(\)\]|\)\)|\]\)|\]|\)|\}))?(?::::\w+)?/
const ARROW_RE = /^\s*(?:--\s+([^>]*?)\s+-->|-\.->|-->|---|==>|-\.-|===)(?:\s*\|([^|]*)\|)?\s*/

const unq = (s: string) => s.trim().replace(/^["']|["']$/g, '').replace(/<br\s*\/?>/g, ' ')

export function parse(src: string): Graph {
  const g: Graph = { direction: 'TD', nodes: [], groups: [], edges: [], dropped: [] }
  const nodes = new Map<string, GNode>()
  const groups = new Map<string, GGroup>()
  const stack: string[] = []

  const ref = (id: string, label?: string, shape?: Shape) => {
    if (groups.has(id)) return
    let n = nodes.get(id)
    if (!n) {
      n = { id, label: id, shape: 'rect', parent: stack[stack.length - 1] }
      nodes.set(id, n)
    }
    if (label !== undefined) n.label = label
    if (shape) n.shape = shape
  }

  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().replace(/;$/, '')
    const drop = (reason: string) => g.dropped.push({ line: i + 1, text: line, reason })
    if (!line) continue
    if (line.startsWith('%%')) continue
    if (/^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/.test(line)) { drop('not supported yet'); continue }
    const head = line.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/)
    if (head) { g.direction = head[1] === 'LR' || head[1] === 'RL' ? 'LR' : 'TD'; continue }
    if (line === 'end') { if (stack.length) stack.pop(); else drop("'end' with no open subgraph"); continue }
    const sg = line.match(/^subgraph\s+([\w-]+)(?:\s*\[(.*)\])?\s*$/) || line.match(/^subgraph\s+(.+)$/)
    if (sg) {
      const id = sg[1].trim()
      const label = sg[2] !== undefined ? unq(sg[2]) : id
      groups.set(id, { id, label, parent: stack[stack.length - 1] })
      stack.push(id)
      continue
    }
    // statement: node (arrow node)*
    let rest = line
    const first = rest.match(NODE_RE)
    if (!first) { drop('not a node or edge'); continue }
    if (first[2]) ref(first[1], unq(first[3]), OPEN[first[2]][0]); else ref(first[1])
    rest = rest.slice(first[0].length)
    let last = first[1]
    for (;;) {
      const a = rest.match(ARROW_RE)
      if (!a) break
      rest = rest.slice(a[0].length)
      const n = rest.match(NODE_RE)
      if (!n) { break }
      if (n[2]) ref(n[1], unq(n[3]), OPEN[n[2]][0]); else ref(n[1])
      g.edges.push({ id: `e${g.edges.length}`, from: last, to: n[1], label: (a[1] ?? a[2])?.trim() || undefined })
      rest = rest.slice(n[0].length)
      last = n[1]
    }
    if (rest.trim()) drop(`could not read "${rest.trim().slice(0, 30)}"`)
  }
  if (stack.length) g.dropped.push({ line: lines.length, text: '', reason: `subgraph '${stack[stack.length - 1]}' is never closed` })
  g.nodes = [...nodes.values()]
  g.groups = [...groups.values()]
  return g
}

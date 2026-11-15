import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { CardData, MetricData, TaskData } from './nodes'

const card = (id: string, x: number, y: number, title: string, emoji: string, status: CardData['status'], body: string, extra: Partial<Node> = {}): Node =>
  ({ id, type: 'card', position: { x, y }, data: { title, emoji, status, body } satisfies CardData, ...extra })

export function smallFlow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: 'in', type: 'input', position: { x: 0, y: 140 }, data: { label: 'Webhook' } },
    card('c1', 140, 60, 'Validate', '🛡️', 'ok', 'Checks the payload shape.\nRejects unknown senders.'),
    card('c2', 140, 220, 'Enrich', '🔎', 'warn', 'Looks up the account.\nSlow today.'),
    { id: 'g1', type: 'group', position: { x: 420, y: 0 }, data: { label: 'Review' }, style: { width: 460, height: 330, background: 'rgba(80,120,255,0.08)', border: '1px dashed #5b8def' } },
    { id: 't1', type: 'task', position: { x: 20, y: 40 }, parentId: 'g1', extent: 'parent', data: { title: 'Triage', owner: 'Sam', done: 60 } satisfies TaskData },
    { id: 't2', type: 'task', position: { x: 20, y: 200 }, parentId: 'g1', extent: 'parent', data: { title: 'Fix', owner: 'Lee', done: 25 } satisfies TaskData },
    { id: 't3', type: 'task', position: { x: 270, y: 200 }, parentId: 'g1', extent: 'parent', data: { title: 'Verify', owner: 'Ana', done: 90 } satisfies TaskData },
    { id: 'm1', type: 'metric', position: { x: 300, y: 50 }, parentId: 'g1', extent: 'parent', data: { label: 'open bugs', value: '12', trend: 'down' } satisfies MetricData },
    card('c3', 940, 120, 'Publish', '🚀', 'fail', 'Pushes the release.\nBlocked by review.'),
    { id: 'out', type: 'output', position: { x: 1200, y: 160 }, data: { label: 'Done' } },
    { id: 'hid', position: { x: 0, y: 330 }, hidden: true, data: { label: 'hidden' } },
  ]
  const arrow = { type: MarkerType.ArrowClosed }
  const edges: Edge[] = [
    { id: 'e1', source: 'in', target: 'c1', type: 'smoothstep', label: 'smooth', markerEnd: arrow },
    { id: 'e2', source: 'in', target: 'c2', type: 'step', label: 'step', markerEnd: arrow },
    { id: 'e3', source: 'c1', target: 't1', type: 'default', label: 'bezier', markerEnd: arrow },
    { id: 'e4', source: 'c2', target: 'm1', type: 'straight', label: 'straight', markerEnd: arrow },
    { id: 'e5', source: 't1', sourceHandle: 'a', target: 't2', type: 'smoothstep', label: 'handle a', markerEnd: arrow },
    { id: 'e6', source: 't1', sourceHandle: 'b', target: 't3', type: 'default', label: 'handle b', markerEnd: arrow },
    { id: 'e7', source: 't3', target: 'c3', type: 'smoothstep', markerEnd: arrow },
    { id: 'e8', source: 'c3', target: 'out', type: 'default', markerEnd: arrow },
    { id: 'e9', source: 'in', target: 'hid', hidden: true },
  ]
  return { nodes, edges }
}

const STATUS: CardData['status'][] = ['ok', 'warn', 'fail']
const EMOJI = ['📦', '🔧', '📊', '🧪', '🛰️', '🔐']

// 4 groups of 5x9 grids + 20 loose nodes = 200 nodes, a third of them custom
export function bigFlow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [], edges: Edge[] = []
  const GW = 5 * 230 + 40, GH = 9 * 100 + 60
  for (let g = 0; g < 4; g++) {
    const gid = `g${g}`
    nodes.push({ id: gid, type: 'group', position: { x: (g % 2) * (GW + 80), y: Math.floor(g / 2) * (GH + 80) }, data: { label: `Group ${g}` }, style: { width: GW, height: GH, background: 'rgba(80,120,255,0.08)', border: '1px dashed #5b8def' } })
    for (let i = 0; i < 45; i++) {
      const id = `${gid}n${i}`, x = 20 + (i % 5) * 230, y = 40 + Math.floor(i / 5) * 100
      if (i % 3 === 0) nodes.push(card(id, x, y, `Job ${g}-${i}`, EMOJI[i % 6], STATUS[i % 3], 'Does a thing.\nThen another.', { parentId: gid, extent: 'parent' }))
      else nodes.push({ id, position: { x, y }, parentId: gid, extent: 'parent', data: { label: `Step ${g}-${i}` } })
      if (i % 5) edges.push({ id: `${id}e`, source: `${gid}n${i - 1}`, target: id, type: 'smoothstep' })
      else if (i) edges.push({ id: `${id}v`, source: `${gid}n${i - 5}`, target: id, type: 'default', sourceHandle: undefined })
    }
  }
  for (let i = 0; i < 20; i++) {
    const id = `l${i}`, x = (i % 10) * 220, y = 2 * (GH + 80) + Math.floor(i / 10) * 110
    nodes.push(i % 2 ? { id, type: 'metric', position: { x, y }, data: { label: 'rate', value: String(i * 7), trend: i % 4 ? 'up' : 'down' } satisfies MetricData } : { id, type: 'input', position: { x, y }, data: { label: `Loose ${i}` } })
    if (i) edges.push({ id: `${id}e`, source: `l${i - 1}`, target: id, type: 'straight' })
  }
  return { nodes, edges }
}

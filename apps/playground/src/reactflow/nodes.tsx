import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'

const PILL: Record<string, string> = { ok: '#2fa36b', warn: '#d9a21b', fail: '#d9534f' }

export type CardData = { title: string; emoji: string; status: 'ok' | 'warn' | 'fail'; body: string }

export function CardNode({ data, selected }: NodeProps) {
  const d = data as CardData
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 200, background: '#fff', border: '2px solid #1a192b', borderRadius: 10, padding: 10, font: '12px system-ui', color: '#222', boxSizing: 'border-box' }}>
      <NodeResizer isVisible={selected} minWidth={150} minHeight={70} />
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24 }}>{d.emoji}</span>
        <b style={{ fontSize: 14, flex: 1 }}>{d.title}</b>
        <span style={{ background: PILL[d.status], color: '#fff', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{d.status.toUpperCase()}</span>
      </div>
      <div style={{ marginTop: 6, color: '#555', lineHeight: 1.35 }}>{d.body}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export type TaskData = { title: string; owner: string; done: number }

// two source handles at the bottom (ids a and b)
export function TaskNode({ data, selected }: NodeProps) {
  const d = data as TaskData
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 170, background: '#1f2a44', border: '2px solid #5b8def', borderRadius: 6, padding: 10, font: '12px system-ui', color: '#e8edf7', boxSizing: 'border-box' }}>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={70} />
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 700, fontSize: 13 }}>📋 {d.title}</div>
      <div style={{ opacity: 0.7, margin: '4px 0 6px' }}>owner: {d.owner}</div>
      <div style={{ height: 8, background: '#0f1218', borderRadius: 4 }}><div style={{ width: `${d.done}%`, height: '100%', background: '#3fbf9b', borderRadius: 4 }} /></div>
      <Handle id="a" type="source" position={Position.Bottom} style={{ left: '25%' }} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ left: '75%' }} />
    </div>
  )
}

export type MetricData = { label: string; value: string; trend: 'up' | 'down' }

export function MetricNode({ data, selected }: NodeProps) {
  const d = data as MetricData
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 140, background: 'linear-gradient(135deg,#ffb36b,#ff6b8b)', borderRadius: 14, padding: 10, font: '12px system-ui', color: '#2b1020', textAlign: 'center', boxSizing: 'border-box' }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={60} />
      <Handle type="target" position={Position.Left} />
      <div style={{ fontSize: 24, fontWeight: 800 }}>{d.value} {d.trend === 'up' ? '▲' : '▼'}</div>
      <div>{d.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

// replaces React Flow's built-in 'group' so groups can be resized (and still look the same)
export function GroupNode({ data, selected }: NodeProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: 'rgba(80,120,255,0.08)', border: '1px dashed #5b8def', boxSizing: 'border-box' }}>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={150} />
      <div style={{ padding: 6, font: '11px system-ui', color: '#9aa6c0' }}>{(data as { label?: string }).label}</div>
    </div>
  )
}

export const nodeTypes = { card: CardNode, task: TaskNode, metric: MetricNode, group: GroupNode }

// BON-85: edges in 3D on real layouts. Unlike Mockups/Edges in 3D (hand-placed), every line here is ELK's route,
// stepped and crossed by core's renderer. Switch the crossing style and the view with the toolbar.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { parse, layout, SceneView } from 'bonkei/internal'
import type { LayoutResult, Mode, CrossingStyle, EdgeStats, AvoidCrossings } from 'bonkei/internal'
import sample from './sample.mmd?raw'
import { SAMPLES } from './samples'

const four = `flowchart TD
  C((Centre))
  C --> N[North]
  S[South] --> C
  W[West] --> C
  C --> E[East]`
const fourLR = four.replace('flowchart TD', 'flowchart LR')

// a tall block (Fraud) on the inner tray, a block outside both trays, a short block beside it, and an edge into the inner tray
const nested = `flowchart LR
  Client --> Pay
  subgraph Payments
    Pay[Pay API]
    subgraph Risk
      Fraud{Fraud Check}
      Review[Review]
      Fraud --> Review
    end
    Pay --> Fraud
    Pay --> Risk
  end
  Fraud --> Ledger[(Ledger)]
  Fraud --> Review`
const crossing = `flowchart TD
  A --> C
  A --> D
  A --> E
  B --> C
  B --> D
  B --> E`
const trayCrossing = `flowchart TD
  subgraph Tray
${crossing.split('\n').slice(1).map(l => '  ' + l).join('\n')}
  end`
// 26 crossings: a complete 5 x 5 bipartite graph, for the many-portals case (criterion 10)
const letters = 'ABCDEFGHIJ'
const many = `flowchart TD\n${[...letters.slice(0, 5)].flatMap(a => [...letters.slice(5)].map(b => `  ${a} --> ${b}`)).join('\n')}`
const toTray = `flowchart TD
  subgraph Group[Group]
    A[Inside] --> B[Also inside]
  end
  Out[Outside] --> Group
  Group --> Far[Far]`
const sibling = `flowchart LR
  subgraph One
    A[A] 
  end
  subgraph Two
    B[B]
  end
  A --> B`

type Args = { mode: Mode; crossings: CrossingStyle; avoid: AvoidCrossings }

function Diagram({ src, mode, crossings, avoid = 'some', heights = {}, onStats }: { src: string; mode: Mode; crossings: CrossingStyle; avoid?: AvoidCrossings; heights?: Record<string, number>; onStats?: (s: EdgeStats) => void }) {
  const [data, setData] = useState<LayoutResult | null>(null)
  useEffect(() => { layout(parse(src)).then(d => setData({ ...d, boxes: d.boxes.map(b => heights[b.id] ? { ...b, height: heights[b.id] } : b) })) }, [src])
  const [stats, setStats] = useState<EdgeStats | null>(null)
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <SceneView data={data} labelMode="top" mode={mode} crossings={crossings} avoidCrossings={avoid} onEdgeStats={s => { setStats(s); onStats?.(s) }} />
      {stats && <div style={{ position: 'absolute', left: 12, top: 10, color: '#9aa6c0', font: '12px monospace' }}>
        crossings {stats.crossings} · bridge {stats.bridge} · tunnel {stats.tunnel} · portal {stats.portal} · no room {stats.skipped} · docked {stats.fallbacks + stats.trayDocks} · plan {stats.recomputeMs.toFixed(1)} ms · routed {Math.round(stats.routeMs)} ms · unroutable {stats.unroutable}
        <br />[avoid {stats.avoidCrossings}] plan crossings {stats.quality.crossings} · overlapping {stats.quality.overlaps} · doubling back {stats.quality.doublingBack} · length/direct {stats.quality.lengthRatio} · through blocks {stats.quality.throughBlocks} / foreign trays {stats.quality.throughTrays}</div>}
    </div>
  )
}

const meta: Meta<Args> = {
  title: 'Edges in 3D (real layout)',
  args: { mode: 'iso', crossings: 'none', avoid: 'some' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] },
    crossings: { control: 'inline-radio', options: ['none', 'bridge', 'tunnel', 'portal'] },
    avoid: { control: 'inline-radio', options: ['off', 'some', 'strong'] },
  },
}
export default meta
type Story = StoryObj<Args>
const story = (src: string, heights?: Record<string, number>): Story => ({ render: a => <Diagram src={src} mode={a.mode} crossings={a.crossings} avoid={a.avoid} heights={heights} /> })

/** Req 1: top-down, every line leaves the bottom and arrives at the top, at the middle of the side, halfway up. */
export const FourDirectionsTD: Story = story(four)
/** Req 1: left-to-right, out of the right and into the left. */
export const FourDirectionsLR: Story = story(fourLR)
/** Req 2: a tall block on the inner tray (Fraud, 1.8 high); one step outside the outermost tray; one step into the inner tray; one to the short block beside it. */
export const NestedWithTallBlock: Story = story(nested, { Fraud: 1.8 })
/** Req 2: two sibling trays at the same height: the line stays level across the gap (assumed; for the person to confirm). */
export const SiblingTrays: Story = story(sibling)
/** Req 3, 4, 8: lines crossing on the ground. Pick bridge, tunnel or portal in the toolbar; try flat and 3D. */
export const Crossing: Story = { ...story(crossing), args: { mode: 'iso', crossings: 'bridge' } }
export const CrossingTunnel: Story = { ...story(crossing), args: { mode: 'iso', crossings: 'tunnel' } }
export const CrossingPortal: Story = { ...story(crossing), args: { mode: '3d', crossings: 'portal' } }
/** Req 9: the crossings sit on a tray; the tunnel goes down into the tray, with its holes on the tray's surface. */
export const CrossingOnTray: Story = { ...story(trayCrossing), args: { mode: 'iso', crossings: 'tunnel' } }
/** Criterion 10: 26 portal pairs. The nearer and bigger portals keep detail and update most; the rest step down. */
export const ManyCrossings: Story = { ...story(many), args: { mode: '3d', crossings: 'portal' } }
/** Req 6: edges to and from a subgraph itself meet its rim at the middle of the side and step the same way. */
export const EdgeToSubgraph: Story = story(toTray)
/** The repo's small sample in the story viewer. */
export const Sample: Story = story(sample)
/** BON-99: the 50-node sample in iso, routed by libavoid. Pick a crossing style and how hard the router avoids crossings; the readout shows the quality. */
export const LargeSample: Story = { ...story(Object.values(SAMPLES)[1]), args: { mode: 'iso', crossings: 'bridge', avoid: 'some' } }

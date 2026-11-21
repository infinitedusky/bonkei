// The playground's Stage parts list (BON-253). Every part list here is MADE-UP SAMPLE DATA, labelled 'sample data: …' where it is shown.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CSSProperties, ReactNode } from 'react'
import type { StageInfo } from 'bonkei'
import { StageParts } from './StageParts'

// ---- Sample data (made up) ----
const KITCHEN: StageInfo = { url: 'stages/kitchen.glb', parts: [{ name: 'grill', pieces: 6 }, { name: 'prep line', pieces: 3 }, { name: 'wrap station', pieces: 1 }, { name: 'register', pieces: 1 }] }
const MANY: StageInfo = { url: 'stages/warehouse.glb', parts: Array.from({ length: 30 }, (_, i) => ({ name: i === 7 ? 'a very long part name that a sample author wrote out in full' : `bay ${i + 1}`, pieces: i % 4 })) }

const frame: CSSProperties = { position: 'relative', width: 280, height: 380, background: '#0f1218', outline: '1px solid #3a4560' }
const Box = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ padding: 24, background: '#0f1218', minHeight: '100vh', boxSizing: 'border-box' }}>
    <div style={{ color: '#7f8aa3', font: '11px ui-monospace, monospace', margin: '4px 0' }}>sample data: {label}</div>
    <div style={frame}>{children}</div>
  </div>
)

const meta: Meta<typeof StageParts> = { title: 'Components/Stage parts', component: StageParts }
export default meta
type Story = StoryObj<typeof StageParts>

/** The sample kitchen's four parts, each with how many named pieces it holds. */
export const Kitchen: Story = { render: () => <Box label="the sample kitchen's parts"><StageParts stage={KITCHEN} /></Box> }
/** "Prep Line" finds "prep line": the list filters, matched the way a script will match it. */
export const FoundAsPrepLine: Story = { render: () => <Box label="the sample kitchen, find 'Prep Line'"><StageParts stage={KITCHEN} initialFind="Prep Line" /></Box> }
/** "prep_line" finds it too. */
export const FoundAsPrepUnderscoreLine: Story = { render: () => <Box label="the sample kitchen, find 'prep_line'"><StageParts stage={KITCHEN} initialFind="prep_line" /></Box> }
/** Nothing found. */
export const NothingFound: Story = { render: () => <Box label="the sample kitchen, find 'nothing'"><StageParts stage={KITCHEN} initialFind="nothing" /></Box> }
/** Thirty parts and one long name: the list scrolls and the long name wraps. */
export const ManyParts: Story = { render: () => <Box label="a made-up warehouse with thirty bays"><StageParts stage={MANY} /></Box> }

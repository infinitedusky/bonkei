// MOCKUP (BON-234): the Blueprint theme in the real renderer, as a Theme object made from today's settings only. The three extras
// (a heavier grid line every 5 squares, hatched tray sides, architect's lettering) need drawing code and are not here; see
// sketches/blueprint.html. The diagrams are the Themes stories' ones; MADE-UP SAMPLE DATA.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { BONKEI, Bonkei, type Mode, type Theme } from 'bonkei'
import { SAMPLES, bonkeiMockup } from './samples'

const meta: Meta<typeof Bonkei> = { title: 'Mockups/Blueprint', component: Bonkei, parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj<typeof Bonkei>

const PAPER = '#1d4f8c', INK = '#eef6ff', LINE = '#a9d6ff', TRAY_INK = '#bcdcff'

const BLUEPRINT: Theme = {
  ...BONKEI,
  name: 'blueprint',
  ground: { bg: PAPER, grid: ['#6f97c6', '#3c6aa2'], grain: 0.08, lit: false },
  light: { ...BONKEI.light, ambient: 1.4, sky: '#e6f2ff', floor: PAPER, tones: 2 },
  node: {
    ...BONKEI.node,
    colors: { rect: '#2a64a8', round: '#2e6db0', cylinder: '#2a5f9f', diamond: '#3170b4' },
    outline: INK, outlineWidth: 1.5, bevel: 0, form: 'block', hover: '#9fd3ff', hoverIntensity: 0.2,
  },
  tray: {
    ...BONKEI.tray,
    thickness: 0.35, colors: ['#22599a', '#265f9f', '#2a65a5'], sides: ['plain', 'plain', 'plain'],
    patternInk: INK, patternPaper: PAPER, outline: TRAY_INK, hover: '#9fd3ff', hoverIntensity: 0.15,
  },
  label: {
    font: null,
    node: { style: 'plain', text: INK, plate: PAPER, border: INK },
    tray: { style: 'cartouche', text: INK, plate: PAPER, border: TRAY_INK },
    toward: 0,
  },
  ink: { ref: 40, min: 1 },
  edge: {
    color: LINE, width: 2, label: INK, labelOutline: PAPER, portal: LINE, rim: TRAY_INK, rimWidth: 1.5, flat: false,
    glow: { core: '#bfe4ff', coreWidth: 2.5, halo: '#7fc4ff', haloWidth: 9, haloOpacity: 0.22, wash: '#7fc4ff', washIntensity: 0.25 },
  },
  seq: { lifeline: '#8fb6e0', activation: '#2e6db0', note: '#22599a', noteText: INK, blockText: INK, blockSub: TRAY_INK, cross: '#ffd479', crossLine: '#ffd479' },
}

// The other fill: blocks and trays the colour of the paper, so only the white line work shows.
const OUTLINE_ONLY: Theme = {
  ...BLUEPRINT,
  node: { ...BLUEPRINT.node, colors: { rect: PAPER, round: PAPER, cylinder: PAPER, diamond: PAPER } },
  tray: { ...BLUEPRINT.tray, colors: [PAPER, PAPER, PAPER] },
}

// A deeper, inkier blue, for comparing the paper.
const DEEP = '#123a6b'
const DEEPER: Theme = {
  ...BLUEPRINT,
  ground: { ...BLUEPRINT.ground, bg: DEEP, grid: ['#5a82b3', '#2b5487'] },
  node: { ...BLUEPRINT.node, colors: { rect: '#1d4f8c', round: '#215795', cylinder: '#1b4a85', diamond: '#24609f' } },
  tray: { ...BLUEPRINT.tray, colors: ['#17457c', '#1b4b84', '#1f528c'] },
  edge: { ...BLUEPRINT.edge, labelOutline: DEEP },
}

const stage: Decorator = Story => <div style={{ height: '100vh', background: PAPER }}><Story /></div>
const draw = (theme: Theme, mode: Mode, source = bonkeiMockup): Story => ({ args: { source, theme, mode, toolbar: true }, decorators: [stage] })
const SEQ = SAMPLES['seq: login flow']

export const FlowFlat = draw(BLUEPRINT, 'flat')
export const FlowIso = draw(BLUEPRINT, 'iso')
export const Flow3D = draw(BLUEPRINT, '3d')
export const SequenceFlat = draw(BLUEPRINT, 'flat', SEQ)
export const SequenceIso = draw(BLUEPRINT, 'iso', SEQ)
export const Sequence3D = draw(BLUEPRINT, '3d', SEQ)
export const OutlineOnlyIso = draw(OUTLINE_ONLY, 'iso')
export const OutlineOnlySequence = draw(OUTLINE_ONLY, 'iso', SEQ)
export const DeeperBlueIso = draw(DEEPER, 'iso')

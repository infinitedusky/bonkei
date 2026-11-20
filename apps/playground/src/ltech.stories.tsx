// MOCKUP (BON-247): the LTech theme in the real renderer, as a Theme object made from today's settings only, after the light
// sketches (sketches/ltech-*.html) and lazertechnologies.com: white ground, navy ink, pink kept to small accents, no glow.
// What needs drawing code is not here: the dot grid and the pink haze at the sides, the pink chevron arrowhead, mono-caps tray
// titles with a pink square, dithered tray sides, a grotesk font, and a white label on a black block. The diagrams are the Themes
// stories' ones; MADE-UP SAMPLE DATA.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { BLUEPRINT, BONKEI, Bonkei, type Mode, type Theme } from 'bonkei'
import { SAMPLES, bonkeiMockup } from './samples'

const meta: Meta<typeof Bonkei> = { title: 'Mockups/LTech', component: Bonkei, parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj<typeof Bonkei>

// the site's tokens (--color-*)
const WHITE = '#ffffff', NAVY = '#020a3d', PINK = '#ff42e6', HAZE = '#fff4fd', GREY = '#676c8b', RULE = '#c9cbd8'

const LTECH: Theme = {
  ...BLUEPRINT,
  name: 'ltech',
  ground: { bg: WHITE, grid: ['#e4e5ee', '#eff0f5'], major: 0, majorColor: '#e4e5ee', grain: 0, lit: false },
  light: { ...BONKEI.light, ambient: 1.35, sky: WHITE, floor: '#eeeef4', tones: 2 },
  node: {
    ...BLUEPRINT.node,
    colors: { rect: WHITE, round: '#eceef5', cylinder: WHITE, diamond: HAZE },
    outline: NAVY, outlineWidth: 1.2, bevel: 0, form: 'block', hover: PINK, hoverIntensity: 0.12,
  },
  tray: {
    ...BLUEPRINT.tray,
    thickness: 0.3, colors: [WHITE, '#f4f4f9', '#ececf4'], sides: ['plain', 'plain', 'plain'], titles: 'free',
    patternInk: '#9a9db3', patternPaper: WHITE, outline: RULE, hover: PINK, hoverIntensity: 0.08,
  },
  label: {
    font: null,
    node: { style: 'plain', text: NAVY, plate: WHITE, border: NAVY },
    tray: { style: 'plain', text: NAVY, plate: WHITE, border: RULE },
    toward: 0,
  },
  ink: { ref: 40, min: 1 },
  edge: {
    color: NAVY, width: 1.5, label: GREY, labelOutline: WHITE, portal: PINK, rim: PINK, rimWidth: 1.5, flat: false,
    // no light in the trench: a pink lip is the only accent ("no lasers")
    glow: { core: null, coreWidth: 3.5, halo: null, haloWidth: 11, haloOpacity: 0.28, wash: null, washIntensity: 0.3 },
  },
  seq: { lifeline: RULE, activation: PINK, note: HAZE, noteText: NAVY, blockText: NAVY, blockSub: GREY, cross: PINK, crossLine: PINK },
}

// The site's black button (Message Us ■) as the rounded shape: a white label on it needs a label colour per shape, so here the
// label sits on a white plate instead.
const BLACK_BUTTONS: Theme = {
  ...LTECH,
  node: { ...LTECH.node, colors: { ...LTECH.node.colors, round: '#111111' } },
  label: { ...LTECH.label, node: { style: 'cartouche', text: NAVY, plate: WHITE, border: NAVY } },
}

// Pink-haze trays, for comparing with the white ones.
const HAZE_TRAYS: Theme = { ...LTECH, tray: { ...LTECH.tray, colors: [HAZE, '#fde9f9', '#fbdcf6'], outline: '#e9b8e2' } }

// The hero's ground (the dot grid would need drawing code; this is only the white with the haze at the sides).
const HAZE_BG = `linear-gradient(90deg, #f6c8f0 0%, #fbe3f8 12%, ${WHITE} 26%, ${WHITE} 74%, #fbe3f8 88%, #f6c8f0 100%)`
const stage: Decorator = Story => <div style={{ height: '100vh', background: HAZE_BG }}><Story /></div>
const draw = (theme: Theme, mode: Mode, source = bonkeiMockup): Story => ({ args: { source, theme, mode, toolbar: true }, decorators: [stage] })
const SEQ = SAMPLES['seq: login flow']

export const FlowFlat = draw(LTECH, 'flat')
export const FlowIso = draw(LTECH, 'iso')
export const Flow3D = draw(LTECH, '3d')
export const SequenceFlat = draw(LTECH, 'flat', SEQ)
export const SequenceIso = draw(LTECH, 'iso', SEQ)
export const Sequence3D = draw(LTECH, '3d', SEQ)
export const BlackButtonsIso = draw(BLACK_BUTTONS, 'iso')
export const HazeTraysIso = draw(HAZE_TRAYS, 'iso')

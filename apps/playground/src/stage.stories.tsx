// MOCKUP (BON-253): a glTF model as a stage, and (the Preview stories) BON-255's meeples acting a sequence out on it.
// The models are boxes standing in for loaded glTF files; see stageMock.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { THEME_NAMES } from 'bonkei/internal'
import { StageMock, Problem, KITCHEN, HOUSE, KITCHEN_SCRIPT, HOUSE_SCRIPT } from './stageMock'

const meta: Meta<typeof StageMock> = {
  title: 'Mockups/Stage (BON-253)', component: StageMock, parameters: { layout: 'fullscreen' },
  argTypes: { model: { control: false }, script: { control: false }, mode: { control: 'inline-radio', options: ['flat', 'iso', '3d'] }, theme: { control: 'select', options: THEME_NAMES }, labels: { control: 'inline-radio', options: ['top', 'billboard'] } },
}
export default meta
type Story = StoryObj<typeof StageMock>

/** The kitchen stage in the playground: four named parts labelled, the grill's pieces and the unnamed fridge not. */
export const Kitchen: Story = { args: { mode: 'iso' } }
/** Flat: a floor plan. */
export const KitchenFlat: Story = { args: { mode: 'flat' } }
/** 3D: drag turns, Shift-drag pans, the wheel zooms. */
export const Kitchen3D: Story = { args: { mode: '3d', labels: 'billboard' } }
/** The same stage in a built-in theme: the labels take the theme's plates; the model keeps its own colours. */
export const KitchenBlueprint: Story = { args: { mode: 'iso', theme: 'blueprint' } }
/** An embed: no parts list, just the stage. */
export const KitchenEmbedded: Story = { args: { mode: 'iso', parts: false } }
/** A house, its phone line out to the pole, the exchange and a data centre: five named parts; the walls and road are unnamed. */
export const House: Story = { args: { model: HOUSE, mode: 'iso' } }
/** Two parts named alike: both drawn, with a warning. */
export const DuplicateName: Story = { args: { mode: 'iso', warning: 'two parts are named "grill"; a script pointing at grill will use the first' } }

/** Preview of BON-255, not this task: the order acted out, each message carried by its sender to the receiver. */
export const PreviewKitchenActedOut: Story = { name: 'Preview: kitchen acted out', args: { model: KITCHEN, script: KITCHEN_SCRIPT, mode: 'iso' } }
/** Preview of BON-255, not this task: loading a web page, each message a signal running along the phone line. */
export const PreviewHouseSignals: Story = { name: 'Preview: house, signals on the line', args: { model: HOUSE, script: HOUSE_SCRIPT, mode: 'iso' } }

export const MissingFile: StoryObj = { render: () => <Problem message="line 4: the stage kichen.glb wasn't found (404)" /> }
export const NoNamedParts: StoryObj = { render: () => <Problem title="This stage has no named parts" message={'line 4: blob.glb loaded, but none of its top-level objects has a name.\nName them in your 3D tool (grill, register…) and export again.'} /> }
export const CouldNotFetch: StoryObj = { render: () => <Problem message="line 4: the stage example.com/kitchen.glb couldn't be fetched; the site may not allow other pages to load it (CORS)" /> }
export const Compressed: StoryObj = { render: () => <Problem message={'line 4: kitchen-draco.glb uses Draco compression, which Bonkei can\'t read yet.\nExport again with compression off.'} /> }
export const NotUpdated: StoryObj = { render: () => <Problem strip message="line 4: the stage kitchen2.glb wasn't found (404)" /> }

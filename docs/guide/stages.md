---
description: Show a 3D model (glTF, .glb) as a Bonkei stage. Its named parts are found and labelled on the model, in flat, iso and 3D, with the usual controls. What a model needs, how names are matched, and the errors a model can give.
---

# Stages from a 3D model

A stage is a 3D model shown in Bonkei's flat, iso and 3D views, with the same toolbar and controls as any diagram. Make the scene in any tool that exports glTF (SketchUp, Blender, Spline, the three.js editor), give its parts names (grill, prep line, register), and point a diagram at the file:

```mermaid {live height=420}
---
config:
  bonkei:
    stage: ../stages/kitchen.glb
---
```

The address is relative to the page, as a link would be. The `stage` prop does the same and wins over the frontmatter:

```tsx
<Bonkei source="" stage="/models/kitchen.glb" />
```

A source with a stage and nothing else shows the stage. A diagram written beside a stage is not drawn yet: the stage is shown alone, with a `stage` warning.

## What counts as a part

The model's **top-level named objects** are its parts. If the whole scene sits in one wrapper object (as SketchUp and Blender often export it: unnamed, or named like Scene or RootNode), Bonkei looks inside it; a lone object named by you, such as a grill with nothing else, is one part. A named object with no shape (an empty) is a part where it stands, its name floating over the spot. A model exported in centimetres or millimetres (more than 100 metres across, read as glTF's metres) is shown scaled down to its size in metres. Named objects inside a part are its pieces: the kitchen's grill is a group of named boxes (griddle, hood, …), and only "grill" is labelled. Objects with no name are drawn and not labelled: the kitchen's fridge, the house's walls.

Each part is labelled with its name **as the author wrote it**: "prep line", not "prep_line" (three.js changes spaces in names; Bonkei reads the name from the file).

## How the names are shown

Every part gets a flat, shaded zone under it, in the theme's zone colours. Its name goes, in this order:

1. **on its zone**, in big capitals lying on the floor, if it fits there at the one size every zone name has;
2. else **on the part's own sides**, front and back (or right and left), if the part is wide and tall enough and nothing stands in front of it;
3. else **floating above the part**, one letter under another, with a thin line down to it. A floating name is drawn over the model, so a part inside walls can still be read.

No name is drawn smaller to fit. Zones never overlap each other or another object, and they lie wholly on the model's own floor: where one would run past it, the floor (the model's largest flat object at ground level) is stretched to hold it. A model with no floor of its own gets one in the theme's style, only where a zone needs it. In flat, where the sides of a part cannot be seen, a name written on the sides is also shown floating.

`labels` does not apply to a stage: a stage always names its parts this way.

## Finding a part by name

`onReady` reports a stage's parts in `ready.stage.parts` (`{ name, pieces }`, `name` as written). To match a name the way Bonkei does, use `normaliseName`: case, spaces, `_` and `-` do not matter.

```ts twoslash
import { normaliseName, type ReadyInfo } from 'bonkei'

const find = (ready: ReadyInfo, name: string) => ready.stage?.parts.find(p => normaliseName(p.name) === normaliseName(name))
// find(ready, 'Prep Line') and find(ready, 'prep_line') both find the part named "prep line"
```

Two parts named alike ("grill" and "Grill") are both drawn, with one `stage` warning.

## When a model can't be shown

Nothing is drawn and the error card says why, with `onError` getting `kind: 'stage'`:

- the file is not there (a 404, or a web page sent in its place);
- the file is on another site that does not allow other pages to load it (CORS), or the network failed;
- the file is not a glTF (`.glb` or `.gltf`);
- the model uses Draco or meshopt compression, or KTX2 textures (the extension is named): export it again with compression off;
- none of the model's top-level objects has a name.

When the frontmatter named the file, the error gives its line. If an edit breaks a stage that was drawn, the last one stays with the "Not updated" strip, as for a diagram.

## Size

A page without a stage loads none of this. The first stage fetches Bonkei's stage code and three.js's glTF loader as chunks of their own, then the model, then the Archivo Black font for the names. The script-tag bundle is one file, so it holds all of it.

In VitePress, the plugin draws flowchart and sequence fences only; a fence with just a stage is shown as text.

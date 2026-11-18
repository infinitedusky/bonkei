---
description: How Bonkei draws two lines that cross (crossings), how hard it tries to keep lines apart (avoidCrossings), and how to let the reader choose (crossingControls).
---

# Edge styles

How Bonkei draws two lines that cross, and how hard it tries to keep them apart.

````md
```mermaid
---
config:
  bonkei:
    crossings: bridge
    avoidCrossings: some
---
flowchart LR
  Client --> Database
  API --> Cache
  Client --> Cache
  API --> Database
```
````

```mermaid {height=340}
---
config:
  bonkei:
    crossings: bridge
    avoidCrossings: some
---
flowchart LR
  Client --> Database
  API --> Cache
  Client --> Cache
  API --> Database
```

Drag it to turn it; Flat / Iso / 3D and Fit switch the view.

## Crossings

When two lines must cross, `crossings` says how the crossing is drawn. The default is `none`.

<div class="grid4">

```mermaid {height=200}
---
config: { bonkei: { crossings: none, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
```

```mermaid {height=200}
---
config: { bonkei: { crossings: bridge, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
```

```mermaid {height=200}
---
config: { bonkei: { crossings: tunnel, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
```

```mermaid {height=200}
---
config: { bonkei: { crossings: portal, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
```

</div>

<p class="cap">none · bridge · tunnel · portal</p>

## Avoiding crossings

`avoidCrossings` sets how hard the router keeps lines apart: `off`, `some` (default) or `strong`. Stronger costs routing time when the diagram first draws.

<div class="grid4">

```mermaid {height=200}
---
config: { bonkei: { avoidCrossings: off, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
  A --> C
```

```mermaid {height=200}
---
config: { bonkei: { avoidCrossings: some, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
  A --> C
```

```mermaid {height=200}
---
config: { bonkei: { avoidCrossings: strong, toolbar: false } }
---
flowchart LR
  A --> D
  B --> C
  A --> C
```

</div>

<p class="cap">off · some · strong</p>

<div class="table-wrap">

| Option | Values | Default | Frontmatter |
| --- | --- | --- | --- |
| `crossings` | none · bridge · tunnel · portal | none | `config.bonkei.crossings` |
| `avoidCrossings` | off · some · strong | some | `config.bonkei.avoidCrossings` |
| `crossingControls` | true · false | false | `config.bonkei.crossingControls` |

</div>

## From code

Type-checked against the installed package when the docs build: rename an option and the build fails.

```ts twoslash
import { render, type CrossingStyle, type AvoidCrossings } from 'bonkei'

const crossings: CrossingStyle = 'tunnel'
const avoidCrossings: AvoidCrossings = 'strong'
render(document.body, 'flowchart LR\n  A --> D\n  B --> C', { crossings, avoidCrossings })
```

## Letting the reader choose

The toolbar shows the view and Fit. `crossingControls: true` adds the crossing and avoid-crossing groups so the reader can switch them.

```mermaid {height=300}
---
config:
  bonkei:
    crossingControls: true
---
flowchart LR
  A --> D
  B --> C
```

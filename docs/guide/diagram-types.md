---
description: Which Mermaid diagram types Bonkei draws (flowcharts and sequence diagrams) and what happens to every other type, which is shown as a code block with no error.
---

# Diagram types

Bonkei draws two Mermaid types today: **flowcharts** (`flowchart` or `graph`) and **sequence diagrams** (`sequenceDiagram`).

## Flowchart

```mermaid {height=300}
flowchart TD
  A[Client] --> B[API]
  B --> C[(Database)]
  B --> D{Cache}
  D --> C
```

## Sequence diagram

```mermaid {height=340}
sequenceDiagram
  participant U as User
  participant A as App
  participant D as Database
  U->>A: Log in
  A->>D: Look up the user
  D-->>A: Found
  A-->>U: Welcome
```

## Every other type

A type Bonkei does not draw is left to the site. In VitePress it shows as a code block, with no error and no empty box. This fence is a pie chart:

```mermaid
pie title Pets
  "Dogs" : 386
  "Cats" : 85
```

The same rule holds in the other ways in: `Bonkei.run()` leaves a `<pre class="mermaid">` that is not a flowchart or sequence diagram as text, and `render()` reports a diagram it cannot parse through [`onError`](./errors).

There is no page for a type that is not drawn. When one ships, it gets its own page here.

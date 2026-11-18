# Diagrams

A flowchart (the site-wide height, 420 px):

```mermaid
flowchart TD
  A[Client] --> B[API]
  B --> C[(Database)]
  B --> D{Cache}
  D --> C
```

A sequence diagram:

```mermaid
sequenceDiagram
  participant U as User
  participant A as App
  participant D as Database
  U->>A: Log in
  A->>D: Look up the user
  D-->>A: Found
  A-->>U: Welcome
```

A flowchart with its own height, 600 px:

```mermaid {height=600}
flowchart LR
  Build --> Test --> Ship
```

A pie chart is not a type Bonkei draws, so the fence stays as the site would show it (here, a code block):

```mermaid
pie title Pets
  "Dogs" : 386
  "Cats" : 85
```

<p id="below">The paragraph below the diagrams.</p>

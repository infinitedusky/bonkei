// MADE-UP SAMPLE DATA: the diagram of sketches/brand-theme.html, drawn live in each theme by the Themes section.
// The playground's "flow: bonkei mockup" diagram (apps never import each other) plus two dotted links,
// added so every theme shows how it draws a dotted link and Cloud Cartography shows its arcs.
export const THEMES_DIAGRAM = `flowchart LR
  Client[Client] --> GW[API gateway]
  subgraph Services
    Auth((Auth))
    Orders[Orders]
    subgraph Billing
      Invoices[Invoices] --> Paid{Paid?}
    end
  end
  subgraph Data
    PG[(Postgres)]
    Cache((Cache))
  end
  GW --> Auth
  GW --> Orders
  Orders --> Invoices
  Orders --> PG
  Auth --> Cache
  Paid -.->|receipt| Client
  Cache -.-> Orders
`

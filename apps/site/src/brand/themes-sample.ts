// The diagram of sketches/brand-theme.html, drawn live in each theme. Same diagram as the playground's "flow: bonkei mockup".
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
`

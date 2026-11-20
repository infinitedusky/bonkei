// Two diagrams the layout tests use: layout-main.json holds what main's layout drew them as (BON-234). MADE-UP SAMPLE DATA.
export const SRC: Record<string, string> = {
  sample: `flowchart LR
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
`,
  deep: `flowchart TD
  Web[Web] --> API[API]
  subgraph Platform
    subgraph Core
      API
      subgraph Auth
        Login[Login] --> Tokens[Tokens]
        subgraph Keys
          KMS[(KMS)]
        end
      end
    end
    subgraph Jobs
      Queue((Queue)) --> Worker[Worker]
    end
  end
  subgraph Data
    DB[(DB)]
  end
  API --> Login
  Tokens --> KMS
  API --> Queue
  Worker --> DB
`,
}

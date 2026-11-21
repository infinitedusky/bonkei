import small from './sample.mmd?raw'

const large = `flowchart TD
  Client((Browser)) -->|HTTPS| WAF
  Mobile((Mobile App)) -->|HTTPS| WAF
  subgraph Platform["Platform"]
    subgraph Edge["Edge"]
      WAF{WAF Rules} -->|allowed| LB[Load Balancer]
      LB --> GW[API Gateway]
      GW -->|token check| AuthN[AuthN]
      CDN[(Static Cache)] --- LB
    end
    subgraph Core["Core Services"]
      subgraph Orders["Orders"]
        OrderAPI[Order API] -->|validate| OrderVal{Valid?}
        OrderVal -->|yes| OrderSvc[Order Service]
        OrderVal -->|no| OrderErr[Reject]
        OrderSvc --> OrderQ[(Order Queue)]
      end
      subgraph Payments["Payments"]
        PayAPI[Payment API] --> Fraud{Fraud Check}
        Fraud -->|ok| Charge[Charge Card]
        Fraud -->|flagged| Review[Manual Review]
        Charge --> Ledger[(Ledger)]
        Review -->|approve| Charge
      end
      subgraph Users["Users"]
        UserAPI[User API] --> Profile[Profile Svc]
        Profile --> Prefs[(Preferences)]
        UserAPI --> Session[Session Svc]
      end
      subgraph Catalog["Catalog"]
        CatAPI[Catalog API] --> Inventory[Inventory]
        CatAPI --> Pricing(Pricing)
        Inventory --> StockDB[(Stock DB)]
      end
      subgraph Notify["Notifications"]
        NotifSvc[Notifier] --> Email(Email)
        NotifSvc --> Push(Push)
        NotifSvc --> SMS(SMS)
      end
    end
    subgraph Data["Data Layer"]
      subgraph SQL["Relational"]
        PG[(PostgreSQL)] -->|replicates| Replica[(Read Replica)]
        PG --> Backup[(Backup)]
      end
      subgraph Cache["Caching"]
        Redis[(Redis)]
        Memc[(Memcached)]
      end
      subgraph Search["Search"]
        ES[(Elastic)] --> Indexer[Indexer]
      end
    end
    subgraph Ops["Observability"]
      Metrics[Metrics] --> Dash[Dashboards]
      Logs[Logs] --> Dash
      Traces[Tracing] --> Dash
      Dash --> Alerts{Alert?}
      Alerts -->|page| OnCall((On Call))
    end
  end
  GW -->|/orders| OrderAPI
  GW -->|/pay| PayAPI
  GW -->|/users| UserAPI
  GW -->|/catalog| CatAPI
  AuthN --> Session
  OrderSvc -->|reserve| Inventory
  OrderSvc -->|charge| PayAPI
  OrderQ -->|events| NotifSvc
  Charge -->|receipt| NotifSvc
  Ledger --> PG
  OrderSvc --> PG
  Profile --> PG
  StockDB --> Replica
  Session --> Redis
  Pricing --> Memc
  CatAPI --> ES
  Inventory -->|reindex| Indexer
  Indexer --> ES
  OrderSvc --> Metrics
  Charge --> Metrics
  GW --> Logs
  Fraud --> Traces
  Replica --> Metrics
  Email -->|bounce| Logs
  Alerts -->|retry| OrderSvc
  OrderSvc -->|status| GW
  GW -->|response| Client
`

const srcs = Array.from({ length: 30 }, (_, i) => `S${i + 1}[Source ${i + 1}]`)
const wide = `flowchart TD
${srcs.map((s, i) => `  ${s} --> T${(i % 5) + 1}${i % 7 === 0 ? `\n  S${i + 1} -->|also| T${((i + 2) % 5) + 1}` : ''}`).join('\n')}
  T1[(Target A)]
  T2[Target B]
  T3(Target C)
  T4{Target D}
  T5[(Target E)]
`

const login = `sequenceDiagram
  actor User
  participant Browser
  participant API as API Gateway
  participant Auth as Auth Service
  participant DB as User DB
  participant Mail
  User->>Browser: enter credentials
  Browser->>+API: POST /login
  API->>+Auth: verify(user, pass)
  Auth->>+DB: SELECT user
  DB-->>-Auth: user row
  alt valid password
    Auth-->>API: JWT
    API-->>Browser: 200 + cookie
    Browser-->>User: show dashboard
  else invalid password
    Auth->>DB: increment failures
    Auth-->>API: 401
    loop up to 3 times
      Browser->>User: retry prompt
      User->>Browser: new password
    end
    Note over Auth,Mail: lock account after 5 failures
    Auth-)Mail: send lockout email
  end
  deactivate Auth
  API-->>-Browser: done
  Browser-xAPI: abort stale request
`

const checkout = `sequenceDiagram
  actor Shopper
  participant Web
  participant Cart
  participant Catalog
  participant Pricing
  participant Orders
  participant Payments
  participant Fraud
  participant Warehouse
  participant Notify
  Shopper->>Web: click Checkout
  Web->>+Cart: getCart()
  Cart->>Catalog: lookup items
  Catalog-->>Cart: item details
  Cart->>Pricing: priceCart()
  Pricing-->>Cart: totals + tax
  Cart-->>-Web: cart summary
  Web-->>Shopper: show summary
  Shopper->>Web: confirm address
  Web->>+Orders: createOrder()
  Orders->>Catalog: reserve stock
  alt stock available
    Catalog-->>Orders: reserved
    Orders->>+Payments: charge(total)
    Payments->>+Fraud: score(order)
    Fraud-->>-Payments: low risk
    opt coupon applied
      Payments->>Pricing: redeem coupon
      Pricing-->>Payments: ok
    end
    Payments-->>-Orders: paid
    Orders->>Warehouse: pick & pack
    Warehouse-->>Orders: shipment id
    par notify customer
      Orders-)Notify: order confirmation
      Notify-->>Shopper: email
    and update inventory
      Orders-)Catalog: decrement stock
    end
    Orders-->>-Web: order #1234
    Web-->>Shopper: success page
  else out of stock
    Catalog-->>Orders: unavailable
    Orders-->>Web: 409
    Web-->>Shopper: sorry
  end
  Note right of Warehouse: ships within 24h
  loop every hour
    Warehouse->>Orders: tracking update
    Orders->>Notify: status changed
  end
  Orders->>Orders: archive order
  Fraud-xPayments: late chargeback signal
`

// made-up checkout flow: Payments with Risk nested in it, an edge to the Payments tray itself
const checkoutFlow = `flowchart LR
  Client([Client]) --> Pay
  Notifier[Notifier] --> Pay
  Client --> Audit[Audit]
  subgraph Payments
    Pay[Pay API]
    subgraph Risk
      Fraud{Fraud Check}
      Review[Review]
    end
    Pay --> Fraud
  end
  Fraud --> Review
  Fraud --> Ledger[(Ledger)]
  Ledger --> Payments`
// The diagram of sketches/brand-theme.html, for comparing the Bonkei themes with the mockup.
export const bonkeiMockup = `flowchart LR
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
// made-up platform four trays deep (Platform > Core > Auth > Keys), top to bottom: where each tray's title goes in Blueprint
export const nested = `flowchart TD
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
`

// MADE-UP SAMPLE DATA: the Cloud Cartography mockup's "source, as written" (BON-235): three top-level zones and a nested one, all four shapes, two-line labels and two dotted links.
export const cloudMap = `---
config:
  theme: cloud-cartography
---
flowchart LR
  subgraph edge[Edge]
    browser(["Browser<br>Web · mobile"]) --> gw["API Gateway<br>Envoy · TLS"]
  end
  subgraph orders[Orders]
    oapi["Order API<br>Go · 3 pods"] --> valid{Valid?}
    valid -->|yes| osvc["Order Svc<br>Go · 2 pods"]
    subgraph data[Data]
      queue[("Order Queue<br>Kafka")]
    end
    osvc --> queue
  end
  subgraph payments[Payments]
    papi["Payment API<br>Node · 3 pods"] --> fraud{Fraud?}
    fraud -->|ok| charge(["Charge Card<br>Stripe adapter"])
    charge --> ledger[("Ledger<br>Postgres · HA")]
  end
  gw --> oapi
  gw --> papi
  queue -.->|pay| papi
  ledger -.->|receipt| browser
`

// A stage is a model file beside the page: `stages/…` is /app/stages/… here (apps/playground/scripts/make-stages.mjs writes them).
const stage = (file: string) => `---\nconfig:\n  bonkei:\n    stage: ${file}\n---\n`

export const SAMPLES: Record<string, string> = {
  'flow: small (sample.mmd)': small,
  'flow: bonkei mockup': bonkeiMockup,
  'flow: large (~50 nodes)': large,
  'flow: wide (30 → 5)': wide,
  'flow: checkout': checkoutFlow,
  'flow: nested (4 deep)': nested,
  'seq: login flow': login,
  'seq: checkout flow': checkout,
  'flow: cloud cartography (map)': cloudMap,
  'stage: kitchen': stage('stages/kitchen.glb'),
  'stage: house and phone line': stage('stages/house.glb'),
  'stage: inside a wrapper node': stage('stages/wrapped.glb'),
  'stage: two parts named alike': stage('stages/duplicate.glb'),
  'stage: a part with no shape': stage('stages/empty-part.glb'),
  'stage: in millimetres': stage('stages/kitchen-mm.glb'),
  'stage: one part alone': stage('stages/lone-part.glb'),
  'stage: no named parts': stage('stages/blob.glb'),
  'stage: missing file': stage('stages/kichen.glb'),
  'stage: not a glTF': stage('stages/not-a-model.glb'),
  'stage: Draco compression': stage('stages/kitchen-draco.glb'),
  'stage: KTX2 textures': stage('stages/kitchen-ktx2.glb'),
  'stage: other site (CORS)': stage('https://example.com/kitchen.glb'),
}

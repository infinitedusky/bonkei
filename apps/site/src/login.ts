// The 'seq: login flow' sample (made-up data), copied from the playground's sample list.
export const login = `sequenceDiagram
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

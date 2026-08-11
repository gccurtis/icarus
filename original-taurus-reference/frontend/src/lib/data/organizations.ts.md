# src/lib/data/organizations.ts — breakdown

Companion to [organizations.ts](organizations.ts). The **data boundary** for organizations: a one-line re-export of the organizations system so application code imports from `$data/organizations` and never reaches into `$systems/*` directly.

## Re-export

### Forward the whole organizations system

```ts
export * from '$systems/organizations/index';
```

Per AGENTS.md, features and components talk to Omega through `src/lib/data/*` clients rather than importing systems modules directly. This file makes `$data/organizations` an alias for the `$systems/organizations` barrel, so the systems layer stays swappable behind the data boundary while call sites keep a stable, front-end-facing import path.

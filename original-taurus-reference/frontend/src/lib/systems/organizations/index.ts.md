# src/lib/systems/organizations/index.ts — breakdown

Companion to [index.ts](index.ts). The organizations **system barrel** — it re-exports the domain types, the Svelte store, and the API client from a single module so the rest of the app pulls the whole system in from one path.

## Re-exports

### Re-export the types, store, and API client

```ts
export * from './types';
export * from './store';
export * from './api';
```

The barrel flattens the three sibling modules into one public surface: `types` supplies the domain types (`Organization`, `OrgRole`, `OrgMember`) and helpers, `store` supplies the `organizations` writable, and `api` supplies the load/create/rename/member functions. Consumers import from `$systems/organizations` (via the `$data/organizations` boundary) rather than reaching into individual files, so the internal file layout stays free to change without touching call sites.

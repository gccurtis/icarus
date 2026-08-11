# src/lib/systems/resources/index.ts — breakdown

Companion to [index.ts](index.ts). The public barrel for the resources system: it re-exports the entire surface of the four sibling modules so the rest of the app imports resource types, stores, API functions, and the runtime registry from a single specifier (`$data/resources`) instead of reaching into individual files.

## Barrel re-exports

### Re-export every symbol from the four resource modules

```ts
export * from './types';
export * from './store';
export * from './api';
export * from './registry';
```

The system is split across four files by role — `types` (domain shapes and the kind vocabulary), `store` (the reactive Svelte stores), `api` (the Omega client plus optimistic mutations), and `registry` (per-kind runtime factories) — and this index flattens them into one import surface. Consumers write `import { … } from '$data/resources'` and never depend on the internal file layout, so the modules can be reorganized without touching call sites. Re-exporting with `export *` keeps the barrel zero-maintenance: new public symbols in any module appear here automatically.

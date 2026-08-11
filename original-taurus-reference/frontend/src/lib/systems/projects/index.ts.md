# src/lib/systems/projects/index.ts — breakdown

Companion to [index.ts](index.ts). The barrel entry point for the projects system: it
re-exports the public surface of the five sibling modules so the rest of the app imports
from `$data/projects` rather than reaching into individual files.

## Barrel re-exports

### Re-export types, store, API client, activity, and the roster from one entry point

```ts
export * from './types';
export * from './store';
export * from './api';
export * from './activity';
export * from './roster';
```

Each `export *` forwards everything a sibling module exposes: the type vocabulary from
`types.ts`, the writable `projects` store from `store.ts`, the CRUD/sharing/names client from
`api.ts`, the activity-feed helpers from `activity.ts`, and the cached member roster plus its
`byAccess`/`ownerOf` projections from `roster.ts`. Consumers therefore have a single
import specifier (`$data/projects`) for the whole system, and the physical file layout can
change without touching call sites.

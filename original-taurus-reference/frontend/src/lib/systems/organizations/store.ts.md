# src/lib/systems/organizations/store.ts — breakdown

Companion to [store.ts](store.ts). The client-side store holding the caller's organizations. Unlike the project-scoped stores, this one is user-scoped — organizations span projects — so it is populated from the user menu rather than on a project switch, and members are fetched per-org on demand instead of being cached here.

## Imports

### Pull in Svelte's writable and the Organization type

```ts
import { writable } from 'svelte/store';
import type { Organization } from './types';

```

The store needs only Svelte's `writable` factory and the `Organization` type it holds. The blank line separates the imports from the single export below.

## The organizations store

### The user-scoped writable of the caller's organizations

```ts
/**
 * The caller's organizations. Unlike project-scoped stores this is user-scoped —
 * organizations span projects — so it is loaded from the user menu, not on project
 * switch. Members are fetched per-org on demand (not held here).
 */
export const organizations = writable<Organization[]>([]);
```

`organizations` is a plain writable seeded with an empty array; the API layer fills it via `loadOrganizations` and keeps it in sync on create and rename. Keeping it user-scoped (not reset per project) means the org list survives project switches, and deliberately not holding member lists here keeps the store small — the dialog fetches members only for the org the user opens.

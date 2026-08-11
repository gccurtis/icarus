# src/lib/systems/projects/store.ts — breakdown

Companion to [store.ts](store.ts). The single Svelte store backing the projects system: a
writable list of the current user's projects that the API client keeps in sync and that
components subscribe to for reactive rendering.

## The projects store

### Import the writable store factory and the Project type

```ts
import { writable } from 'svelte/store';
import type { Project } from './types';

```

`writable` is Svelte's factory for a mutable, subscribable store, and `Project` is the shape
of each element the store holds. The blank line separates the imports from the declaration.

### Declare the writable projects store

```ts
export const projects = writable<Project[]>([]);
```

`projects` is the app-wide source of truth for the user's project list, initialised empty.
`api.ts` populates and mutates it (`set`/`update`) as projects are fetched, created, deleted,
or updated, and any component can subscribe with the `$projects` auto-subscription.

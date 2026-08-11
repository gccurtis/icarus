# src/lib/systems/resources/store.ts — breakdown

Companion to [store.ts](store.ts). The two writable Svelte stores that hold the resources system's reactive state: the catalog of resources for the active project, and the set of resource kinds the backend allows creating. Every other module in the system reads and writes through these two singletons.

## Imports

### Import Svelte's writable factory and the resource types

```ts
import { writable } from 'svelte/store';
import type { Resource, ResourceKind } from './types';

```

`writable` is Svelte's basic mutable store constructor. `Resource` and `ResourceKind` are the domain types that parameterize the stores below, imported type-only so they erase at build time. The trailing blank line separates the import block from the store declarations.

## Stores

### The resource catalog and the available-kinds stores

```ts
export const resources = writable<Resource[]>([]);
export const availableKinds = writable<ResourceKind[]>([]);
```

`resources` holds the current project's resource list — the API layer replaces it on load and updates it optimistically on create/rename/delete, while components subscribe via `$resources`. `availableKinds` holds the kinds Omega reports as creatable for the project, which gates the create UI. Both start empty and are populated when a project's resources load; keeping them as module-level singletons means every consumer shares one reactive source of truth rather than passing state through props.

### The load-completion flag

```ts
export const resourcesLoaded = writable(false);
```

Whether `resources` currently holds an *authoritative* answer for the active project.

This exists because Omega filters the catalog by access scope, which makes `resources` do double
duty: it is not only the list to render, it is the definition of **what this user is allowed to know
exists**. The activity feed reads it that way — any event target missing from the catalog is
redacted, because `GET /activity` performs no access check of its own.

That inference is only sound once the catalog has actually arrived. Before then, the initial `[]` is
indistinguishable from "you may see nothing", and a surface making an access decision on it would
redact the entire feed. `enterProjectResources` clears this on entry (a stale catalog from the
project being left must not answer for the one being entered) and sets it in a `finally`, so a failed
load still resolves rather than stranding the feed on its loading state forever.

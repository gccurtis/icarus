# src/lib/features/shared/surface.ts — breakdown

Companion to [surface.ts](surface.ts). The **surface-contribution store** — the
panel-system contract
([docs/archive/plans/2026-07-21-panel-system-design.md](../../../../docs/archive/plans/2026-07-21-panel-system-design.md)):
the active stage publishes the panel sections it brings to the shell rails. A surface's
context set replaces the project-context fallback; inspector contributions merge with
the shell's permanent sections. The shell renders content blind. Lives in
`features/shared/` (the neutral cross-feature spot) so both the shell and any stage may
import it without violating the dependency rules.

## Imports

### The store factory and the Component type

```ts
import { writable } from 'svelte/store';
import type { Component } from 'svelte';

```

`writable` backs the single contribution store at the bottom; `Component` is Svelte's
component type, used so a section can carry the actual component the shell will render.

## PanelSection

### The module contract and one rail section's shape

```ts
/**
 * The surface-contribution store — how the active stage brings its own panel
 * sections to the shell rails (docs/archive/plans/2026-07-21-panel-system-design.md).
 *
 * An active surface's context sections REPLACE the project-context fallback so
 * each stage gets a relevant left rail. Inspector sections still LEAD the
 * permanent shell sections (the surface's "Details" lens comes first). A stage
 * publishes on mount/load and clears on destroy — one writer, like the editor
 * session. The shell renders contributed content blind; each implemented
 * section's component reads its own surface's session store.
 *
 * Workspace-ready constraints: section ids are stable, serializable strings —
 * they're what the workspace persistence stores. Components are carried only in
 * memory, never persisted.
 */
export type PanelSection = {
  /** Stable id, unique within its rail (persisted as the active section). */
  id: string;
  label: string;
  icon: Component;
  /** Rendered with no props; reads its surface's session store. */
  content?: Component;
  /** Honest holding copy for a view whose contents have not been defined yet. */
  placeholder?: string;
};

```

The module doc comment states the whole contract: context sections replace the
project-context fallback, inspector sections lead the permanent ones, one writer, and
the workspace-ready rule that only stable `id` strings are persisted. `PanelSection`
is one rail entry: its persisted identity (`id`) plus the `label`/`icon` for the rail,
and then either a `content` component to render or `placeholder` holding copy for a
view whose contract is still pending.

## SurfaceContribution

### A surface's full contribution across both rails

```ts
export type SurfaceContribution = {
  /** Stable id for the surface instance, e.g. `document:<docId>`. */
  id: string;
  /** Implicit-context label for the AI Agent panel, e.g. the document's name. */
  scope?: string;
  /** Complete left-rail section set, replacing the project-context fallback. */
  context?: PanelSection[];
  /** Sections leading the right rail (the surface's Details lens first). */
  inspector?: PanelSection[];
};

```

`SurfaceContribution` groups a surface's sections per rail: an instance `id`, an
optional `scope` label the AI Agent panel shows as implicit context, the `context`
sections for the left rail (which replace the fallback), and the `inspector` sections
that lead the right rail. Both section arrays are optional, so a surface can contribute
to one rail without the other.

## The store

### The single writable holding the active contribution

```ts
/** The active stage's contribution; null when no surface claims the rails. */
export const activeSurface = writable<SurfaceContribution | null>(null);
```

One writable, written only by the active stage: it sets its contribution after load and
resets to `null` on destroy. `null` is the unclaimed state — the shell then falls back
to the project-context left rail and shows only its permanent inspector sections.

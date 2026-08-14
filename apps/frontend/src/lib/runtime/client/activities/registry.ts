import Compass from "@lucide/svelte/icons/compass";

import type { Activity } from "$runtime/client/activities/types";
import Placeholder from "$runtime/client/activities/views/placeholder.svelte";
import type { ResourceKind } from "$runtime/client/workbench";

/**
 * The activity sets, one per resource kind. Static: what a kind offers is a
 * property of that kind, not something assembled at runtime.
 *
 * `Record<ResourceKind, …>` rather than a partial map, so adding a resource kind
 * fails to compile until it has been given a rail. A kind that reaches the panel
 * with no activities has no way to render, and finding that at runtime is
 * strictly worse than finding it at build time.
 *
 * The first entry of each array is that kind's default — what the rail shows
 * before the user has chosen, and what it falls back to when a tab points at an
 * activity the kind no longer offers.
 *
 * An activity may be shared between kinds by defining it once and listing it in
 * several arrays.
 *
 * **Frozen, and process-wide.** These are immutable maps of stateless component
 * references, which is what makes module scope safe for them where it is not
 * safe for anything holding user state. That stops being true the day this
 * gains a `register()`, so the freeze is the reminder as much as the guard.
 */

const OVERVIEW: Activity = Object.freeze({
  id: "overview",
  label: "Overview",
  icon: Compass,
  view: Placeholder
});

export const ACTIVITIES: Record<ResourceKind, readonly Activity[]> = Object.freeze({
  "project-overview": Object.freeze([OVERVIEW])
});

import Compass from "@lucide/svelte/icons/compass";

import Placeholder from "$lib/capabilities/context/views/placeholder.svelte";
import type { Activity } from "$lib/capabilities/context/types";
import type { ResourceKind } from "$lib/capabilities/session";

/**
 * The activity sets, one per resource kind. Static: what a kind offers is a
 * property of that kind, not something assembled at runtime.
 *
 * `Record<ResourceKind, …>` rather than a partial map, so adding a resource
 * kind fails to compile until it has been given a rail. A kind that reaches the
 * context panel with no activities has no way to render, and finding that at
 * runtime is strictly worse than finding it at build time.
 *
 * The first entry of each array is that kind's default — what the rail shows
 * before the user has chosen, and what it falls back to when a session points
 * at an activity the kind no longer offers.
 *
 * An activity may be shared between kinds by defining it once and listing it in
 * several arrays.
 */

const OVERVIEW: Activity = {
  id: "overview",
  label: "Overview",
  icon: Compass,
  view: Placeholder,
};

export const ACTIVITIES: Record<ResourceKind, readonly Activity[]> = {
  "project-overview": [OVERVIEW],
};

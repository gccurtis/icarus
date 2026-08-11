import { writable } from 'svelte/store';
import { setPanel } from '$data/workspace';
import type { ActivityEvent } from '$data/projects';

/**
 * The Overview stage's inspector session — the equivalent of the document
 * editor's `editorSession`, and for the same reason: the shell renders a
 * surface's contributed panels with NO props, so a lens has to read its
 * selection from a store its stage writes.
 *
 * Overview has two independent things a user can point at, and they stay
 * separate on purpose. Row click is *inspection* (one resource, drives the
 * lens); the checkbox column is the *bulk set* (download/export). Merging them
 * would mean glancing at a resource silently arms a bulk action — so each gets
 * its own lens instead, and whichever the user touched last is what the
 * inspector shows.
 */
export type OverviewSelection =
  | { mode: 'none' }
  /** One row, inspected. Held by id so a rename re-renders the live resource. */
  | { mode: 'resource'; resourceId: string }
  /** The checkbox set, 1+ rows. */
  | { mode: 'resources'; resourceIds: string[] }
  /**
   * One activity event. The event is carried whole because it is immutable and
   * has no other source; `redacted` is decided by the feed, which owns the
   * access rule, so the lens never re-derives it.
   */
  | { mode: 'activity'; event: ActivityEvent; redacted: boolean };

const NONE: OverviewSelection = { mode: 'none' };

export const overviewSelection = writable<OverviewSelection>(NONE);

/**
 * The project the lenses should query. Panels are rendered with no props, so the
 * per-resource timeline (`/activity?targetID=`) has no other way to learn which
 * project it belongs to. Written by `OverviewStage`.
 */
export const overviewProjectId = writable('');

/**
 * Bring the Details lens forward.
 *
 * Selecting something is an explicit "show me this", so it is worth overriding a
 * collapsed rail or another active section — a click that appears to do nothing
 * because the inspector is closed is the failure this avoids.
 */
function reveal() {
  setPanel('inspector', { section: 'details', collapsed: false });
}

export function inspectResource(resourceId: string): void {
  overviewSelection.set({ mode: 'resource', resourceId });
  reveal();
}

/** The bulk set changed. An empty set is a clearing, not a selection. */
export function inspectResources(resourceIds: string[]): void {
  if (!resourceIds.length) {
    overviewSelection.update((s) => (s.mode === 'resources' ? NONE : s));
    return;
  }
  overviewSelection.set({ mode: 'resources', resourceIds });
  reveal();
}

export function inspectActivity(event: ActivityEvent, redacted: boolean): void {
  overviewSelection.set({ mode: 'activity', event, redacted });
  reveal();
}

/** Called when the stage unmounts or the project changes — selections never cross projects. */
export function clearOverviewSelection(): void {
  overviewSelection.set(NONE);
}

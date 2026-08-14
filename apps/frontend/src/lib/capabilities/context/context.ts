import { ACTIVITIES } from "$lib/capabilities/context/activities";
import type { Activity, ActivityId, ContextRuntime } from "$lib/capabilities/context/types";
import { sessions } from "$lib/capabilities/session";
import { workspace } from "$lib/capabilities/workspace";

/**
 * The context runtime.
 *
 * A plain `.ts` file, not `.svelte.ts`, because this runtime holds **no state
 * of its own**. Every value it exposes is a projection over two things that do:
 * the active session (which activity this tab chose) and workspace (how wide
 * the panel is). Reading `$state` through a getter tracks correctly wherever
 * the read happens, so a component consuming this stays reactive without the
 * runtime owning a single field.
 *
 * That is worth preserving. The moment this file needs `$state` of its own,
 * something has been put in the wrong place — panel geometry belongs to
 * workspace so zones stay put across tabs, and per-tab choices belong to the
 * session so each tab keeps its own.
 */

/** Structural. The rail is not resizable and does not collapse. */
export const RAIL_WIDTH = 44;

/** Content portion only — add RAIL_WIDTH for the panel's total. */
export const CONTENT_DEFAULT = 276;
export const CONTENT_MIN = 236;
export const CONTENT_MAX = 396;

/**
 * Drag below this and the panel collapses rather than clamping. Set below the
 * minimum rather than at it, so a user dragging for "as small as possible" can
 * rest at the minimum without the panel snapping shut under them. Collapsing
 * and clamping are the same gesture separated only by this number.
 */
export const COLLAPSE_AT = CONTENT_MIN - 40;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

class Context implements ContextRuntime {
  get activities(): readonly Activity[] {
    return ACTIVITIES[sessions.active.resource.kind];
  }

  get activeActivity(): Activity {
    const available = this.activities;
    const chosen = sessions.active.options.activityId;
    // Falling back rather than throwing: a stored id can outlive a change to
    // the activity set, and a reset rail is a harmless outcome where a crash
    // is not.
    return available.find((activity) => activity.id === chosen) ?? available[0];
  }

  select(id: ActivityId): void {
    if (!this.activities.some((activity) => activity.id === id)) {
      throw new Error(
        `Activity ${id} is not available for resource kind ${sessions.active.resource.kind}.`
      );
    }
    sessions.update(sessions.activeId, { activityId: id });
  }

  get contentWidth(): number {
    return workspace.defaults.contextWidth;
  }

  get collapsed(): boolean {
    return workspace.defaults.contextCollapsed;
  }

  resize(width: number): void {
    if (width < COLLAPSE_AT) {
      // Deliberately does not write contextWidth: the last expanded width is
      // retained so toggle() restores where the user was rather than snapping
      // back to the default.
      workspace.remember({ contextCollapsed: true });
      return;
    }
    workspace.remember({
      contextCollapsed: false,
      contextWidth: clamp(width, CONTENT_MIN, CONTENT_MAX),
    });
  }

  toggle(): void {
    workspace.remember({ contextCollapsed: !this.collapsed });
  }
}

export const context: ContextRuntime = new Context();

import type { InspectorRuntime, InspectorView } from "$lib/capabilities/inspector/types";
import { INSPECTOR_VIEWS } from "$lib/capabilities/inspector/views";
import { sessions, type Inspection, type InspectionNode } from "$lib/capabilities/session";
import { workspace } from "$lib/capabilities/workspace";

/**
 * The inspector runtime.
 *
 * Like the context runtime, a plain `.ts` holding no state of its own — every
 * value is a projection over the active session and workspace. Switching tabs
 * restores that tab's inspection with no code here, because the inspection was
 * never stored here to begin with.
 *
 * Nothing in this file listens to focus or selection events. An inspection
 * changes only when something calls `inspect()`, which is what lets it hold
 * while the editor is blurred — click into the inspector, the caret collapses,
 * and the panel keeps showing what the user came to work on.
 */

export const WIDTH_DEFAULT = 320;
export const WIDTH_MIN = 280;
export const WIDTH_MAX = 440;

/** Below the minimum, not at it — see the same reasoning in the context runtime. */
export const COLLAPSE_AT = WIDTH_MIN - 40;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

class Inspector implements InspectorRuntime {
  get inspection(): Inspection | undefined {
    return sessions.active.options.inspection;
  }

  get current(): InspectionNode | undefined {
    const ancestry = this.inspection;
    // Innermost last. The ancestry above it is what a breadcrumb walks, so the
    // step outward stays available without being imposed.
    return ancestry?.at(-1);
  }

  get view(): InspectorView | undefined {
    const node = this.current;
    return node ? INSPECTOR_VIEWS[node.kind] : undefined;
  }

  inspect(inspection?: Inspection): void {
    sessions.update(sessions.activeId, { inspection });
  }

  get width(): number {
    return workspace.defaults.inspectorWidth;
  }

  get collapsed(): boolean {
    return workspace.defaults.inspectorCollapsed;
  }

  resize(width: number): void {
    if (width < COLLAPSE_AT) {
      // Leaves inspectorWidth untouched so toggle() restores the user's width.
      workspace.remember({ inspectorCollapsed: true });
      return;
    }
    workspace.remember({
      inspectorCollapsed: false,
      inspectorWidth: clamp(width, WIDTH_MIN, WIDTH_MAX),
    });
  }

  toggle(): void {
    workspace.remember({ inspectorCollapsed: !this.collapsed });
  }
}

export const inspector: InspectorRuntime = new Inspector();

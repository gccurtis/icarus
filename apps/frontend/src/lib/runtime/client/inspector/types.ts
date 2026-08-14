import type { Component } from "svelte";
import type { Inspection, InspectionNode } from "$runtime/client/workbench";

/**
 * Inspector — the lens. It answers "what is this selected thing?"
 *
 * It owns view resolution and nothing else. What is under inspection belongs to
 * the workbench, so switching tabs restores each tab's inspection without the
 * inspector doing anything.
 */

/**
 * Every inspector view is handed the node it is inspecting. Stated as a type
 * rather than left to each view, so adding one cannot quietly invent its own
 * prop contract.
 */
export type InspectorViewProps = { node: InspectionNode };

export type InspectorView = Component<InspectorViewProps>;

export type InspectorRuntime = {
  /** The active tab's inspection ancestry, outermost first. */
  readonly inspection: Inspection | undefined;
  /** The innermost node — what the inspector shows by default. */
  readonly current: InspectionNode | undefined;
  /**
   * Resolved from `current.kind`. Undefined when nothing is inspected, which is
   * the panel's cue to render the nothing-inspected view — that state has no
   * node to hand a view, so pretending otherwise would mean every view
   * defending against a node that isn't there.
   */
  readonly view: InspectorView | undefined;
  /** Replaces the active tab's inspection. Passing nothing clears it. */
  inspect(inspection?: Inspection): void;
};

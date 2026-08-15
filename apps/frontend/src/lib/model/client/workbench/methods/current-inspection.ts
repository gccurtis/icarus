import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import type { InspectionNode } from "$model/client/workbench/types";

/**
 * The innermost node of the active tab's inspection.
 *
 * Innermost last, because the ancestry above it is what a breadcrumb walks: the
 * step outward stays reachable without being imposed. Undefined when nothing is
 * inspected, which is the panel's cue to render the nothing-inspected view — a
 * placeholder node standing in for absence would mean every view defending
 * against a node that is not really there.
 */
export const currentInspection = (state: WorkbenchState): InspectionNode | undefined =>
  activeTab(state).options.inspection?.at(-1);

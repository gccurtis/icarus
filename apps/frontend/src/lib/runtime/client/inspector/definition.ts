import { INSPECTOR_VIEWS } from "$runtime/client/inspector/registry";
import type { InspectorRuntime, InspectorView } from "$runtime/client/inspector/types";
import type { Inspection, InspectionNode, WorkbenchRuntime } from "$runtime/client/workbench";

/**
 * A plain `.ts`, not `.svelte.ts`: like the activities projection, this holds no
 * state of its own. Every value reads through the workbench, and reading `$state`
 * through a getter tracks wherever the read happens.
 *
 * Nothing here listens to focus or selection events. An inspection changes only
 * when something calls `inspect()`, which is what lets it hold while the editor
 * is blurred — click into the inspector, the caret collapses, and the panel
 * keeps showing what the user came to work on.
 */
export class Inspector implements InspectorRuntime {
  constructor(private readonly workbench: WorkbenchRuntime) {}

  get inspection(): Inspection | undefined {
    return this.workbench.active.options.inspection;
  }

  get current(): InspectionNode | undefined {
    // Innermost last. The ancestry above it is what a breadcrumb walks, so the
    // step outward stays available without being imposed.
    return this.inspection?.at(-1);
  }

  get view(): InspectorView | undefined {
    const node = this.current;
    return node ? INSPECTOR_VIEWS[node.kind] : undefined;
  }

  inspect(inspection?: Inspection): void {
    this.workbench.update(this.workbench.activeId, { inspection });
  }
}

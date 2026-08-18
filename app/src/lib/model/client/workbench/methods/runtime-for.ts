import type { ResourceRuntime } from "$model/client/resource-runtimes";
import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { TabId } from "$model/client/workbench/types";

/**
 * The resource runtime for a tab, or `undefined` for a tab that is not a
 * resource.
 *
 * **The only way a view reaches one.** A view calling `attach` itself would tie
 * runtime lifetime to a component's mount, and the work surface remounts on
 * every tab switch — so the tab would lose its buffer and its undo stack each
 * time somebody looked at something else.
 *
 * This calls `attach`, which is idempotent, rather than looking a handle up. The
 * tab holds **no handle on its runtime, not even an id**: the key is the resource
 * identity the target already carries, and an allocated id would be a third name
 * for a thing that already has two.
 *
 * `undefined` for a non-resource tab rather than a throw. Every screen asks, and
 * a singleton asking is an ordinary answer rather than a defect — which is why
 * the callers optional-chain instead of guarding.
 */
export const runtimeFor = (
  state: WorkbenchState,
  id: TabId
): ResourceRuntime<unknown> | undefined => {
  const target = state.tabs.find((tab) => tab.id === id)?.target;
  if (target?.kind !== "resource") return undefined;

  return state.runtimes.attach(target.resourceType, target.resourceId);
};

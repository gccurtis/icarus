import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

/**
 * The open sheet's runtime, followed as the active tab changes.
 *
 * Every lens, context panel and control on this category needs the same one, and
 * reaching for it is a synchronization rather than a read: the register hands
 * out a runtime that outlives the component asking. One module holds that
 * arrangement so the components hold none of it.
 */
export const holdsTheRuntime = (): { readonly current: SpreadsheetRuntime | undefined } => {
  const view = workspaceState();
  let held = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    const resourceId = view.active.resourceId;
    held = resourceId === undefined ? undefined : view.spreadsheetRuntime(resourceId);
  });

  return {
    get current(): SpreadsheetRuntime | undefined {
      return held;
    }
  };
};

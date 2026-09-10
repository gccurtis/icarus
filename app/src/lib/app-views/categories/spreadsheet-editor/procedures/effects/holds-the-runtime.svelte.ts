import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

/**
 * The open sheet's already-owned runtime, fixed for this mounted tab.
 *
 * Every lens, context panel and control on this category needs the same one, and
 * the tab owns its lifetime before a surface is mounted. Capturing it once keeps
 * a retiring sheet surface from observing the next tab's resource id while
 * Svelte tears the old branch down.
 */
export const holdsTheRuntime = (): { readonly current: SpreadsheetRuntime | undefined } => {
  const view = workspaceState();
  const resourceId = view.active.resourceId;
  const held = resourceId === undefined ? undefined : view.spreadsheetRuntime(resourceId);

  return {
    get current(): SpreadsheetRuntime | undefined {
      return held;
    }
  };
};

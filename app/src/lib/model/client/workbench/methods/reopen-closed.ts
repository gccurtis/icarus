import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Tab } from "$model/client/workbench/types";

/**
 * Reopens the most recently closed tab, with everything it remembered.
 *
 * The queue holds whole tabs, so this restores zoom, find query, rail position
 * and panel widths — not just the target. Only the runtime is rebuilt, which is
 * why the resource case attaches again.
 *
 * The tab keeps the id it had. It left the strip when it was closed, so nothing
 * else can be holding that id, and reusing it means a surface that remembered
 * the tab across a close and reopen still points at the same thing.
 *
 * Returns `undefined` for an empty queue rather than throwing. The command that
 * calls this is bound to a chord a user can press at any time, and "nothing to
 * reopen" is an ordinary answer.
 */
export const reopenClosed = (state: WorkbenchState): Tab | undefined => {
  const [tab, ...rest] = state.closed;
  if (!tab) return undefined;

  state.closed = rest;
  state.tabs = [...state.tabs, tab];
  state.activeId = tab.id;

  if (tab.target.kind === "resource") {
    state.runtimes.attach(tab.target.resourceType, tab.target.resourceId);
  }

  return tab;
};

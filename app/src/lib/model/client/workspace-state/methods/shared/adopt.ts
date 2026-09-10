import { readWorkspaceState } from "$capabilities/workspace/index.remote";
import type { ReadWorkspaceStateResult } from "$capabilities/workspace/index.remote";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import {
  hasExactFields,
  isStoredNatural,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredWorkspaceBody } from "$representation/data/behavior/workspace/stored-rows";
import { reconcileRuntimes } from "$model/client/workspace-state/methods/shared/reconcile-runtimes";

type CurrentWorkspaceState = Exclude<ReadWorkspaceStateResult, null>;

/** Admit the capability response as exactly the one current workspace wire shape. */
const isCurrentWorkspaceState = (value: unknown): value is CurrentWorkspaceState => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(row, ["revision", "tabs", "activeId", "views"]) &&
    isStoredNatural(row.revision) &&
    isStoredWorkspaceBody({ tabs: row.tabs, activeId: row.activeId, views: row.views });
};

/**
 * Replace what is open with what the server holds.
 *
 * The read is the rebase: a workspace does not lag, so re-stating an op against
 * the state it was refused over means holding that state first.
 */
export const adopt = async (
  state: WorkspaceStateData,
  stillWanted: () => boolean = () => true
): Promise<boolean> => {
  const found = await readWorkspaceState();
  if (!stillWanted()) return false;
  if (found === null) return false;
  if (!isCurrentWorkspaceState(found)) {
    throw new Error("The server did not return one exact current workspace state");
  }

  for (const record of [...state.tabs.tabs]) {
    state.tabs.remove(record.id);
    state.views.forget(record.id);
  }

  for (const record of found.tabs) {
    state.views.set(record.id, found.views[record.id]);
    state.tabs.add(record);
  }

  state.tabs.activate(found.activeId);
  reconcileRuntimes(state);

  state.revision = found.revision;

  return true;
};

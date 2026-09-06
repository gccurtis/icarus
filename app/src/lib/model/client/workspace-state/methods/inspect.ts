import type { Inspected, Selection } from "$representation/data/types/workspace/tab";
import { isInspectorView } from "$representation/data/behavior/workspace/views";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

const canonicalSelection = (selection: Selection | null): Selection | null =>
  selection === null
    ? null
    : {
        kind: selection.kind,
        id: selection.id,
        ...(selection.at === undefined ? {} : { at: selection.at })
      };

export const inspect = (state: WorkspaceStateData, key: Inspected, selection?: Selection): void => {
  if (key !== "empty" && !isInspectorView(key)) {
    throw new Error(`'${key}' is not a lens`);
  }

  const id = state.tabs.activeId;
  const view = state.views.of(id);

  perform(state, {
    op: "inspect",
    tab: id,
    was: view.inspected,
    now: key,
    wasSelection: canonicalSelection(view.selection),
    selection: canonicalSelection(selection ?? view.selection)
  });
};

import type { Target } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { landOn } from "$model/client/workspace-state/methods/shared/land-on";
import { landing } from "$model/client/workspace-state/methods/shared/landing";
import { mintView } from "$model/client/workspace-state/methods/shared/mint-view";
import { perform } from "$model/client/workspace-state/methods/shared/perform";
import { targetKey } from "$model/client/workspace-state/methods/shared/target-key";
import type { Tab } from "$model/client/workspace-state/types";

export const open = (state: WorkspaceStateData, target: Target): Tab => {
  const key = targetKey(target);
  const existing =
    key === undefined ? undefined : state.tabs.tabs.find((record) => targetKey(record) === key);

  if (existing) {
    if (state.tabs.activeId !== existing.id) {
      perform(state, { op: "activate", was: state.tabs.activeId, now: existing.id });
    }

    if (target.content !== undefined) {
      landOn(state, existing, target.content, target.focus);
    } else if (target.focus !== undefined) {
      const was = landing(state.views.of(existing.id));
      perform(state, { op: "land", tab: existing.id, was, now: { ...was, focus: target.focus } });
    }

    return state.compose(existing.id);
  }

  const record = state.tabs.mint(target);
  const was = state.tabs.activeId;

  perform(state, {
    op: "open",
    tab: record.id,
    at: state.tabs.tabs.length,
    target: { category: record.category, resourceId: record.resourceId },
    view: mintView(target)
  });
  perform(state, { op: "activate", was, now: record.id });

  return state.compose(record.id);
};

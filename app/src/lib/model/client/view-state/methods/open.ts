import type { Target } from "$representation/data/types/views/tab";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { landOn } from "$model/client/view-state/methods/shared/land-on";
import { landing } from "$model/client/view-state/methods/shared/landing";
import { mintView } from "$model/client/view-state/methods/shared/mint-view";
import { perform } from "$model/client/view-state/methods/shared/perform";
import { targetKey } from "$model/client/view-state/methods/shared/target-key";
import type { Tab } from "$model/client/view-state/types";

export const open = (state: ViewStateData, target: Target): Tab => {
  const key = targetKey(target);
  const existing =
    key === undefined ? undefined : state.tabs.tabs.find((record) => targetKey(record) === key);

  if (existing) {
    if (state.tabs.activeId !== existing.id) {
      perform(state, { op: "activate", was: state.tabs.activeId, now: existing.id });
    }

    if (target.subscreen !== undefined) {
      landOn(state, existing, target.subscreen, target.focus);
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
    target: { screen: record.screen, resourceId: record.resourceId },
    view: mintView(target)
  });
  perform(state, { op: "activate", was, now: record.id });

  return state.compose(record.id);
};

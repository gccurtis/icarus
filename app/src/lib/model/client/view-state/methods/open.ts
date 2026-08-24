import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { mintTab } from "$model/client/view-state/methods/shared/mint-tab";
import { landOn } from "$model/client/view-state/methods/shared/land-on";
import { targetKey } from "$model/client/view-state/methods/shared/target-key";
import type { Tab, Target } from "$model/client/view-state/types";

/**
 * Open a target, or activate the tab already on it.
 *
 * **It returns the existing tab rather than a new one**, which is what makes
 * opening idempotent for everything with an identity: a document reached from a
 * mention, from the work table and from a search is one tab, in the state the
 * person left it.
 *
 * A launcher has no identity, so `targetKey` gives `undefined` and this falls
 * through to minting every time.
 *
 * **A target that names a centre gets it, open or not.** Choosing a persona from
 * the Overview means the Agents tab lands on that persona — activating the tab
 * and leaving it wherever it was last would ignore half of what was asked for.
 * It routes through `landOn` rather than assigning, so the rail follows and the
 * stale inspection clears exactly as it does when a person switches by hand.
 */
export const open = (state: ViewStateData, target: Target): Tab => {
  const key = targetKey(target);
  const existing =
    key === undefined ? undefined : state.tabs.find((tab) => targetKey(tab) === key);

  if (existing) {
    state.activeId = existing.id;
    if (target.subscreen !== undefined) landOn(existing, target.subscreen, target.focus);
    else if (target.focus !== undefined) existing.focus = target.focus;
    return existing;
  }

  const tab = mintTab(state.nextId(), target);
  state.tabs.push(tab);
  state.activeId = tab.id;

  // Read back rather than returning what was pushed. `tabs` is `$state`, so in
  // the browser the array stores a deep proxy and Svelte's proxy never writes
  // through to its target — a caller holding the minted object would read a
  // snapshot frozen at mint, while the same call for an already-open tab hands
  // back the live one. Two shapes for one return value is the bug; this is one.
  return state.tabs[state.tabs.length - 1];
};

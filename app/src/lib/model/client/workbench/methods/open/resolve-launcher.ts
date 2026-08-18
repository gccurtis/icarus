import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Tab, TabTarget } from "$model/client/workbench/types";
import { adoptTarget } from "$model/client/workbench/methods/shared/adopt-target";
import { targetKey } from "$model/client/workbench/methods/shared/target-key";

/**
 * Turns a launcher into the thing it created.
 *
 * Two outcomes, and which one happens is decided by whether the target is
 * already open somewhere else.
 *
 * **Not open — the launcher becomes it, in place.** Same `TabId`, same slot in
 * the strip. That is the point: a user who typed into the launcher and picked a
 * document watches that tab turn into the document, rather than watching a tab
 * vanish and another appear at the far end of the strip.
 *
 * **Already open — the launcher closes and the existing tab activates.** The
 * alternative is two tabs on one document, which is the one thing `targetKey`
 * exists to prevent, and a launcher is the cheaper of the two to lose.
 *
 * A launcher resolving to another launcher is refused. It has no identity, so
 * "becoming one" is not a transition — it is the state it is already in.
 */
export const resolveLauncher = (state: WorkbenchState, id: string, target: TabTarget): Tab => {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    throw new Error(`Tab ${id} does not exist.`);
  }
  if (state.tabs[index].target.kind !== "launcher") {
    throw new Error(`Tab ${id} is not a launcher.`);
  }
  if (target.kind === "launcher") {
    throw new Error("A launcher cannot resolve to another launcher.");
  }

  const key = targetKey(target);
  const existing = state.tabs.find((tab) => tab.id !== id && targetKey(tab.target) === key);

  if (existing) {
    state.tabs = state.tabs.filter((tab) => tab.id !== id);
    state.activeId = existing.id;
    return existing;
  }

  // Minted rather than patched, so the view state arm matches the new screen
  // kind. Carrying the launcher's own arm across would leave a document tab
  // holding a `query` field and no `zoom`.
  const resolved: Tab = { ...adoptTarget(state, target), id };

  state.tabs = state.tabs.map((tab) => (tab.id === id ? resolved : tab));
  state.activeId = id;

  if (target.kind === "resource") {
    state.runtimes.attach(target.resourceType, target.resourceId);
  }

  return resolved;
};

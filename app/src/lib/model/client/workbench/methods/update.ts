import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { ScreenKind, TabId, ViewStatePatch } from "$model/client/workbench/types";
import { assignState } from "$model/client/workbench/methods/shared/assign-state";

/**
 * Patches one screen's own view state.
 *
 * **The kind is restated by the caller, and that is the whole design of this
 * signature.** A patch against an eleven-arm union cannot be narrowed from the
 * patch itself — `{ zoom: 2 }` is assignable to three arms — so without it the
 * only way to write is a cast, which is exactly how a document's `zoom` ends up
 * on a persona library.
 *
 * Restating it makes the narrowing sound at compile time, and turns a caller
 * that gets it wrong into a thrown error rather than a corrupted tab.
 *
 * `frame` is unreachable from here, structurally. A screen changes its own
 * state; the shell's geometry is `resize`'s and the rail is `selectContext`'s,
 * so no screen can move a panel by patching what it thought was its own.
 */
export const update = <K extends ScreenKind>(
  state: WorkbenchState,
  id: TabId,
  kind: K,
  patch: ViewStatePatch<K>
): void => {
  assignState(state, id, (tab) => {
    if (tab.viewState.kind !== kind) {
      throw new Error(`Tab ${id} shows ${tab.viewState.kind}, not ${kind}.`);
    }

    Object.assign(tab.viewState, patch);
  });
};

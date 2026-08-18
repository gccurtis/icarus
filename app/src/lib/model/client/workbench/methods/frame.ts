import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Frame } from "$model/client/workbench/types";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";

/**
 * The active tab's frame.
 *
 * Every member is present from the moment a tab is minted, so there is no read
 * path here that reports a default it never stored — the only optional member is
 * `contextId`, and absent genuinely means "the panel's default" rather than a
 * value this object failed to keep.
 *
 * Returned by reference rather than copied. The shell reads it on every frame
 * during a drag, and a copy per read would allocate a `Frame` per pointer move
 * for no isolation worth having: the type hands out no writer, and `resize` is
 * the only thing that assigns.
 */
export const frame = (state: WorkbenchState): Frame => activeTab(state).viewState.frame;

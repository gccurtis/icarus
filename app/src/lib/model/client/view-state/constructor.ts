import { ViewState } from "$model/client/view-state/definition.svelte";
import type { ViewStateModel } from "$model/client/view-state/types";

/**
 * Returns a fresh view state, with its seven permanent tabs already open.
 *
 * **It borrows nothing.** What is open and what is being looked at is decided by
 * the person, not by anything else in the graph — which is why this takes only
 * the project and why it can be built first. The copilot borrows *this*, not the
 * other way round.
 *
 * **It holds nothing releasable**, so a teardown passes it by. What is open is
 * not a resource; the resource runtimes behind a tab are, and they are a
 * different object with a different lifetime.
 */
export const createViewState = (project: string): ViewStateModel => new ViewState(project);

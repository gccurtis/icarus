import { normalize } from "$shared/types/resource-set-expression";
import type { Selector } from "$shared/types/resource-set-expression";
import type { CopilotState } from "$model/client/copilot/definition.svelte";
import { sameSelector } from "$model/client/copilot/methods/shared/same-selector";

/**
 * Removes a selector from wherever it is, saying nothing in its place.
 *
 * The third state, and the reason `include` and `exclude` are not enough on
 * their own: dropping a document from an explicit include leaves it unmentioned,
 * where excluding it states that it must not be used. Those differ the moment a
 * broader selector is also present.
 *
 * A selector that is in neither list is a no-op. The chip the user clicked is
 * gone either way, which is the outcome they asked for.
 */
export const dropSelector = (state: CopilotState, selector: Selector): void => {
  state.scope = normalize({
    include: state.scope.include.filter((other) => !sameSelector(other, selector)),
    exclude: state.scope.exclude.filter((other) => !sameSelector(other, selector))
  });
};

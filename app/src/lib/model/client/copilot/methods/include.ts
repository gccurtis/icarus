import { normalize } from "$shared/types/resource-set-expression";
import type { Selector } from "$shared/types/resource-set-expression";
import type { CopilotState } from "$model/client/copilot/definition.svelte";
import { sameSelector } from "$model/client/copilot/methods/shared/same-selector";

/**
 * Adds a selector to what the response may draw on.
 *
 * **It leaves the exclude list first.** A selector is in `include`, in
 * `exclude`, or in neither — never both — and normalization resolves a conflict
 * by dropping the include, so adding one without removing it from `exclude`
 * would look like a no-op to the user.
 *
 * Normalized on write, so one set has one representation and two scopes can be
 * compared. `shared` owns those rules: duplicates collapse, a broader selector
 * absorbs the ones it covers, and `part` and `web` are exempt from absorption
 * because they are different mechanisms rather than narrower statements of
 * membership.
 */
export const include = (state: CopilotState, selector: Selector): void => {
  state.scope = normalize({
    include: [...state.scope.include, selector],
    exclude: state.scope.exclude.filter((other) => !sameSelector(other, selector))
  });
};

import { normalize } from "$shared/types/resource-set-expression";
import type { Selector } from "$shared/types/resource-set-expression";
import type { CopilotState } from "$model/client/copilot/definition.svelte";
import { sameSelector } from "$model/client/copilot/methods/shared/same-selector";

/**
 * Takes a selector out of what the response may draw on.
 *
 * The mirror of `include`, and it leaves the include list for the same reason:
 * a selector is in one list, the other, or neither.
 *
 * **Excluding is not the same as dropping.** A `project` include with a document
 * excluded is a scope; dropping the document from the include list instead would
 * leave the project selector still covering it. That is why there are three
 * writers rather than two.
 */
export const exclude = (state: CopilotState, selector: Selector): void => {
  state.scope = normalize({
    include: state.scope.include.filter((other) => !sameSelector(other, selector)),
    exclude: [...state.scope.exclude, selector]
  });
};

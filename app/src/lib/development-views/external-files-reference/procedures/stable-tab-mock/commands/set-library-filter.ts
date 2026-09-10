import type { MockSemanticFilter } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

type LibraryFilterChange =
  | { readonly kind: "query"; readonly value: string }
  | { readonly kind: "semantic"; readonly value: MockSemanticFilter };

export const setMockLibraryFilter = (
  state: StableTabMockState,
  change: LibraryFilterChange
): void => {
  if (change.kind === "query") {
    state.query = change.value;
    return;
  }
  state.semanticFilter = change.value;
};

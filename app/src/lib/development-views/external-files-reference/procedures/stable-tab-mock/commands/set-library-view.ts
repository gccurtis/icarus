import type { MockLibraryView } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const setMockLibraryView = (
  state: StableTabMockState,
  view: MockLibraryView
): void => {
  state.libraryView = view;
};

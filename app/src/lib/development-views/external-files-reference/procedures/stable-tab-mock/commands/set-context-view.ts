import type { MockContextView } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const setMockContextView = (
  state: StableTabMockState,
  view: MockContextView
): void => {
  state.contextView = view;
};

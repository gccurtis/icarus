import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const cancelMockFileEdit = (state: StableTabMockState): void => {
  state.editing = undefined;
};

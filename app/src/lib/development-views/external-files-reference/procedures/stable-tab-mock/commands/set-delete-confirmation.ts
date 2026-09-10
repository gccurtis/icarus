import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const setMockDeleteConfirmation = (
  state: StableTabMockState,
  confirming: boolean
): void => {
  state.confirmingDelete = confirming;
};

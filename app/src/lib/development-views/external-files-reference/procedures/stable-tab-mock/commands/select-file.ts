import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const selectMockFile = (state: StableTabMockState, id: string): void => {
  state.selectedId = id;
  state.selectedDirectory = undefined;
  state.editing = undefined;
  state.confirmingDelete = false;
  state.notice = undefined;
};

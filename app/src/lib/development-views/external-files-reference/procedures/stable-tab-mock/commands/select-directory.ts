import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const selectMockDirectory = (
  state: StableTabMockState,
  path: string
): void => {
  state.selectedDirectory = path;
  state.selectedId = "";
  state.editing = undefined;
  state.confirmingDelete = false;
  state.notice = undefined;
};

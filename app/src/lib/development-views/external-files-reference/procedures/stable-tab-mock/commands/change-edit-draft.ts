import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export const changeMockEditDraft = (
  state: StableTabMockState,
  draft: string
): void => {
  state.editDraft = draft;
};

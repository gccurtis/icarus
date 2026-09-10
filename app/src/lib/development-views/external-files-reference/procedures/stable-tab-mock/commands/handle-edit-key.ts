import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";
import { cancelMockFileEdit } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/cancel-edit";
import { saveMockFileEdit } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/save-edit";

export const handleMockEditKey = (
  state: StableTabMockState,
  key: string
): void => {
  if (key === "Enter") saveMockFileEdit(state);
  if (key === "Escape") cancelMockFileEdit(state);
};

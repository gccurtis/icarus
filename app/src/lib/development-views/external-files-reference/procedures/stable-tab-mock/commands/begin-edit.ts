import type { MockEditField } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";
import {
  mockFileName,
  mockFilePath,
  selectedMockFile
} from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

export const beginMockFileEdit = (
  state: StableTabMockState,
  field: MockEditField
): void => {
  const selected = selectedMockFile(state);
  if (selected === undefined) return;
  state.editing = field;
  state.editDraft = field === "name"
    ? mockFileName(state, selected)
    : mockFilePath(state, selected);
  state.confirmingDelete = false;
};

import { MOCK_EXTERNAL_FILES } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";
import {
  mockFileName,
  selectedMockFile
} from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

export const removeMockFile = (state: StableTabMockState): void => {
  const selected = selectedMockFile(state);
  if (selected === undefined) return;
  const removed = mockFileName(state, selected);
  state.history = [`Deleted ${removed} · just now`, ...state.history];
  state.deletedIds = [...state.deletedIds, selected.id];
  const next = MOCK_EXTERNAL_FILES.find((file) => !state.deletedIds.includes(file.id));
  state.selectedId = next?.id ?? "";
  state.confirmingDelete = false;
  state.notice = `${removed} removed; its History entry remains.`;
};

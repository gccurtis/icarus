import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";
import {
  mockFileName,
  selectedMockFile
} from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

export const reuploadMockFile = (state: StableTabMockState): void => {
  const selected = selectedMockFile(state);
  if (selected === undefined) return;
  state.history = [`Re-uploaded ${mockFileName(state, selected)} · just now`, ...state.history];
  state.notice = "Replacement bytes accepted as the next revision of the same External file.";
};

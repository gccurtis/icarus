import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";
import {
  mockFileName,
  mockFilePath,
  selectedMockFile
} from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

export const saveMockFileEdit = (state: StableTabMockState): void => {
  const selected = selectedMockFile(state);
  if (selected === undefined || state.editing === undefined || state.editDraft.trim() === "") {
    return;
  }

  const next = state.editDraft.trim();
  if (state.editing === "name") {
    state.displayNames = { ...state.displayNames, [selected.id]: next };
    const segments = mockFilePath(state, selected).split("/");
    segments[segments.length - 1] = next;
    state.displayPaths = { ...state.displayPaths, [selected.id]: segments.join("/") };
    state.history = [`Renamed ${selected.originalName} · just now`, ...state.history];
    state.notice = "Local name and path leaf updated; original upload name and bytes are unchanged.";
  } else {
    state.displayPaths = { ...state.displayPaths, [selected.id]: next };
    state.displayNames = {
      ...state.displayNames,
      [selected.id]: next.split("/").at(-1) ?? mockFileName(state, selected)
    };
    state.history = [`Moved ${mockFileName(state, selected)} · just now`, ...state.history];
    state.notice = "Project path updated; native bytes stayed content-addressed.";
  }
  state.editing = undefined;
};

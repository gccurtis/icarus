import {
  MOCK_EXTERNAL_FILES,
  type MockExternalFile
} from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

export type MockDirectory = { readonly path: string; readonly files: number };

export const mockFileName = (
  state: StableTabMockState,
  file: MockExternalFile
): string => state.displayNames[file.id] ?? file.originalName;

export const mockFilePath = (
  state: StableTabMockState,
  file: MockExternalFile
): string => state.displayPaths[file.id] ?? file.path;

export const availableMockFiles = (
  state: StableTabMockState
): readonly MockExternalFile[] =>
  MOCK_EXTERNAL_FILES.filter((file) => !state.deletedIds.includes(file.id));

export const selectedMockFile = (
  state: StableTabMockState
): MockExternalFile | undefined =>
  availableMockFiles(state).find((file) => file.id === state.selectedId);

export const visibleMockFiles = (
  state: StableTabMockState
): readonly MockExternalFile[] => {
  const query = state.query.trim().toLocaleLowerCase();
  return availableMockFiles(state).filter((file) => {
    if (state.semanticFilter !== "all" && file.semanticTone !== state.semanticFilter) {
      return false;
    }
    return query === "" ||
      `${mockFileName(state, file)} ${mockFilePath(state, file)} ${file.type} ${file.semantic}`
        .toLocaleLowerCase()
        .includes(query);
  });
};

export const mockDirectories = (state: StableTabMockState): readonly MockDirectory[] => [
  {
    path: "imports",
    files: availableMockFiles(state)
      .filter((file) => mockFilePath(state, file).startsWith("imports/")).length
  },
  {
    path: "legal",
    files: availableMockFiles(state)
      .filter((file) => mockFilePath(state, file).startsWith("legal/")).length
  },
  {
    path: "research",
    files: availableMockFiles(state)
      .filter((file) => mockFilePath(state, file).startsWith("research/")).length
  }
].filter((directory) => directory.files > 0);

import {
  INITIAL_MOCK_HISTORY,
  MOCK_EXTERNAL_FILES,
  type MockContextView,
  type MockEditField,
  type MockLibraryView,
  type MockSemanticFilter
} from "$development-views/external-files-reference/procedures/stable-tab-mock/data";

/** Instance-owned state for one interactive External reference specimen. */
export class StableTabMockState {
  contextView = $state<MockContextView>("overview");
  libraryView = $state<MockLibraryView>("table");
  selectedId = $state<string>(MOCK_EXTERNAL_FILES[0].id);
  selectedDirectory = $state<string>();
  query = $state("");
  semanticFilter = $state<MockSemanticFilter>("all");
  displayNames = $state<Record<string, string>>({});
  displayPaths = $state<Record<string, string>>({});
  deletedIds = $state<string[]>([]);
  editing = $state<MockEditField>();
  editDraft = $state("");
  confirmingDelete = $state(false);
  notice = $state<string>();
  history = $state([...INITIAL_MOCK_HISTORY]);
}

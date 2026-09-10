import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type {
  ExternalFileInspectorState,
  FileInspectorCommand
} from "$app-views/categories/external/inspector/file.state.svelte";

export const runFileInspectorCommand = async <T>(
  state: ExternalFileInspectorState,
  view: WorkspaceStateModel,
  externalFileId: string,
  kind: FileInspectorCommand,
  perform: () => Promise<T>,
  accept: (result: T) => void
): Promise<void> => {
  const tabId = view.activeId;
  const command = {};
  state.activeCommand = command;
  state.pending = kind;
  try {
    const result = await perform();
    const stillInspecting = state.mounted && state.activeCommand === command &&
      view.activeId === tabId && view.selection?.kind === "external-file" &&
      view.selection.id === externalFileId;
    if (stillInspecting) accept(result);
  } catch (error) {
    if (state.activeCommand === command && state.mounted && view.activeId === tabId &&
      view.selection?.kind === "external-file" && view.selection.id === externalFileId) {
      state.actionError = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (state.activeCommand === command) {
      state.activeCommand = undefined;
      state.pending = undefined;
    }
  }
};

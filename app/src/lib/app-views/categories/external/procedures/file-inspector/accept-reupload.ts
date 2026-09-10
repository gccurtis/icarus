import type { ReuploadExternalFileResult } from "$capabilities/external-files/index.remote";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";

export const acceptFileReupload = (
  state: ExternalFileInspectorState,
  result: ReuploadExternalFileResult
): void => {
  if (result === state.handledReupload) return;
  state.handledReupload = result;
  if (result.externalFileId !== state.activeId) return;
  if (!result.accepted) {
    state.actionNotice = undefined;
    state.actionError = result.detail;
    return;
  }
  state.actionError = undefined;
  state.actionNotice = `Re-uploaded ${result.size.toLocaleString()} bytes as revision ${result.revision}.`;
};

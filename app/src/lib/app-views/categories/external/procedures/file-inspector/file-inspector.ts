import { askToDeleteFile } from "$app-views/categories/external/procedures/file-inspector/ask-delete";
import { cancelFileEdit } from "$app-views/categories/external/procedures/file-inspector/cancel-edit";
import { chooseFileReplacement } from "$app-views/categories/external/procedures/file-inspector/choose-replacement";
import { commitFileName } from "$app-views/categories/external/procedures/file-inspector/commit-name";
import { commitFilePath } from "$app-views/categories/external/procedures/file-inspector/commit-path";
import { fileEditKeydown } from "$app-views/categories/external/procedures/file-inspector/edit-keydown";
import { fileInspectorIsBusy } from "$app-views/categories/external/procedures/file-inspector/is-busy";
import { removeInspectedFile } from "$app-views/categories/external/procedures/file-inspector/remove";
import { saveFileContext } from "$app-views/categories/external/procedures/file-inspector/save-context";
import { startFileEdit } from "$app-views/categories/external/procedures/file-inspector/start-edit";

/** Named command surface consumed by the External file inspector view. */
export const fileInspector = {
  askToDelete: askToDeleteFile,
  cancelEdit: cancelFileEdit,
  chooseReplacement: chooseFileReplacement,
  commitName: commitFileName,
  commitPath: commitFilePath,
  editKeydown: fileEditKeydown,
  isBusy: fileInspectorIsBusy,
  remove: removeInspectedFile,
  saveContext: saveFileContext,
  startEdit: startFileEdit
} as const;

import { cancelDirectoryEdit } from "$app-views/categories/external/procedures/directory-inspector/cancel-edit";
import { commitDirectoryEdit } from "$app-views/categories/external/procedures/directory-inspector/commit";
import { directoryEditKeydown } from "$app-views/categories/external/procedures/directory-inspector/edit-keydown";
import { startDirectoryEdit } from "$app-views/categories/external/procedures/directory-inspector/start-edit";

/** Named command surface consumed by the External directory inspector view. */
export const directoryInspector = {
  cancel: cancelDirectoryEdit,
  commit: commitDirectoryEdit,
  keydown: directoryEditKeydown,
  start: startDirectoryEdit
} as const;

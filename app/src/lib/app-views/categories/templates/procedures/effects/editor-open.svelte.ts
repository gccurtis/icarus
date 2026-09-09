import { onDestroy } from "svelte";

import type { EditorOpenState } from "$app-views/categories/templates/content/editor.state.svelte";
import type { LibraryTemplate } from "$app-views/categories/templates/procedures/library.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const synchronizeEditorOpen = ({
  state,
  view,
  row
}: {
  state: EditorOpenState;
  view: WorkspaceStateModel;
  row: () => LibraryTemplate | undefined;
}): void => {
  $effect(() => {
    const current = row();
    if (current !== undefined) state.open(view, current);
  });
  onDestroy(() => state.dispose());
};

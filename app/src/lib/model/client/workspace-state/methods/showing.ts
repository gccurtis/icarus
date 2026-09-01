import type { Category, Subscreen } from "$representation/data/types/workspace/categories";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const showing = (state: WorkspaceStateData, category: Category, subscreen?: Subscreen): boolean => {
  const record = state.tabs.active;
  return (
    record.category === category &&
    (subscreen === undefined || state.views.of(record.id).subscreen === subscreen)
  );
};

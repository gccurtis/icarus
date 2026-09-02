import type { Category, ContentView } from "$representation/data/types/workspace/categories";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const showing = (state: WorkspaceStateData, category: Category, content?: ContentView): boolean => {
  const record = state.tabs.active;
  return (
    record.category === category &&
    (content === undefined || state.views.of(record.id).content === content)
  );
};

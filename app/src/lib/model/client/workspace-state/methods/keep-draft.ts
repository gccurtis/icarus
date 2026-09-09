import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const keepDraft = (state: WorkspaceStateData, key: string, text: string): void => {
  if (text === "") state.drafts.delete(key);
  else state.drafts.set(key, text);
};

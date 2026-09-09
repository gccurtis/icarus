import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const draft = (state: WorkspaceStateData, key: string): string =>
  state.drafts.get(key) ?? "";

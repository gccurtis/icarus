import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { submit } from "$model/client/workspace-state/methods/shared/submit";

export const flush = (state: WorkspaceStateData): Promise<void> => submit(state);

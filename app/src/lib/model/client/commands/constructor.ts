import { Commands } from "$model/client/commands/definition.svelte";
import type { CommandsModel } from "$model/client/commands/types";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const createCommands = (view: WorkspaceStateModel): CommandsModel => new Commands(view);

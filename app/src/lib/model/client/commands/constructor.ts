import { Commands } from "$model/client/commands/definition.svelte";
import type { CommandsModel } from "$model/client/commands/types";
import type { ViewStateModel } from "$model/client/view-state";

export const createCommands = (view: ViewStateModel): CommandsModel => new Commands(view);

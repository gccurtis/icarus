import { Commands } from "$model/client/commands/definition.svelte";
import type { CommandsModel } from "$model/client/commands/types";
import type { WorkbenchModel } from "$model/client/workbench";

/**
 * Returns a fresh Commands.
 *
 * Every call returns a new object, and nothing here caches one: `buildClientModel`
 * calls this once and the environment root holds what it gets. That is what keeps
 * one client instance to one graph — and what lets a test build two and prove
 * they share nothing.
 *
 * Dependencies are BORROWED: the root constructed them and the root releases
 * them, so this object must never close one.
 */
export const createCommands = (workbench: WorkbenchModel): CommandsModel => new Commands(workbench);

import type { ClientStorage } from "$model/client/storage";
import { Workbench } from "$model/client/workbench/definition.svelte";
import type { WorkbenchModel } from "$model/client/workbench/types";

/**
 * Builds one, over any storage. Every call returns a fresh workbench with its
 * own id counter, which is what lets a test prove two share nothing.
 *
 * Storage is BORROWED: the environment root constructed it and nothing here
 * releases it.
 */
export const createWorkbench = (over: ClientStorage): WorkbenchModel => new Workbench(over);

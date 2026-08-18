import type { ResourceRuntimesModel } from "$model/client/resource-runtimes";
import { Workbench } from "$model/client/workbench/definition.svelte";
import type { WorkbenchModel } from "$model/client/workbench/types";

/**
 * Returns a fresh workbench, with its singletons already open.
 *
 * The register is BORROWED: the root constructed it and the root owns it. The
 * workbench calls `attach` when a resource tab opens and `release` when one
 * closes, but it never disposes the register itself — `ClientModel.close()` does
 * that, after calling `closeAll` here so the tabs hand their runtimes back
 * first.
 *
 * **No storage.** The workbench does not persist yet: what a stored tab should
 * carry is a question about a shape that has just changed completely, and
 * writing one before the screens exist would mean versioning a guess. Until it
 * returns, a reload opens on the singletons.
 */
export const createWorkbench = (runtimes: ResourceRuntimesModel): WorkbenchModel =>
  new Workbench(runtimes);

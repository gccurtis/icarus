import { Copilot } from "$model/client/copilot/definition.svelte";
import type { CopilotModel } from "$model/client/copilot/types";
import type { WorkbenchModel } from "$model/client/workbench";

/**
 * Returns a fresh copilot.
 *
 * The workbench is BORROWED: the root constructed it and the root owns it. The
 * copilot is built after it, because the inspector's scope editor resolves the
 * active tab's resource and selection into selectors through it.
 *
 * **It holds nothing releasable**, so `ClientModel.close()` passes it by. An
 * unsent message does not outlive the session and is not meant to — a
 * half-composed message that survived the browser would be one the user can
 * neither see nor has chosen to keep.
 */
export const createCopilot = (workbench: WorkbenchModel): CopilotModel => new Copilot(workbench);

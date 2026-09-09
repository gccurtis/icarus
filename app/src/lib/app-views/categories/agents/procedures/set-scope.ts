import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

import type { Owner } from "$app-views/categories/agents/procedures/agents";
import { updateAutomation } from "$app-views/categories/agents/procedures/update-automation";
import { updatePersona } from "$app-views/categories/agents/procedures/update-persona";
import { updateTask } from "$app-views/categories/agents/procedures/update-task";

/** One scope editor, three rows it can be editing. `null` means inherited. */
export const setScope = (view: WorkspaceStateModel, owner: Owner, scope: ResourceSet | null) =>
  owner.kind === "persona"
    ? updatePersona(view, owner, { scope })
    : owner.kind === "task"
      ? updateTask(view, owner, { scope })
      : updateAutomation(view, owner, { scope });

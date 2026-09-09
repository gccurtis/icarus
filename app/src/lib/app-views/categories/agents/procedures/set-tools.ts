import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ToolId } from "$representation/data/types/agents/tool";

import type { Owner } from "$app-views/categories/agents/procedures/agents";
import { updateAutomation } from "$app-views/categories/agents/procedures/update-automation";
import { updatePersona } from "$app-views/categories/agents/procedures/update-persona";
import { updateTask } from "$app-views/categories/agents/procedures/update-task";

/** One grant editor, three rows it can be editing. */
export const setTools = (
  view: WorkspaceStateModel,
  owner: Owner,
  tools: readonly ToolId[]
) =>
  owner.kind === "persona"
    ? updatePersona(view, owner, { tools })
    : owner.kind === "task"
      ? updateTask(view, owner, { tools })
      : updateAutomation(view, owner, { tools });

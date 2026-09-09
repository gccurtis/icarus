import { readTask, sendTaskMessage as sendTaskMessageRemote } from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

export const sendTaskMessage = (view: WorkspaceStateModel, taskId: string, text: string) =>
  view.singleFlight(flightKey(view, "send-task-message", taskId, text), () =>
    sendTaskMessageRemote({ taskId, text }).updates(readTask({ taskId }))
  );

import { createChat as createChatRemote, readAgentsLibrary } from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

/** Opens a chat that answers as one persona. Two presses are two chats. */
export const createChat = (view: WorkspaceStateModel, personaId: string) =>
  view.singleFlight(flightKey(view, "create-chat", personaId, Date.now()), () =>
    createChatRemote({ personaId }).updates(readAgentsLibrary)
  );

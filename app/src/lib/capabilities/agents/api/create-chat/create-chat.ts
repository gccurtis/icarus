import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateCreateChat } from "$capabilities/agents/api/create-chat/validate-create-chat";
import { findVisible, notFound, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { openThread } from "$capabilities/agents/api/shared/threads";
import type { CreateChatResult } from "$capabilities/agents/types/agents";

export const createChat = async (input: unknown): Promise<CreateChatResult> => {
  const scope = await requireScope();
  const asked = validateCreateChat(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "personas", asked.personaId);
  if (found.kind !== "found") return notFound(asked.personaId, "persona");
  const persona = found.row;

  const at = Date.now();
  const chatId = store.transaction((unit) => {
    const threadId = openThread(unit, scope.projectId, "researchThread", at);
    const fields: RowFields<"researchThreads"> = {
      projectId: asId<"projects">(scope.projectId),
      threadId,
      personaId: persona._id,
      title: asked.title ?? `Chat with ${persona.name}`,
      mode: { kind: "explore" },
      findingIds: [],
      createdBy: viewer(scope),
      updatedAt: at
    };
    return unit.create("researchThreads", fields);
  });
  return { accepted: true, id: persona._id, chatId, revision: 1 };
};

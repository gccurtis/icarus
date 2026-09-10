import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import {
  ConversationAggregateError,
  conversationAggregate
} from "$representation/data/behavior/agents/conversation";
import { isStoredResearchThread } from "$representation/data/behavior/investigation/stored-rows";
import type { Message } from "$representation/data/types/agents/message";
import type { Id } from "$representation/data/types/core/id";

import { rowsIn } from "$capabilities/research-chat/api/shared/store";

const fail = (): never => {
  throw new ConversationAggregateError(
    "The Research conversation is not one exact current aggregate in the authorized project"
  );
};

/** Prove the Research row, generic thread, and every part as one owned aggregate. */
export const researchConversationIn = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  researchThread: TableRow<"researchThreads">
) => {
  if (!isStoredResearchThread(researchThread) || researchThread.projectId !== projectId) fail();
  const conversation = conversationAggregate(
    rowsIn(store, "threads"),
    rowsIn(store, "threadParts"),
    projectId,
    researchThread.threadId,
    "researchThread"
  );
  return { researchThread, ...conversation };
};

/** Append only after resolving the exact target part inside the caller's transaction. */
export const appendResearchMessage = (
  unit: StoreUnitOfWork,
  projectId: Id<"projects">,
  researchThread: TableRow<"researchThreads">,
  message: Message
): void => {
  const { parts } = researchConversationIn(unit, projectId, researchThread);
  const last = parts[parts.length - 1];
  if (last === undefined) fail();
  unit.update(`threadParts.${last._id}.messages`, [...last.messages, message]);
};

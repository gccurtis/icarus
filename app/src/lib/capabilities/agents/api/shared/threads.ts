import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { Message, MessageRole } from "$representation/data/types/agents/message";
import type { ThreadKind } from "$representation/data/types/agents/thread";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { messageText, textMessage } from "$representation/data/behavior/agents/messages";
import { conversationAggregate } from "$representation/data/behavior/agents/conversation";

import { rowsIn, uniqueId } from "$capabilities/agents/api/shared/store";

const aggregateOf = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  threadId: Id<"threads">,
  expectedKind: ThreadKind
) => conversationAggregate(
  rowsIn(store, "threads"),
  rowsIn(store, "threadParts"),
  projectId,
  threadId,
  expectedKind
);

export const messagesOf = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  threadId: Id<"threads">,
  expectedKind: ThreadKind
): readonly Message[] =>
  aggregateOf(store, projectId, threadId, expectedKind).parts.flatMap((part) => part.messages);

export const lastLineOf = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  threadId: Id<"threads">,
  expectedKind: ThreadKind
): string | null => {
  const messages = messagesOf(store, projectId, threadId, expectedKind);
  const last = messages[messages.length - 1];
  if (last === undefined) return null;
  const text = messageText(last);
  return text.length === 0 ? null : text;
};

export const openThread = (
  store: StoreUnitOfWork,
  projectId: string,
  kind: ThreadKind,
  at: number,
  opening?: { readonly role: MessageRole; readonly author: Actor; readonly text: string }
): Id<"threads"> => {
  const threadId = store.create("threads", { projectId, kind });
  const messages: Message[] =
    opening === undefined
      ? []
      : [textMessage(`m-${uniqueId()}`, opening.role, opening.author, at, opening.text)];
  store.create("threadParts", { projectId, threadId, part: 1, messages });
  return threadId;
};

export const appendMessage = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  threadId: Id<"threads">,
  expectedKind: ThreadKind,
  role: MessageRole,
  author: Actor,
  at: number,
  text: string,
  attachments: readonly ResourceRef[] = []
): Message => {
  const written = textMessage(`m-${uniqueId()}`, role, author, at, text);
  const message: Message = attachments.length === 0
    ? written
    : { ...written, attachments: [...attachments] };
  const parts = aggregateOf(store, projectId, threadId, expectedKind).parts;
  const last: TableRow<"threadParts"> | undefined = parts[parts.length - 1];
  if (last === undefined) throw new Error("The conversation has no current message part");
  store.update(`threadParts.${last._id}.messages`, [...last.messages, message]);
  return message;
};

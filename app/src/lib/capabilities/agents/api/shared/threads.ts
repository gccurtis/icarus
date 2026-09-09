import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { Message, MessageRole } from "$representation/data/types/agents/message";
import type { ThreadKind } from "$representation/data/types/agents/thread";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import { messageText, textMessage } from "$representation/data/behavior/agents/messages";

import { rowsIn, uniqueId } from "$capabilities/agents/api/shared/store";

export const messagesOf = (store: StoreUnitOfWork, threadId: string): readonly Message[] =>
  rowsIn(store, "threadParts")
    .filter((part) => part.threadId === threadId && Array.isArray(part.messages))
    .toSorted((left, right) => left.part - right.part)
    .flatMap((part) => part.messages);

export const lastLineOf = (store: StoreUnitOfWork, threadId: string): string | null => {
  const messages = messagesOf(store, threadId);
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
  projectId: string,
  threadId: string,
  role: MessageRole,
  author: Actor,
  at: number,
  text: string
): Message => {
  const message = textMessage(`m-${uniqueId()}`, role, author, at, text);
  const parts = rowsIn(store, "threadParts")
    .filter((part) => part.threadId === threadId)
    .toSorted((left, right) => left.part - right.part);
  const last: TableRow<"threadParts"> | undefined = parts[parts.length - 1];
  if (last === undefined) {
    store.create("threadParts", { projectId, threadId, part: 1, messages: [message] });
  } else {
    store.update(`threadParts.${last._id}.messages`, [...last.messages, message]);
  }
  return message;
};

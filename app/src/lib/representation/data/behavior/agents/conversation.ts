import {
  isStoredThread,
  isStoredThreadPart
} from "$representation/data/behavior/agents/stored-thread";
import {
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { ThreadKind } from "$representation/data/types/agents/thread";
import type { Id } from "$representation/data/types/core/id";
import type { TableRow } from "$representation/store/tables";

export class ConversationAggregateError extends Error {}

export type ConversationAggregate = {
  readonly thread: TableRow<"threads">;
  readonly parts: readonly TableRow<"threadParts">[];
};

const fail = (): never => {
  throw new ConversationAggregateError(
    "The conversation is not one exact current aggregate in the authorized project"
  );
};

/**
 * Resolve one conversation as a closed ownership aggregate.
 *
 * Matching rows are selected by represented identity first. A claimant with a
 * wrong project, kind, shape, or duplicate part number invalidates the whole
 * aggregate; it is never filtered away and never partially returned.
 */
export const conversationAggregate = (
  threadRows: readonly unknown[],
  partRows: readonly unknown[],
  projectId: Id<"projects">,
  threadId: Id<"threads">,
  expectedKind: ThreadKind
): ConversationAggregate => {
  if (!isStoredRowId(projectId, "projects") || !isStoredRowId(threadId, "threads")) fail();

  const threadClaimants = threadRows.filter(
    (candidate) => storedFields(candidate)?._id === threadId
  );
  if (threadClaimants.length !== 1) fail();
  const candidate = threadClaimants[0];
  if (!isStoredThread(candidate)) {
    throw new ConversationAggregateError(
      "The conversation identity is not the exact current stored shape"
    );
  }
  const thread = candidate;
  if (thread.projectId !== projectId || thread.kind !== expectedKind) fail();

  const partClaimants = partRows.filter(
    (candidate) => storedFields(candidate)?.threadId === threadId
  );
  if (partClaimants.length === 0 || partClaimants.some((part) => !isStoredThreadPart(part))) {
    fail();
  }
  const parts = partClaimants as TableRow<"threadParts">[];
  if (parts.some((part) => part.projectId !== projectId)) fail();
  if (new Set(parts.map((part) => part.part)).size !== parts.length) fail();

  return {
    thread,
    parts: parts.toSorted((left, right) => left.part - right.part)
  };
};

import type { Id } from "$convex/_generated/dataModel";
import { PersonaThreadsError } from "$persona-threads/errors";
import type { Actor } from "$shared/types/actor";

/**
 * The message a thread continued from.
 *
 * Both halves are stored: the message says where the conversation was cut, and
 * the thread says which conversation, which is what lets the earlier turns be
 * read without a lookup to find out where the message lived.
 */
export type BranchPoint = {
  readonly threadId: Id<"personaThreads">;
  readonly messageId: Id<"messages">;
};

/** A thread as a list or a chat header renders it. `projectId` stops at the read. */
export type PersonaThread = {
  readonly id: Id<"personaThreads">;
  readonly personaId: Id<"personas">;
  readonly title: string;
  readonly branchedFrom?: BranchPoint;
  readonly createdBy: Actor;
  readonly updatedAt: number;
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * It is what a list of chats renders, and no message is loaded to do it — so a
 * thread titled with spaces is a conversation nobody can find their way back to.
 */
export const personaThreadTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new PersonaThreadsError("empty-title", "A chat needs a title to be found by");
  }
  return trimmed;
};

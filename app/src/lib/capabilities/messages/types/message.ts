import { v, type Infer } from "convex/values";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import { MessagesError } from "$messages/errors";
import type { MessageSource } from "$messages/types/source";
import type { ThreadRef } from "$messages/types/thread";
import type { ToolCall } from "$messages/types/tool-call";
import type { Actor } from "$shared/types/actor";
import type { Mention } from "$shared/types/mention";

/**
 * Which side of the exchange a turn is on — deliberately not `user | assistant`.
 *
 * A thread is a room, not a two-party exchange: with three people and an agent
 * in it, "user" would be four different actors wearing one label. Identity is
 * `author`; this says whether the turn is addressed to the responder or is what
 * came back.
 */
export const messageRoleValidator = v.union(v.literal("prompt"), v.literal("response"));

export type MessageRole = Infer<typeof messageRoleValidator>;

/**
 * Whether a turn is still arriving, arrived, or died on the way.
 *
 * `error` is a state rather than the absence of one because a turn that failed
 * halfway is still a turn: what it managed to say and the tools it managed to
 * call are the record of how far it got.
 */
export const messageStateValidator = v.union(
  v.literal("streaming"),
  v.literal("complete"),
  v.literal("error")
);

export type MessageState = Infer<typeof messageStateValidator>;

/**
 * One turn, as a reader of a thread sees it.
 *
 * No `thread` and no `projectId`: a read is always of one thread, so repeating
 * which one per turn says nothing.
 */
export type Message = {
  readonly id: Id<"messages">;
  readonly role: MessageRole;
  readonly blocks: ContentBlock[];
  /** Absent on a response means the thread's own responder. */
  readonly author?: Actor;
  readonly mentions?: Mention[];
  readonly toolCalls?: ToolCall[];
  readonly sources?: MessageSource[];
  readonly state: MessageState;
  readonly error?: string;
  /** `_creationTime`. Appends are the only writes, so it is also the order. */
  readonly at: number;
};

/** A turn as it is taken. `state` is not here: it follows from `streaming`. */
export type MessageDraft = {
  readonly thread: ThreadRef;
  readonly role: MessageRole;
  readonly blocks: ContentBlock[];
  readonly author?: Actor;
  readonly mentions?: Mention[];
  readonly toolCalls?: ToolCall[];
  readonly sources?: MessageSource[];
  /** Opens the turn for a responder still producing it. Finished by `finish`. */
  readonly streaming?: boolean;
};

/**
 * How a streaming turn ended.
 *
 * The blocks are carried whichever way it went, because a turn that failed
 * halfway still said something, and `state` follows from `error` rather than
 * being sent beside it — two fields could disagree, and one cannot.
 */
export type MessageOutcome = {
  readonly blocks: ContentBlock[];
  readonly toolCalls?: ToolCall[];
  readonly sources?: MessageSource[];
  /** Present when it died on the way. */
  readonly error?: string;
};

/**
 * The stored form of a turn's author, which a validator cannot state because it
 * is a constraint between two fields.
 *
 * **Required on a prompt, optional on a response.** Absence on a response means
 * *the obvious responder* — a persona answering in its own chat, a task
 * reporting in its own thread — and presence always names someone else. A prompt
 * has no obvious asker, so an unauthored one is a question from nobody.
 */
export const messageAuthor = (role: MessageRole, author: Actor | undefined): Actor | undefined => {
  if (role === "prompt" && author === undefined) {
    throw new MessagesError("prompt-unauthored", "A prompt names who is asking");
  }
  return author;
};

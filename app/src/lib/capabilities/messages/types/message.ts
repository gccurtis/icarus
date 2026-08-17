import { v, type Infer } from "convex/values";
import { blockValidator, type ContentBlock } from "$content/types/block";
import { MessagesError } from "$messages/errors";
import { actorValidator, type Actor } from "$shared/types/actor";
import { resourceRefValidator } from "$shared/types/resource";

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
 * halfway is still a turn: what it managed to say is the record of how far it
 * got, and its blocks are carried either way.
 */
export const messageStateValidator = v.union(
  v.literal("streaming"),
  v.literal("complete"),
  v.literal("error")
);

export type MessageState = Infer<typeof messageStateValidator>;

/**
 * One turn in a thread.
 *
 * **Not a row.** There is no `messages` table: a conversation is never read
 * outside its consumer and is most of what that consumer *is*, so
 * `researchThreads`, `agentTasks`, and `personaThreads` each hold
 * `messages: Message[]` inline. That is why there is no `projectId` and no
 * thread reference — both belonged to a table, and the link stops needing to
 * exist rather than being stored more cheaply.
 *
 * **Ordering is array position, not `sentAt`.** The owner appends, so order is
 * the array's; `sentAt` exists only to display a time and nothing sequences on
 * it. A linked list is what you reach for when rows sit unordered in a table.
 *
 * **`attachments` are plain `ResourceRef`s** — what a turn pulled in alongside
 * itself. Not `sources`, which is a narrower claim implying the turn drew a
 * conclusion; and no excerpts or titles, because a message is working material
 * and an excerpt that has to outlive the thread is copied at promotion to a
 * finding. A link is not an attachment: it lives in a `Mark`, and capturing it
 * produces an external file, which is a resource like any other.
 *
 * **`labels` are a client's own marks** — pinned, hidden, needs-review — trimmed
 * and lowercased so `Pinned` and `pinned` are one label. Open because a field
 * per idea is not worth it.
 *
 * **Append-only.** Changing a conversation is branching, not editing.
 */
export const messageValidator = v.object({
  /** Local to the thread, like a row id. */
  id: v.string(),
  role: messageRoleValidator,
  /** Absent on a response means the thread's own responder. Presence always names someone else. */
  author: v.optional(actorValidator),
  /** When, not order. */
  sentAt: v.number(),
  blocks: v.array(blockValidator),
  attachments: v.optional(v.array(resourceRefValidator)),
  labels: v.optional(v.array(v.string())),
  state: messageStateValidator,
  error: v.optional(v.string())
});

/** The recursion the validator cannot state, inherited from `ContentBlock`. */
export type Message = Omit<Infer<typeof messageValidator>, "blocks"> & {
  blocks: ContentBlock[];
};

/**
 * A turn as it is taken. `state` is absent because it is derived, never given.
 */
export type MessageFields = {
  readonly id: string;
  readonly role: MessageRole;
  readonly author?: Actor;
  readonly sentAt: number;
  readonly blocks: ContentBlock[];
  readonly attachments?: Message["attachments"];
  readonly labels?: string[];
  readonly error?: string;
  /** A turn still arriving. `error` wins over it, because a failure has already happened. */
  readonly streaming?: boolean;
};

const canonicalLabel = (label: string): string => label.trim().toLowerCase();

/**
 * The only way to build a `Message`, and that is the point — it upholds two
 * rules a validator cannot express, and being the single door turns them from
 * advice into something a caller cannot get wrong.
 *
 * **A prompt must name its author.** Absence on a response means the obvious
 * responder — a persona answering in its own chat, a task reporting in its own
 * thread — and a prompt has no obvious asker, so an unauthored one is a question
 * from nobody with no way to attribute or reply. That is a constraint *between
 * two fields*, which a Convex validator has no way to state.
 *
 * **`state` is derived from `error`, never supplied.** Two fields saying whether
 * the turn worked can disagree; one cannot. So the caller says what happened and
 * this says what state that is.
 */
export const message = (fields: MessageFields): Message => {
  if (fields.role === "prompt" && fields.author === undefined) {
    throw new MessagesError(
      "prompt-unauthored",
      "A prompt must name its author: absence means the thread's own responder, which a prompt has no case for."
    );
  }

  const state: MessageState =
    fields.error !== undefined ? "error" : fields.streaming === true ? "streaming" : "complete";

  return {
    id: fields.id,
    role: fields.role,
    ...(fields.author !== undefined && { author: fields.author }),
    sentAt: fields.sentAt,
    blocks: fields.blocks,
    ...(fields.attachments !== undefined && { attachments: fields.attachments }),
    ...(fields.labels !== undefined && { labels: fields.labels.map(canonicalLabel) }),
    state,
    ...(fields.error !== undefined && { error: fields.error })
  };
};

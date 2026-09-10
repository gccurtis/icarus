import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { ResourceRef } from "$representation/data/types/core/resource";

/** Which side of the exchange, not `user | assistant`: a thread is a room. */
export type MessageRole = "prompt" | "response";

/** Messages are appended after one complete provider turn; no partial row is persisted. */
export type MessageState = "complete";

/**
 * One message. `id` is local to its thread — messages are not rows.
 *
 * Ordering is array position; `sentAt` is for display. Every message names the
 * actor that authored it, so readers never infer identity from role or thread.
 *
 * A message cites by writing: a URL is a `link` mark, project material is an
 * `attachments` entry. There is no third citation field.
 */
export type Message = {
  id: string;
  role: MessageRole;
  author: Actor;
  sentAt: number;
  blocks: ContentBlock[];
  attachments?: ResourceRef[];
  /** A client's own marks — pinned, hidden, needs-review. */
  labels?: string[];
  state: MessageState;
};

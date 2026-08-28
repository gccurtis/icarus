import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { ResourceRef } from "$representation/data/types/core/resource";

/** Which side of the exchange, not `user | assistant`: a thread is a room. */
export type MessageRole = "prompt" | "response";

export type MessageState = "streaming" | "complete" | "error";

/**
 * One message. `id` is local to its thread — messages are not rows.
 *
 * Ordering is array position; `sentAt` is for display. `author` absent on a
 * response means the thread's own responder, so attributing a persona's reply
 * never requires inventing a unit of work.
 *
 * A message cites by writing: a URL is a `link` mark, project material is an
 * `attachments` entry. There is no third citation field.
 */
export type Message = {
  id: string;
  role: MessageRole;
  author?: Actor;
  sentAt: number;
  blocks: ContentBlock[];
  attachments?: ResourceRef[];
  /** A client's own marks — pinned, hidden, needs-review. */
  labels?: string[];
  state: MessageState;
  error?: string;
};

import { v, type Infer } from "convex/values";

/**
 * Who a remark is addressed to — `Actor` minus one kind, and that exclusion is
 * the whole of the difference.
 *
 * **`system` has no case**: it is a thing that happens, not a thing you talk to.
 *
 * The three that remain are addressable because each does something different
 * when addressed. Mentioning a **persona** starts or continues a chat with a
 * durable identity. Mentioning a **task** delivers into that task's own thread,
 * which is how you steer work already in progress. Mentioning a **user**
 * notifies a person.
 *
 * **A mention is a `Mark`, not a field beside the content.** It is a span of text
 * someone typed, so it lives in the text — which is what makes it shift when
 * earlier text is edited, survive a merge, and render where it was written. See
 * `$content/types/block`.
 */
export const mentionValidator = v.union(
  v.object({ kind: v.literal("user"), id: v.string() }),
  v.object({ kind: v.literal("persona"), id: v.string() }),
  v.object({ kind: v.literal("task"), id: v.string() })
);

export type Mention = Infer<typeof mentionValidator>;

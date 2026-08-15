# Comment

Discussion attached to a place in the project. Threads anchor; comments hang off
them.

```ts
interface CommentThread {
  projectId: Id<"projects">;
  anchor: CommentAnchor;
  status: "open" | "resolved";
  resolvedBy?: Id<"users">;
  resolvedAt?: number;
  createdBy: Actor;
  updatedAt: number;
}

interface CommentAnchor {
  targetType: "document" | "slides" | "spreadsheet" | "question" | "hypothesis" | "finding" | "externalFile";
  targetId: string;
  path?: string;               // "blocks/4", "slides/2/elements/1", "Sheet1!B7"
  quote?: string;              // the text the thread was anchored to
}

interface Comment {
  threadId: Id<"commentThreads">;
  blocks: ContentBlock[];
  author: Actor;
  mentions?: Mention[];
  editedAt?: number;
}
```

## Thread and comment are separate

The thread owns the anchor and the resolved state; comments are the replies. A
single-comment model would have to nominate one comment as the one that carries
the anchor, and resolving a conversation would mean resolving an individual
remark.

## Body is blocks

Comments get links, mentions, code snippets, and pasted screenshots. Those are
the ordinary content of a review remark, and blocks are what already express
them.

`mentions` is extracted alongside rather than only living inside the blocks, so
"comments mentioning me" is an index rather than a scan of every comment body in
the project.

`author` is an [`Actor`](../core/actor.md), not a user id — an agent reviewing a
document and leaving remarks on it is an ordinary thing to want, and a comment is
the natural place for those to land.

`mentions` uses [`Mention`](../core/actor.md#mentions-are-the-mirror-image), which
addresses users, personas, and running tasks. Mentioning a persona from a comment
opens a [chat](../ai/persona-chat.md) with it carrying the comment as context;
mentioning a task delivers into that task's thread. So "@Researcher, is this
consistent with the Q3 scan?" on a paragraph is a complete interaction rather
than a note nobody reads.

## Anchoring is a path, and it is best-effort

`path` locates the thread within its target using the same addressing as
everything else — object, field, index. Since [content blocks have no
ids](../README.md#addressing-a-content-block), a comment on block 4 of a
document is a comment on `blocks/4`.

Which means an edit that inserts a block above it moves what it points at. That
is a real cost of block identity living in position, and `quote` is the
mitigation: the thread keeps the text it was anchored to, so a path that no
longer matches can be re-found by searching, or shown as detached rather than
silently pointing at the wrong paragraph.

The alternative — stable block ids purely to anchor comments — would put an
identifier on every block in the system to serve the small fraction that get
commented on.

`resolvedBy` stays a user while `createdBy` and `author` are actors. Anything can
raise a remark; closing one is a judgement that a person makes.

## Resolved rather than deleted

`resolved` hides a thread without destroying it. Review discussions are often
the only record of why something is the way it is, and deleting on resolve
throws that away at precisely the moment it starts being useful.

## Editing

`editedAt` marks a comment as changed. The prior text is not kept — a comment is
a remark in a conversation, not a document, and version history for it would be
storage nobody reads.

## Related

[content block](../content/content-block.md) · [activity](activity.md)
